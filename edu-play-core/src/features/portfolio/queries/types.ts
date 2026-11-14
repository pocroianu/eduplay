import type { Artifact, ArtifactType, ArtifactVisibility } from '../types';

/**
 * Raw DB row for `child_artifacts` keyed in snake_case. Mirrors the
 * migration in `supabase/migrations/20260417100000_child_artifacts_audit_log.sql`.
 * Kept local so queries can shape responses without depending on the
 * generated `Database` types (which haven't been regenerated to include
 * `child_artifacts` yet — tracked as follow-up work).
 */
export interface ArtifactRow {
  id: string;
  student_id: string;
  class_id: string | null;
  title: string | null;
  artifact_type: ArtifactType;
  storage_path: string;
  visibility: ArtifactVisibility;
  reviewed_by: string | null;
  reviewed_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

const ARTIFACT_COLUMNS =
  'id, student_id, class_id, title, artifact_type, storage_path, visibility, reviewed_by, reviewed_at, metadata, created_at, updated_at' as const;

export const ARTIFACT_SELECT = ARTIFACT_COLUMNS;

/**
 * Pure mapper from a DB row to the camel-cased `Artifact` shape exposed by
 * the feature module. No async work, safe for unit tests.
 */
export function mapArtifactRow(row: ArtifactRow): Artifact {
  return {
    id: row.id,
    studentId: row.student_id,
    classId: row.class_id,
    title: row.title,
    artifactType: row.artifact_type,
    storagePath: row.storage_path,
    visibility: row.visibility,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    metadata: row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata
      : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
