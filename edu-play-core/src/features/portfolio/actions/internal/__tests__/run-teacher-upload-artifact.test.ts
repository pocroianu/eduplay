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
import { runTeacherUploadArtifact } from '../run-teacher-upload-artifact';

const TEACHER_ID = '99999999-9999-4999-8999-999999999999';
const STUDENT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_STUDENT_ID = '22222222-2222-4222-8222-222222222222';
const CLASS_ID = '33333333-3333-4333-8333-333333333333';

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
  studentRow?: { class_id: string | null } | null;
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

  // `from('students')` returns a builder for the class_id lookup;
  // `from('child_artifacts')` returns the insert builder. The teacher
  // session client only sees students whose class is in
  // `get_teacher_class_ids(auth.uid())`, so a `null` row here simulates
  // a student outside the teacher's classes.
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
                ? { class_id: CLASS_ID }
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
    (capture.insertPayload?.artifact_type as string | undefined) ?? 'photo';
  const storagePath =
    (capture.insertPayload?.storage_path as string | undefined) ??
    `${STUDENT_ID}/${id}.jpg`;
  const classId =
    capture.insertPayload?.class_id === undefined
      ? CLASS_ID
      : (capture.insertPayload.class_id as string | null);
  const title =
    capture.insertPayload?.title === undefined
      ? null
      : (capture.insertPayload.title as string | null);
  return {
    id,
    student_id: STUDENT_ID,
    class_id: classId,
    title,
    artifact_type: artifactType,
    storage_path: storagePath,
    visibility: 'draft',
    reviewed_by: null,
    reviewed_at: null,
    created_at: '2026-05-08T00:00:00Z',
    updated_at: '2026-05-08T00:00:00Z',
  };
}

function authedAsTeacher(supabase: unknown) {
  requireRoleMock.mockResolvedValue({
    supabase,
    user: { id: TEACHER_ID, email: 'teacher@school.local' },
    profile: { id: TEACHER_ID, role: 'teacher', full_name: 'Teacher' },
  });
}

const photoBytes = (): Uint8Array =>
  new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const webpBytes = (): Uint8Array =>
  new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x18, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ]);
const audioBytes = (): Uint8Array =>
  new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0xff]);

beforeEach(() => {
  requireRoleMock.mockReset();
  adminRemoveMock.mockReset();
  adminRemoveMock.mockResolvedValue({ error: null });
  createAdminClientMock.mockReset();
  createAdminClientMock.mockReturnValue({
    storage: { from: () => ({ remove: adminRemoveMock }) },
  });
});

