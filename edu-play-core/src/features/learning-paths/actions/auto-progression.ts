import 'server-only';
import type { Json } from '@/shared/types/database';
import { runAdvanceProgress, type EduplaySupabaseClient } from './advance-progress';

interface ActivityCompletionInput {
  activityInstanceId: string;
}

interface StudentClassRow {
  class_id: string | null;
}

interface AssignmentPathRow {
  path_id: string;
}

interface ActivityInstanceRow {
  id: string;
  assigned_to: string;
  type_id: string;
  config: Json;
  result_summary: Json | null;
}

interface ActivityStepRow {
  id: string;
  path_id: string;
  target_activity_config: Json;
}

export async function advanceActivityCompletionProgress(
  supabase: EduplaySupabaseClient,
  input: ActivityCompletionInput,
): Promise<void> {
  const { data: instance, error: instanceError } = await supabase
    .from('activity_instances')
    .select('id, assigned_to, type_id, config, result_summary')
    .eq('id', input.activityInstanceId)
    .maybeSingle();

  if (instanceError) {
    throw new Error(instanceError.message);
  }

  if (!instance || !isCompletedResult(instance.result_summary)) {
    return;
  }

  // The SELECT list above is limited to the fields in ActivityInstanceRow.
  const activityInstance = instance as ActivityInstanceRow;
  const pathIds = await getAssignedPathIds(supabase, activityInstance.assigned_to);
  if (pathIds.length === 0) return;

  const { data: steps, error: stepsError } = await supabase
    .from('learning_path_steps')
    .select('id, path_id, target_activity_config')
    .eq('target_activity_type', activityInstance.type_id)
    .in('path_id', pathIds);

  if (stepsError) {
    throw new Error(stepsError.message);
  }

  // The SELECT list above is limited to the fields in ActivityStepRow.
  const activitySteps = (steps ?? []) as ActivityStepRow[];
  for (const step of activitySteps) {
    if (!jsonEqual(step.target_activity_config, activityInstance.config)) {
      continue;
    }

    await runAdvanceProgress(supabase, {
      studentId: activityInstance.assigned_to,
      pathId: step.path_id,
      completedStepId: step.id,
    });
  }
}

async function getAssignedPathIds(
  supabase: EduplaySupabaseClient,
  studentId: string,
): Promise<string[]> {
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('class_id')
    .eq('id', studentId)
    .maybeSingle();

  if (studentError) {
    throw new Error(studentError.message);
  }

  // The SELECT list above is limited to StudentClassRow.
  const classId = (student as StudentClassRow | null)?.class_id ?? null;
  const assignmentQuery = supabase
    .from('learning_path_assignments')
    .select('path_id');

  const { data: assignments, error: assignmentError } = classId
    ? await assignmentQuery.or(`student_id.eq.${studentId},class_id.eq.${classId}`)
    : await assignmentQuery.eq('student_id', studentId);

  if (assignmentError) {
    throw new Error(assignmentError.message);
  }

  return Array.from(
    // The SELECT list above is limited to AssignmentPathRow.
    new Set(((assignments ?? []) as AssignmentPathRow[]).map((row) => row.path_id)),
  );
}

function isCompletedResult(result: Json | null): boolean {
  return (
    typeof result === 'object' &&
    result !== null &&
    !Array.isArray(result) &&
    result.status === 'completed'
  );
}

function jsonEqual(left: Json, right: Json): boolean {
  return JSON.stringify(sortJson(left)) === JSON.stringify(sortJson(right));
}

function sortJson(value: Json): Json {
  if (Array.isArray(value)) {
    return value.map((entry) => sortJson(entry));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, entry]) => [key, entry === undefined ? undefined : sortJson(entry)]),
    );
  }

  return value;
}
