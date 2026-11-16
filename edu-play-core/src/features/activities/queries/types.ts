import type { ActivityInstance } from '../types';

/**
 * Raw DB row for `activity_instances` keyed in snake_case. Mirrors the
 * migration in `supabase/migrations/20261116225053_baseline.sql`.
 *
 * Kept local so queries can shape responses without depending on the
 * generated `Database` types until they are regenerated downstream.
 */
export interface ActivityInstanceRow {
  id: string;
  type_id: string;
  config: unknown;
  assigned_to: string;
  class_id: string | null;
  source_learning_path_step_id: string | null;
  result_summary: unknown | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const ACTIVITY_INSTANCE_COLUMNS =
  'id, type_id, config, assigned_to, class_id, source_learning_path_step_id, result_summary, created_by, created_at, updated_at' as const;

export const ACTIVITY_INSTANCE_SELECT = ACTIVITY_INSTANCE_COLUMNS;

/**
 * Pure mapper from a DB row to the camel-cased `ActivityInstance` shape
 * exposed by the feature module. No async work, safe for unit tests.
 */
export function mapActivityInstanceRow(
  row: ActivityInstanceRow,
): ActivityInstance {
  return {
    id: row.id,
    typeId: row.type_id,
    config: row.config,
    assignedTo: row.assigned_to,
    classId: row.class_id,
    sourceLearningPathStepId: row.source_learning_path_step_id,
    resultSummary: row.result_summary,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