describe('runTeacherUploadArtifact (photo kind)', () => {
  it('uploads a JPEG to <studentId>/<artifactId>.jpg and inserts a draft photo row tagged with the student class', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture);
    authedAsTeacher(supabase);

    const blob = photoBytes();
    const result = await runTeacherUploadArtifact({
      kind: 'photo',
      studentId: STUDENT_ID,
      payload: { blob, mime: 'image/jpeg' },
      title: 'Atelier de pictură',
    });

    expect(result.success).toBe(true);
    expect(result.data?.artifactId).toMatch(/^[0-9a-f-]{36}$/);

    expect(capture.studentLookupId).toBe(STUDENT_ID);

    expect(capture.uploadPath?.startsWith(`${STUDENT_ID}/`)).toBe(true);
    expect(capture.uploadPath?.endsWith('.jpg')).toBe(true);
    expect(capture.uploadBytes).toBe(blob.byteLength);
    expect(capture.uploadOptions?.contentType).toBe('image/jpeg');
    expect(capture.uploadOptions?.upsert).toBe(false);

    expect(capture.insertPayload).toMatchObject({
      student_id: STUDENT_ID,
      class_id: CLASS_ID,
      artifact_type: 'photo',
      visibility: 'draft',
      title: 'Atelier de pictură',
    });
    expect(capture.insertPayload?.storage_path).toBe(capture.uploadPath);
    expect(capture.insertPayload?.id).toBe(result.data?.artifactId);
  });

  it('uploads a WebP photo with the .webp extension and image/webp content type', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture);
    authedAsTeacher(supabase);

    const result = await runTeacherUploadArtifact({
      kind: 'photo',
      studentId: STUDENT_ID,
      payload: { blob: webpBytes(), mime: 'image/webp' },
    });

    expect(result.success).toBe(true);
    expect(capture.uploadPath?.endsWith('.webp')).toBe(true);
    expect(capture.uploadOptions?.contentType).toBe('image/webp');
    expect(capture.insertPayload?.title).toBeNull();
  });

  it('rejects JPEG uploads whose bytes do not have a JPEG signature', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture);
    authedAsTeacher(supabase);

    const result = await runTeacherUploadArtifact({
      kind: 'photo',
      studentId: STUDENT_ID,
      payload: { blob: webpBytes(), mime: 'image/jpeg' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/fotograf/i);
    expect(capture.uploadPath).toBeUndefined();
    expect(capture.insertPayload).toBeUndefined();
  });

  it('rejects WebP uploads whose bytes do not have a WebP signature', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture);
    authedAsTeacher(supabase);

    const result = await runTeacherUploadArtifact({
      kind: 'photo',
      studentId: STUDENT_ID,
      payload: { blob: photoBytes(), mime: 'image/webp' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/fotograf/i);
    expect(capture.uploadPath).toBeUndefined();
    expect(capture.insertPayload).toBeUndefined();
  });

  it('rejects a student outside the teacher\'s classes (student row is null under RLS)', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture, { studentRow: null });
    authedAsTeacher(supabase);

    const result = await runTeacherUploadArtifact({
      kind: 'photo',
      studentId: OTHER_STUDENT_ID,
      payload: { blob: photoBytes(), mime: 'image/jpeg' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/permisiunea/i);
    expect(capture.uploadPath).toBeUndefined();
    expect(capture.insertPayload).toBeUndefined();
  });

  it('rejects when the student exists but has no class enrollment', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture, {
      studentRow: { class_id: null },
    });
    authedAsTeacher(supabase);

    const result = await runTeacherUploadArtifact({
      kind: 'photo',
      studentId: STUDENT_ID,
      payload: { blob: photoBytes(), mime: 'image/jpeg' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/permisiunea/i);
    expect(capture.uploadPath).toBeUndefined();
  });

  it('surfaces an error when the student class lookup fails', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture, {
      studentLookupError: { message: 'lookup failed' },
    });
    authedAsTeacher(supabase);

    const result = await runTeacherUploadArtifact({
      kind: 'photo',
      studentId: STUDENT_ID,
      payload: { blob: photoBytes(), mime: 'image/jpeg' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/clasa/i);
    expect(capture.uploadPath).toBeUndefined();
  });

  it('returns a forbidden error when the caller is not a teacher', async () => {
    requireRoleMock.mockRejectedValue(ApiError.forbidden());

    const result = await runTeacherUploadArtifact({
      kind: 'photo',
      studentId: STUDENT_ID,
      payload: { blob: photoBytes(), mime: 'image/jpeg' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/profesor/i);
  });

  it('returns an unauthorized error when no session is present', async () => {
    requireRoleMock.mockRejectedValue(ApiError.unauthorized());

    const result = await runTeacherUploadArtifact({
      kind: 'photo',
      studentId: STUDENT_ID,
      payload: { blob: photoBytes(), mime: 'image/jpeg' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/autentificat/i);
  });

  it('rejects an empty photo blob even if the schema is bypassed', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture);
    authedAsTeacher(supabase);

    const result = await runTeacherUploadArtifact({
      kind: 'photo',
      studentId: STUDENT_ID,
      payload: { blob: new Uint8Array(0), mime: 'image/jpeg' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/fotograf/i);
    expect(capture.uploadPath).toBeUndefined();
  });

  it('surfaces a photo-specific error when the upload fails', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture, {
      uploadResult: { error: { message: 'storage rls denied' } },
    });
    authedAsTeacher(supabase);

    const result = await runTeacherUploadArtifact({
      kind: 'photo',
      studentId: STUDENT_ID,
      payload: { blob: photoBytes(), mime: 'image/jpeg' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Nu am putut salva fotografia');
    expect(capture.insertPayload).toBeUndefined();
  });

  it('cleans the orphan blob with the admin client when the DB insert fails', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture, {
      insertResult: { data: null, error: { message: 'rls denied' } },
    });
    authedAsTeacher(supabase);

    const result = await runTeacherUploadArtifact({
      kind: 'photo',
      studentId: STUDENT_ID,
      payload: { blob: photoBytes(), mime: 'image/jpeg' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/înregistra/i);

    expect(createAdminClientMock).toHaveBeenCalledTimes(1);
    expect(adminRemoveMock).toHaveBeenCalledTimes(1);
    expect(adminRemoveMock).toHaveBeenCalledWith([capture.uploadPath]);
    expect(supabase.sessionRemove).not.toHaveBeenCalled();
  });


});

describe('runTeacherUploadArtifact (audio kind)', () => {
  it('uploads webm audio to <studentId>/<artifactId>.webm and inserts a draft audio row', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture);
    authedAsTeacher(supabase);

    const blob = audioBytes();
    const result = await runTeacherUploadArtifact({
      kind: 'audio',
      studentId: STUDENT_ID,
      payload: { blob, mime: 'audio/webm' },
    });

    expect(result.success).toBe(true);
    expect(capture.uploadPath?.endsWith('.webm')).toBe(true);
    expect(capture.uploadOptions?.contentType).toBe('audio/webm');
    expect(capture.insertPayload).toMatchObject({
      student_id: STUDENT_ID,
      class_id: CLASS_ID,
      artifact_type: 'audio',
      visibility: 'draft',
    });
  });

  it('uploads ogg audio with the .ogg extension and audio/ogg content type', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture);
    authedAsTeacher(supabase);

    const result = await runTeacherUploadArtifact({
      kind: 'audio',
      studentId: STUDENT_ID,
      payload: { blob: audioBytes(), mime: 'audio/ogg' },
    });

    expect(result.success).toBe(true);
    expect(capture.uploadPath?.endsWith('.ogg')).toBe(true);
    expect(capture.uploadOptions?.contentType).toBe('audio/ogg');
  });

  it('rejects a student outside the teacher\'s classes', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture, { studentRow: null });
    authedAsTeacher(supabase);

    const result = await runTeacherUploadArtifact({
      kind: 'audio',
      studentId: OTHER_STUDENT_ID,
      payload: { blob: audioBytes(), mime: 'audio/webm' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/permisiunea/i);
    expect(capture.uploadPath).toBeUndefined();
  });

  it('surfaces an audio-specific error when the upload fails', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture, {
      uploadResult: { error: { message: 'mime mismatch at storage' } },
    });
    authedAsTeacher(supabase);

    const result = await runTeacherUploadArtifact({
      kind: 'audio',
      studentId: STUDENT_ID,
      payload: { blob: audioBytes(), mime: 'audio/webm' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Nu am putut salva înregistrarea audio');
    expect(capture.insertPayload).toBeUndefined();
  });

  it('cleans the orphan blob with the admin client when the audio DB insert fails', async () => {
    const capture: Capture = {};
    const supabase = buildSessionSupabase(capture, {
      insertResult: { data: null, error: { message: 'rls denied' } },
    });
    authedAsTeacher(supabase);

    const result = await runTeacherUploadArtifact({
      kind: 'audio',
      studentId: STUDENT_ID,
      payload: { blob: audioBytes(), mime: 'audio/webm' },
    });

    expect(result.success).toBe(false);
    expect(adminRemoveMock).toHaveBeenCalledTimes(1);
    expect(adminRemoveMock).toHaveBeenCalledWith([capture.uploadPath]);
  });
});
