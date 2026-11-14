import { notFound } from 'next/navigation';
import {
  getAssignmentsForPath,
  getPathById,
  getStepsForPath,
} from '@/features/learning-paths/server';
import { PathBuilder } from '@/features/learning-paths';
import { getTeacherPathAssignmentOptions } from '../teacher-path-page-data';
import { requireTeacherPathPageContext } from '../teacher-path-page-auth';

interface TeacherPathBuilderPageProps {
  params: Promise<{ pathId: string }>;
}

export default async function TeacherPathBuilderPage({
  params,
}: TeacherPathBuilderPageProps) {
  const { pathId } = await params;
  const { supabase, user } = await requireTeacherPathPageContext();

  const [path, steps, assignments, activityTypesResult, assignmentOptions] = await Promise.all([
    getPathById(supabase, user.id, pathId),
    getStepsForPath(supabase, pathId),
    getAssignmentsForPath(supabase, pathId),
    supabase
      .from('activity_types')
      .select('type_id, display_name, category')
      .order('display_name', { ascending: true }),
    getTeacherPathAssignmentOptions(supabase, user.id),
  ]);

  if (!path) notFound();

  return (
    <PathBuilder
      key={`${path.id}:${steps.map((step) => step.id).join(':')}`}
      path={path}
      initialSteps={steps}
      activityTypes={(activityTypesResult.data ?? []).map((activityType) => ({ 
        typeId: activityType.type_id,
        displayName: activityType.display_name,
        category: activityType.category,
      }))}
      classes={assignmentOptions.classOptions}
      students={assignmentOptions.studentOptions}
      assignments={assignments}
    />
  );
}
