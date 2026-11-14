import { redirect } from 'next/navigation'
import { PreschoolDashboard, SchoolAgeDashboard } from '@/features/student-dashboard'
import { getStudentDashboardData } from '@/features/student-dashboard/server'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { getServerLanguage, preloadNamespaces } from '@/lib/i18n/server'
import { ROUTES } from '@/shared/lib/constants'
import { DashboardShell } from '@/shared/components/ui/kit'
import { STUDENT_NAV_ITEMS } from '@/features/student-dashboard/config'
import { formatAgeBand } from '@/shared/lib/utils/age'

export default async function StudentDashboard() {
  const dashboardData = await getStudentDashboardData()

  if (!dashboardData) {
    redirect(ROUTES.AUTH.LOGIN)
  }

  const lang = await getServerLanguage()
  const resources = await preloadNamespaces(lang, ['common', 'student'])

  if (dashboardData.variant === 'preschool') {
    const { profile } = dashboardData
    const levelLabel = formatAgeBand('3-6')
    const { variant, ...props } = dashboardData
    void variant

    return (
      <I18nProvider lang={lang} resources={resources}>
        <DashboardShell
          variant="student"
          profile={{
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
          }}
          navItems={STUDENT_NAV_ITEMS}
          levelLabel={levelLabel}
          topBar={{ showLogo: true }}
        >
          <PreschoolDashboard {...props} />
        </DashboardShell>
      </I18nProvider>
    )
  }

  const { variant, ...props } = dashboardData
  void variant

  return (
    <I18nProvider lang={lang} resources={resources}>
      <DashboardShell
        variant="student"
        profile={{
          full_name: props.profile.full_name,
          avatar_url: props.profile.avatar_url,
        }}
        navItems={STUDENT_NAV_ITEMS}
        levelLabel={formatAgeBand('7-12')}
        topBar={{ showLogo: true }}
      >
        <SchoolAgeDashboard {...props} />
      </DashboardShell>
    </I18nProvider>
  )
}
