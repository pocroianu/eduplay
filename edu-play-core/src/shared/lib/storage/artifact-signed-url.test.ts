import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  resolveArtifactSignedUrl,
  type ArtifactVisibility,
} from './artifact-signed-url';

interface ArtifactRowFixture {
  id: string;
  student_id: string;
  class_id: string | null;
  storage_path: string;
  visibility: ArtifactVisibility;
}

interface MockOptions {
  artifact: ArtifactRowFixture | null;
  selectError?: { message: string } | null;
  signedUrl?: string | null;
  signError?: { message: string } | null;
}

function createMockSupabase(opts: MockOptions): SupabaseClient {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: opts.artifact,
    error: opts.selectError ?? null,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const fromTable = vi.fn().mockReturnValue({ select });

  const createSignedUrl = vi.fn().mockResolvedValue({
    data: opts.signedUrl ? { signedUrl: opts.signedUrl } : null,
    error: opts.signError ?? null,
  });
  const fromBucket = vi.fn().mockReturnValue({ createSignedUrl });

  return {
    from: fromTable,
    storage: { from: fromBucket },
  } as unknown as SupabaseClient;
}

const ARTIFACT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const STUDENT_ID = 'ssssssss-ssss-ssss-ssss-ssssssssssss';
const TEACHER_ID = 'tttttttt-tttt-tttt-tttt-tttttttttttt';
const PARENT_ID = 'pppppppp-pppp-pppp-pppp-pppppppppppp';
const STORAGE_PATH = `${STUDENT_ID}/sample.png`;

const familyVisibleArtifact: ArtifactRowFixture = {
  id: ARTIFACT_ID,
  student_id: STUDENT_ID,
  class_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  storage_path: STORAGE_PATH,
  visibility: 'family_visible',
};

const draftArtifact: ArtifactRowFixture = {
  ...familyVisibleArtifact,
  visibility: 'draft',
};

describe('resolveArtifactSignedUrl', () => {
  it('returns a signed URL for a teacher reading an artifact in their own class (RLS allows row)', async () => {
    const supabase = createMockSupabase({
      artifact: familyVisibleArtifact,
      signedUrl: 'https://example.test/signed/teacher.png',
    });

    const result = await resolveArtifactSignedUrl({
      artifactId: ARTIFACT_ID,
      expiresIn: 300,
      supabase,
      caller: { userId: TEACHER_ID, role: 'teacher' },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url).toBe('https://example.test/signed/teacher.png');
      expect(result.path).toBe(STORAGE_PATH);
      expect(result.expiresIn).toBe(300);
    }
  });

  it('returns not_found for a teacher reading an artifact outside their class (RLS hides row)', async () => {
    const supabase = createMockSupabase({ artifact: null });

    const result = await resolveArtifactSignedUrl({
      artifactId: ARTIFACT_ID,
      expiresIn: 300,
      supabase,
      caller: { userId: TEACHER_ID, role: 'teacher' },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('not_found');
    }
  });

  it('returns a signed URL for a parent reading a family_visible artifact for their child', async () => {
    const supabase = createMockSupabase({
      artifact: familyVisibleArtifact,
      signedUrl: 'https://example.test/signed/parent.png',
    });

    const result = await resolveArtifactSignedUrl({
      artifactId: ARTIFACT_ID,
      expiresIn: 300,
      supabase,
      caller: { userId: PARENT_ID, role: 'parent' },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url).toBe('https://example.test/signed/parent.png');
    }
  });

  it('returns forbidden for a parent attempting to access a draft artifact', async () => {
    const supabase = createMockSupabase({
      artifact: draftArtifact,
      signedUrl: 'https://example.test/should-not-be-issued.png',
    });

    const result = await resolveArtifactSignedUrl({
      artifactId: ARTIFACT_ID,
      expiresIn: 300,
      supabase,
      caller: { userId: PARENT_ID, role: 'parent' },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('forbidden');
    }

    // Helper must NOT call createSignedUrl when it has already denied access.
    const storageFrom = (supabase.storage.from as unknown as ReturnType<typeof vi.fn>);
    expect(storageFrom).not.toHaveBeenCalled();
  });

  it('returns a signed URL for a student reading their own artifact', async () => {
    const supabase = createMockSupabase({
      artifact: { ...draftArtifact, student_id: STUDENT_ID },
      signedUrl: 'https://example.test/signed/student.png',
    });

    const result = await resolveArtifactSignedUrl({
      artifactId: ARTIFACT_ID,
      expiresIn: 300,
      supabase,
      caller: { userId: STUDENT_ID, role: 'student' },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url).toBe('https://example.test/signed/student.png');
    }
  });
});
