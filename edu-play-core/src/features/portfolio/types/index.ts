// Portfolio Feature - Shared Types
// Mirrors the `child_artifacts` table from migration 20260417100000.
// Source of truth: PRIVACY.md §7.1 lifecycle.

/**
 * Artifact visibility lifecycle, matching the `visibility_status` Postgres
 * enum. Every artifact starts at `draft` and only reaches `family_visible`
 * after teacher review.
 */
export const ARTIFACT_VISIBILITIES = [
  'draft',
  'internal_teacher_only',
  'family_visible',
  'archived',
] as const;

export type ArtifactVisibility = (typeof ARTIFACT_VISIBILITIES)[number];

/**
 * Artifact media type. Matches the `child_artifacts.artifact_type` CHECK
 * constraint.
 */
export const ARTIFACT_TYPES = [
  'drawing',
  'photo',
  'audio',
  'video',
  'other',
] as const;

export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

/**
 * Camel-cased shape returned by feature queries. The DB row uses snake_case;
 * queries normalize on read so callers never see DB casing.
 */
export interface Artifact {
  id: string;
  studentId: string;
  classId: string | null;
  title: string | null;
  artifactType: ArtifactType;
  storagePath: string;
  visibility: ArtifactVisibility;
  reviewedBy: string | null;
  reviewedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Pattern B return contract for portfolio server actions.
 * See CLAUDE.md § Server Action Return Contracts.
 */
export interface ActionResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}
