import { getClassPathProgress } from '@/features/learning-paths/server';
import { ClassPathProgressMatrix } from '@/features/learning-paths';
import { requireTeacherPathPageContext } from '../../../../paths/teacher-path-page-auth';

interface TeacherClassPathProgressPageProps {
  params: Promise<{ classId: string; pathId: string }>;
}

export const metadata = {
  title: 'Progres parcurs · EduPlay',
};

export default async function TeacherClassPathProgressPage({
  params,
}: TeacherClassPathProgressPageProps) {
  const { classId, pathId } = await params;
  const { supabase } = await requireTeacherPathPageContext();

  const result = await getClassPathProgress(supabase, pathId, classId);

  return (
    <ClassPathProgressMatrix
      classId={classId}
      pathId={pathId}
      result={result}
    />
  );
}
