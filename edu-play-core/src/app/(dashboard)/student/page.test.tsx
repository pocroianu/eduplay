import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectMantineSkeletonLoading } from '@/test-utils/source-file-guards'
import type { StudentDashboardData } from '@/features/student-dashboard/server'

const getStudentDashboardDataMock = vi.fn<() => Promise<StudentDashboardData | null>>()

vi.mock('@/features/student-dashboard/server', () => ({
  getStudentDashboardData: () => getStudentDashboardDataMock(),
}))

vi.mock('@/features/student-dashboard', () => ({
  PreschoolDashboard: () => <div data-testid="preschool-dashboard" />,
  SchoolAgeDashboard: () => <div data-testid="school-age-dashboard" />,
}))

vi.mock('@/lib/i18n/server', () => ({
  getServerLanguage: () => Promise.resolve('ro'),
  preloadNamespaces: () => Promise.resolve({}),
}))

vi.mock('@/lib/i18n/I18nProvider', () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/shared/components/ui/kit', () => ({
  DashboardShell: ({
    children,
    navItems,
  }: {
    children: React.ReactNode
    navItems?: unknown[]
  }) => (
    <div data-nav-count={navItems?.length ?? 0} data-testid="dashboard-shell">
      {children}
    </div>
  ),
}))

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`)
  },
}))

import StudentDashboard from './page'

describe('/student page', () => {
  beforeEach(() => {
    getStudentDashboardDataMock.mockReset()
  })

  it.each([
    ['student dashboard', 'src/app/(dashboard)/student/loading.tsx'],
    ['student activities', 'src/app/(dashboard)/student/activities/loading.tsx'],
    ['student games redirect', 'src/app/(dashboard)/student/games/loading.tsx'],
  ])('uses Mantine skeletons instead of Tailwind pulse classes on %s loading', (_label, filePath) => {
    expectMantineSkeletonLoading(filePath)
  })

  it('keeps DashboardShell navigation mounted for school-age Quest Map students', async () => {
    getStudentDashboardDataMock.mockResolvedValue({
      variant: 'school-age',
      profile: {
        full_name: 'Matei Ionescu',
        avatar_url: null,
      },
      className: '3A',
      primarySubject: 'Matematică',
      stats: {
        lives: 5,
        weeklyXp: 120,
        streak: 2,
      },
      units: [],
      lessons: [],
    })

    const ui = await StudentDashboard()
    render(ui)

    expect(screen.getByTestId('dashboard-shell')).toHaveAttribute('data-nav-count', '5')
    expect(screen.getByTestId('school-age-dashboard')).toBeInTheDocument()
  })
})
