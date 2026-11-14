import { redirect } from 'next/navigation';
import { ROUTES } from '@/shared/lib/constants';
import { DashboardShell } from '@/shared/components/ui/kit';
import { STUDENT_NAV_ITEMS } from '@/features/student-dashboard/config';
import { formatAgeBand } from '@/shared/lib/utils/age';
import { StudentProfileContent } from '@/features/student-profile';
import { getStudentProfileSummary } from '@/features/student-profile/server';

export default async function StudentProfilePage() {
  const summary = await getStudentProfileSummary();

  if (!summary) {
    redirect(ROUTES.AUTH.LOGIN);
  }

  const levelLabel = formatAgeBand(summary.ageBand);

  return (
    <DashboardShell
      variant="student"
      profile={{
        full_name: summary.full_name,
        avatar_url: summary.avatar_url,
      }}
      navItems={STUDENT_NAV_ITEMS}
      levelLabel={levelLabel}
      topBar={{ showLogo: true, title: 'Profilul meu' }}
    >
      <StudentProfileContent profile={summary} />
    </DashboardShell>
  );
}
