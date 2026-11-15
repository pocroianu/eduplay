import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireRoleMock = vi.fn();
const adminRemoveMock = vi.fn();
const createAdminClientMock = vi.fn();

vi.mock('@/lib/api', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    requireRole: (...args: unknown[]) => requireRoleMock(...args),
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => createAdminClientMock(),
}));

import { ApiError } from '@/lib/api';
import { runRecordChildArtifact } from '../run-record-artifact';

const STUDENT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_STUDENT_ID = '22222222-2222-4222-8222-222222222222';
const CLASS_ID = '33333333-3333-4333-8333-333333333333';
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';

interface Capture {
  uploadPath?: string;
  uploadBytes?: number;
  uploadOptions?: Record<string, unknown>;
  insertPayload?: Record<string, unknown>;
  studentLookupId?: string;
}

interface BuildOpts {
  uploadResult?: { error: { message: string } | null };
  insertResult?: { data: unknown; error: { message: string } | null };
  studentRow?:
    | { class_id: string | null; consents?: Record<string, unknown> | null }
    | null;
  studentLookupError?: { message: string };
}

function buildSessionSupabase(capture: Capture, opts: BuildOpts = {}) {
  const upload = vi.fn(
    (path: string, body: Uint8Array, options: Record<string, unknown>) => {
      capture.uploadPath = path;
      capture.uploadBytes = body.byteLength;
      capture.uploadOptions = options;
      return Promise.resolve(opts.uploadResult ?? { error: null });
    },
  );
  const sessionRemove = vi.fn(() => Promise.resolve({ error: null }));
  const storage = { from: vi.fn(() => ({ upload, remove: sessionRemove })) };

  // `from('students')` returns a builder for the self-row class_id lookup;
  // `from('child_artifacts')` returns the insert builder.
  const studentsBuilder: Record<string, unknown> = {};
  studentsBuilder.select = vi.fn(() => studentsBuilder);
  studentsBuilder.eq = vi.fn((_col: string, value: string) => {
    capture.studentLookupId = value;
    return studentsBuilder;
  });
  studentsBuilder.maybeSingle = vi.fn(() =>
    Promise.resolve(
      opts.studentLookupError
        ? { data: null, error: opts.studentLookupError }
        : {
            data:
              opts.studentRow === undefined
                ? { class_id: CLASS_ID, consents: { audio_recording: true } }
                : opts.studentRow,
            error: null,
          },
    ),
  );

  const insertBuilder: Record<string, unknown> = {};
  insertBuilder.insert = vi.fn((payload: Record<string, unknown>) => {
    capture.insertPayload = payload;
    return insertBuilder;
  });
  insertBuilder.select = vi.fn(() => insertBuilder);
  insertBuilder.maybeSingle = vi.fn(() =>
    Promise.resolve(
      opts.insertResult ?? {
        data: makeRow(payloadId(capture), capture),
        error: null,
      },
    ),
  );

  const from = vi.fn((table: string) =>
    table === 'students' ? studentsBuilder : insertBuilder,
  );

  return { storage, from, sessionRemove };
}

function payloadId(capture: Capture): string {
  return (capture.insertPayload?.id as string) ?? 'unknown-id';
}

function makeRow(id: string, capture: Capture) {
  const artifactType =
    (capture.insertPayload?.artifact_type as string | undefined) ?? 'drawing';
  const storagePath =
    (capture.insertPayload?.storage_path as string | undefined) ??
    `${STUDENT_ID}/${id}.png`;
  const classId =
    capture.insertPayload?.class_id === undefined
      ? CLASS_ID
      : (capture.insertPayload.class_id as string | null);
  return {
    id,
    student_id: STUDENT_ID,
    class_id: classId,
    title: null,
    artifact_type: artifactType,
    storage_path: storagePath,
    visibility: 'draft',
    reviewed_by: null,
    reviewed_at: null,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
  };
}

function authedAsStudent(supabase: unknown) {
  requireRoleMock.mockResolvedValue({
    supabase,
    user: { id: STUDENT_ID, email: 'kid@students.local' },
    profile: { id: STUDENT_ID, role: 'student', full_name: 'Kid' },
  });
}

beforeEach(() => {
  requireRoleMock.mockReset();
  adminRemoveMock.mockReset();
  adminRemoveMock.mockResolvedValue({ error: null });
  createAdminClientMock.mockReset();
  createAdminClientMock.mockReturnValue({
    storage: { from: () => ({ remove: adminRemoveMock }) },
  });
});

