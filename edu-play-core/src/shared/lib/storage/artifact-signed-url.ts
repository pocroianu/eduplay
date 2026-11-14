import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/api/auth';

export const CHILD_ARTIFACTS_BUCKET = 'child-artifacts';
export const DEFAULT_ARTIFACT_SIGNED_URL_TTL_SECONDS = 60 * 5;

export type ArtifactVisibility =
  | 'draft'
  | 'internal_teacher_only'
  | 'family_visible'
  | 'archived';

export interface ArtifactRow {
  id: string;
  student_id: string;
  class_id: string | null;
  storage_path: string;
  visibility: ArtifactVisibility;
}

export interface AuthorizedCaller {
  userId: string;
  role: string;
}

export type SignedUrlOutcome =
  | { ok: true; url: string; path: string; expiresIn: number }
  | {
      ok: false;
      reason: 'not_found' | 'forbidden' | 'storage_error';
      message: string;
    };

interface ResolveArtifactSignedUrlInput {
  artifactId: string;
  expiresIn: number;
  supabase: SupabaseClient;
  caller: AuthorizedCaller;
}

function callerCanReadArtifact(
  caller: AuthorizedCaller,
  artifact: Pick<ArtifactRow, 'student_id' | 'visibility'>,
): boolean {
  switch (caller.role) {
    case 'admin':
      return true;
    case 'teacher':
      // RLS already restricts the row to artifacts in the teacher's classes.
      return true;
    case 'student':
      return caller.userId === artifact.student_id;
    case 'parent':
      return artifact.visibility === 'family_visible';
    default:
      return false;
  }
}

export async function resolveArtifactSignedUrl({
  artifactId,
  expiresIn,
  supabase,
  caller,
}: ResolveArtifactSignedUrlInput): Promise<SignedUrlOutcome> {
  const { data: artifact, error: rowError } = await supabase
    .from('child_artifacts')
    .select('id, student_id, class_id, storage_path, visibility')
    .eq('id', artifactId)
    .maybeSingle();

  if (rowError) {
    return {
      ok: false,
      reason: 'storage_error',
      message: rowError.message,
    };
  }

  if (!artifact) {
    return {
      ok: false,
      reason: 'not_found',
      message: 'Artifact not found',
    };
  }

  const row = artifact as ArtifactRow;

  if (!callerCanReadArtifact(caller, row)) {
    return {
      ok: false,
      reason: 'forbidden',
      message: 'Caller is not allowed to read this artifact',
    };
  }

  const { data, error: signError } = await supabase.storage
    .from(CHILD_ARTIFACTS_BUCKET)
    .createSignedUrl(row.storage_path, expiresIn);

  if (signError || !data?.signedUrl) {
    return {
      ok: false,
      reason: 'storage_error',
      message: signError?.message ?? 'Failed to create signed URL',
    };
  }

  return {
    ok: true,
    url: data.signedUrl,
    path: row.storage_path,
    expiresIn,
  };
}

async function getArtifactSignedUrl(
  artifactId: string,
  expiresIn: number = DEFAULT_ARTIFACT_SIGNED_URL_TTL_SECONDS,
): Promise<SignedUrlOutcome> {
  const { user, profile, supabase } = await requireAuth();
  return resolveArtifactSignedUrl({
    artifactId,
    expiresIn,
    supabase,
    caller: { userId: user.id, role: profile.role },
  });
}
