import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getActivityType, type ActivityTypeDefinition } from '@/features/activities';
import {
  getActivePathForStudent,
  type ActivePathForStudent,
  type StudentPathStepView,
} from '@/features/learning-paths/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { ROUTES } from '@/shared/lib/constants/routes';
import {
  ACTIVITY_INSTANCE_SELECT,
  type ActivityInstanceRow,
} from '@/features/activities/server';

export interface LaunchLearningMapStepResult {
  href: string;
}

interface LaunchLearningMapStepDeps {
  supabase: SupabaseClient;
  adminSupabase: SupabaseClient;
  studentId: string;
  stepId: string;
  getActivePath?: (
    supabase: SupabaseClient,
    studentId: string,
  ) => Promise<ActivePathForStudent | null>;
  getActivityType?: (typeId: string) => ActivityTypeDefinition | undefined;
}

interface StudentRow {
  class_id: string | null;
}

interface AssignmentRow {
  assigned_by: string | null;
}

export async function launchLearningMapStep(
  stepId: string,
): Promise<LaunchLearningMapStepResult | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return runLaunchLearningMapStep({
    supabase,
    adminSupabase: createAdminClient(),
    studentId: user.id,
    stepId,
  });
}

export async function runLaunchLearningMapStep({
  supabase,
  adminSupabase,
  studentId,
  stepId,
  getActivePath = getActivePathForStudent,
  getActivityType: resolveActivityType = getActivityType,
}: LaunchLearningMapStepDeps): Promise<LaunchLearningMapStepResult | null> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', studentId)
    .maybeSingle();

  if (profileError || profile?.role !== 'student') return null;

  const activePath = await getActivePath(supabase, studentId);
  if (!activePath) return null;

  const step = activePath.steps.find((candidate) => candidate.id === stepId);
  if (!step || step.studentStatus === 'locked') return null;

  const definition = step.targetActivityType
    ? resolveActivityType(step.targetActivityType)
    : undefined;
  if (!definition) return null;

  const parsedConfig = definition.configSchema.safeParse(step.targetActivityConfig);
  if (!parsedConfig.success) return null;

  const existingInstance = await findSourceInstance(
    adminSupabase,
    step.id,
    studentId,
  );
  if (existingInstance) {
    return { href: ROUTES.STUDENT.ACTIVITY_PLAY(existingInstance.id) };
  }

  if (step.studentStatus !== 'current') return null;

  const studentClassId = await getStudentClassId(supabase, studentId);
  const createdBy = await getAssignmentOwner(
    supabase,
    activePath,
    studentId,
    studentClassId,
  );

  const created = await createSourceInstance(adminSupabase, {
    step,
    studentId,
    classId: studentClassId,
    createdBy,
    config: parsedConfig.data,
  });

  return created ? { href: ROUTES.STUDENT.ACTIVITY_PLAY(created.id) } : null;
}

async function findSourceInstance(
  adminSupabase: SupabaseClient,
  stepId: string,
  studentId: string,
): Promise<ActivityInstanceRow | null> {
  const { data, error } = await adminSupabase
    .from('activity_instances')
    .select(ACTIVITY_INSTANCE_SELECT)
    .eq('source_learning_path_step_id', stepId)
    .eq('assigned_to', studentId)
    .maybeSingle();

  if (error) {
    throw new Error(`launchLearningMapStep failed (existing): ${error.message}`);
  }

  return (data as ActivityInstanceRow | null) ?? null;
}

async function getStudentClassId(
  supabase: SupabaseClient,
  studentId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('students')
    .select('class_id')
    .eq('id', studentId)
    .maybeSingle();

  if (error) {
    throw new Error(`launchLearningMapStep failed (student): ${error.message}`);
  }

  return ((data as StudentRow | null)?.class_id) ?? null;
}

async function getAssignmentOwner(
  supabase: SupabaseClient,
  activePath: ActivePathForStudent,
  studentId: string,
  classId: string | null,
): Promise<string> {
  const assignmentFilter = classId
    ? `student_id.eq.${studentId},class_id.eq.${classId}`
    : `student_id.eq.${studentId}`;

  const { data, error } = await supabase
    .from('learning_path_assignments')
    .select('assigned_by')
    .eq('path_id', activePath.path.id)
    .or(assignmentFilter)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`launchLearningMapStep failed (assignment): ${error.message}`);
  }

  return ((data as AssignmentRow | null)?.assigned_by) ?? activePath.path.createdBy;
}

async function createSourceInstance(
  adminSupabase: SupabaseClient,
  input: {
    step: StudentPathStepView;
    studentId: string;
    classId: string | null;
    createdBy: string;
    config: unknown;
  },
): Promise<ActivityInstanceRow | null> {
  const { data, error } = await adminSupabase
    .from('activity_instances')
    .insert({
      type_id: input.step.targetActivityType,
      config: input.config,
      assigned_to: input.studentId,
      class_id: input.classId,
      created_by: input.createdBy,
      source_learning_path_step_id: input.step.id,
    })
    .select(ACTIVITY_INSTANCE_SELECT)
    .maybeSingle();

  if (error) {
    const code = 'code' in error ? error.code : undefined;
    if (code === '23505') {
      return findSourceInstance(adminSupabase, input.step.id, input.studentId);
    }
    throw new Error(`launchLearningMapStep failed (insert): ${error.message}`);
  }

  return (data as ActivityInstanceRow | null) ?? null;
}