describe('runRecordChildArtifact (drawing kind)', () => {
  it("uploads PNG bytes to <studentId>/<artifactId>.png and inserts a draft drawing row tagged with the student's class", async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture);
    authedAsStudent(supabase);

    const result = await runRecordChildArtifact({
      kind: 'drawing',
      studentId: STUDENT_ID,
      payload: { dataUrl: TINY_PNG_DATA_URL },
      sourceRef: 'fruits-01',
    });

    expect(result.success).toBe(true);
    expect(result.data?.artifactId).toMatch(/^[0-9a-f-]{36}$/);

    expect(capture.studentLookupId).toBe(STUDENT_ID);

    expect(capture.uploadPath?.startsWith(`${STUDENT_ID}/`)).toBe(true);
    expect(capture.uploadPath?.endsWith('.png')).toBe(true);
    expect(capture.uploadBytes).toBeGreaterThan(0);
    expect(capture.uploadOptions?.contentType).toBe('image/png');
    expect(capture.uploadOptions?.upsert).toBe(false);

    expect(capture.insertPayload).toMatchObject({
      student_id: STUDENT_ID,
      class_id: CLASS_ID,
      artifact_type: 'drawing',
      visibility: 'draft',
    });
    expect(capture.insertPayload?.storage_path).toBe(capture.uploadPath);
    expect(capture.insertPayload?.id).toBe(result.data?.artifactId);
  });

  it('records a draft with class_id=null when the student has no class enrollment', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture, {
      studentRow: { class_id: null },
    });
    authedAsStudent(supabase);

    const result = await runRecordChildArtifact({
      kind: 'drawing',
      studentId: STUDENT_ID,
      payload: { dataUrl: TINY_PNG_DATA_URL },
    });

    expect(result.success).toBe(true);
    expect(capture.insertPayload?.class_id).toBeNull();
  });

  it('surfaces an error when the student class lookup fails', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture, {
      studentLookupError: { message: 'lookup failed' },
    });
    authedAsStudent(supabase);

    const result = await runRecordChildArtifact({
      kind: 'drawing',
      studentId: STUDENT_ID,
      payload: { dataUrl: TINY_PNG_DATA_URL },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/clasa/i);
    expect(capture.uploadPath).toBeUndefined();
    expect(capture.insertPayload).toBeUndefined();
  });

  it('rejects when studentId does not match the authenticated session', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture);
    authedAsStudent(supabase);

    const result = await runRecordChildArtifact({
      kind: 'drawing',
      studentId: OTHER_STUDENT_ID,
      payload: { dataUrl: TINY_PNG_DATA_URL },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/permisiunea/i);
    expect(capture.uploadPath).toBeUndefined();
  });

  it('returns a forbidden error when the caller is not a student', async () => {
    requireRoleMock.mockRejectedValue(ApiError.forbidden());

    const result = await runRecordChildArtifact({
      kind: 'drawing',
      studentId: STUDENT_ID,
      payload: { dataUrl: TINY_PNG_DATA_URL },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/elev/i);
  });

  it('returns an unauthorized error when no session is present', async () => {
    requireRoleMock.mockRejectedValue(ApiError.unauthorized());

    const result = await runRecordChildArtifact({
      kind: 'drawing',
      studentId: STUDENT_ID,
      payload: { dataUrl: TINY_PNG_DATA_URL },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/autentificat/i);
  });

  it('rejects a malformed dataURL even if the schema is bypassed', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture);
    authedAsStudent(supabase);

    const result = await runRecordChildArtifact({
      kind: 'drawing',
      studentId: STUDENT_ID,
      payload: { dataUrl: 'data:image/png;base64,' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/captur/i);
    expect(capture.uploadPath).toBeUndefined();
  });

  it('rejects a base64 payload that does not start with the PNG signature', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture);
    authedAsStudent(supabase);

    // A valid base64 string of >8 random bytes that is not a PNG (here a
    // GIF89a header padded to satisfy the size floor).
    const fakeBytes = Buffer.concat([
      Buffer.from('GIF89a', 'ascii'),
      Buffer.alloc(64, 0x00),
    ]);
    const result = await runRecordChildArtifact({
      kind: 'drawing',
      studentId: STUDENT_ID,
      payload: {
        dataUrl: `data:image/png;base64,${fakeBytes.toString('base64')}`,
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/captur/i);
    expect(capture.uploadPath).toBeUndefined();
  });

  it('rejects a base64 string with junk characters that Node would silently strip', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture);
    authedAsStudent(supabase);

    // `Buffer.from('!!!!', 'base64')` silently returns an empty buffer
    // instead of throwing, which is exactly the Codex finding we are
    // guarding against.
    const result = await runRecordChildArtifact({
      kind: 'drawing',
      studentId: STUDENT_ID,
      payload: { dataUrl: 'data:image/png;base64,!!!!' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/captur/i);
    expect(capture.uploadPath).toBeUndefined();
  });

  it('surfaces a generic error and skips the insert when upload fails', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture, {
      uploadResult: { error: { message: 'storage rls denied' } },
    });
    authedAsStudent(supabase);

    const result = await runRecordChildArtifact({
      kind: 'drawing',
      studentId: STUDENT_ID,
      payload: { dataUrl: TINY_PNG_DATA_URL },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/captur/i);
    expect(capture.insertPayload).toBeUndefined();
  });

  it('cleans the orphan blob with the admin client when the DB insert fails after a successful upload', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture, {
      insertResult: { data: null, error: { message: 'rls denied' } },
    });
    authedAsStudent(supabase);

    const result = await runRecordChildArtifact({
      kind: 'drawing',
      studentId: STUDENT_ID,
      payload: { dataUrl: TINY_PNG_DATA_URL },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/înregistra/i);

    // Cleanup must go through the admin client, not the student session
    // (storage RLS denies DELETE to students).
    expect(createAdminClientMock).toHaveBeenCalledTimes(1);
    expect(adminRemoveMock).toHaveBeenCalledTimes(1);
    expect(adminRemoveMock).toHaveBeenCalledWith([capture.uploadPath]);
    expect(supabase.sessionRemove).not.toHaveBeenCalled();
  });


});

describe('runRecordChildArtifact (audio kind)', () => {
  const audioBytes = (): Uint8Array =>
    new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0xff]);

  it("uploads webm bytes to <studentId>/<artifactId>.webm and inserts a draft audio row tagged with the student's class", async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture);
    authedAsStudent(supabase);

    const blob = audioBytes();
    const result = await runRecordChildArtifact({
      kind: 'audio',
      studentId: STUDENT_ID,
      payload: { blob, mime: 'audio/webm' },
      sourceRef: 'activity:voice-recorder/intro',
    });

    expect(result.success).toBe(true);
    expect(result.data?.artifactId).toMatch(/^[0-9a-f-]{36}$/);
    expect(capture.uploadPath?.startsWith(`${STUDENT_ID}/`)).toBe(true);
    expect(capture.uploadPath?.endsWith('.webm')).toBe(true);
    expect(capture.uploadBytes).toBe(blob.byteLength);
    expect(capture.uploadOptions?.contentType).toBe('audio/webm');
    expect(capture.uploadOptions?.upsert).toBe(false);

    expect(capture.insertPayload).toMatchObject({
      student_id: STUDENT_ID,
      class_id: CLASS_ID,
      artifact_type: 'audio',
      visibility: 'draft',
    });
    expect(capture.insertPayload?.storage_path).toBe(capture.uploadPath);
    expect(capture.insertPayload?.id).toBe(result.data?.artifactId);
  });

  it('uploads ogg audio with the .ogg extension and audio/ogg content type', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture);
    authedAsStudent(supabase);

    const result = await runRecordChildArtifact({
      kind: 'audio',
      studentId: STUDENT_ID,
      payload: { blob: audioBytes(), mime: 'audio/ogg' },
    });

    expect(result.success).toBe(true);
    expect(capture.uploadPath?.endsWith('.ogg')).toBe(true);
    expect(capture.uploadOptions?.contentType).toBe('audio/ogg');
  });

  it('rejects when studentId does not match the authenticated session', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture);
    authedAsStudent(supabase);

    const result = await runRecordChildArtifact({
      kind: 'audio',
      studentId: OTHER_STUDENT_ID,
      payload: { blob: audioBytes(), mime: 'audio/webm' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/permisiunea/i);
    expect(capture.uploadPath).toBeUndefined();
  });

  it('rejects an empty blob even if the schema is bypassed', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture);
    authedAsStudent(supabase);

    const result = await runRecordChildArtifact({
      kind: 'audio',
      studentId: STUDENT_ID,
      payload: { blob: new Uint8Array(0), mime: 'audio/webm' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/audio/i);
    expect(capture.uploadPath).toBeUndefined();
  });

  it('rejects audio when the parent consent flag is not granted', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture, {
      studentRow: {
        class_id: CLASS_ID,
        consents: { audio_recording: false },
      },
    });
    authedAsStudent(supabase);

    const result = await runRecordChildArtifact({
      kind: 'audio',
      studentId: STUDENT_ID,
      payload: { blob: audioBytes(), mime: 'audio/webm' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/acordul părintelui/i);
    expect(capture.uploadPath).toBeUndefined();
    expect(capture.insertPayload).toBeUndefined();
  });

  it('surfaces an audio-specific error when the upload fails', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture, {
      uploadResult: { error: { message: 'mime mismatch at storage' } },
    });
    authedAsStudent(supabase);

    const result = await runRecordChildArtifact({
      kind: 'audio',
      studentId: STUDENT_ID,
      payload: { blob: audioBytes(), mime: 'audio/webm' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Nu am putut salva înregistrarea audio');
    expect(capture.insertPayload).toBeUndefined();
  });

  it('cleans the orphan blob with the admin client when the DB insert fails after a successful audio upload', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture, {
      insertResult: { data: null, error: { message: 'rls denied' } },
    });
    authedAsStudent(supabase);

    const result = await runRecordChildArtifact({
      kind: 'audio',
      studentId: STUDENT_ID,
      payload: { blob: audioBytes(), mime: 'audio/webm' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/înregistra/i);

    expect(createAdminClientMock).toHaveBeenCalledTimes(1);
    expect(adminRemoveMock).toHaveBeenCalledTimes(1);
    expect(adminRemoveMock).toHaveBeenCalledWith([capture.uploadPath]);
    expect(supabase.sessionRemove).not.toHaveBeenCalled();
  });
});
