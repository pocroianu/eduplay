import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/shared/lib/constants'
import {
  TeacherDashboardContent,
  type TeacherDashboardContentProps,
} from './TeacherDashboardContent'

const dashboardProps: TeacherDashboardContentProps = {
  profile: {
    id: 'teacher-1',
    full_name: 'Ana Popescu',
    email: 'ana@example.test',
    role: 'teacher',
    avatar_url: null,
  },
  stats: {
    studentCount: 2,
    classCount: 1,
    gameCount: 4,
  },
  classes: [
    {
      id: 'class-1',
      name: 'Clasa I',
      grade_level: 'grade-1',
      is_active: true,
    },
  ],
  countByClass: {
    'class-1': 2,
  },
  studentSummaries: [
    {
      id: 'student-1',
      name: 'Maria Ionescu',
      avatarUrl: null,
      className: 'Clasa I',
      completedGames: 4,
      inProgressGames: 0,
      totalGames: 5,
      averageScore: 92,
      lastActivityAt: '2026-05-21T08:30:00.000Z',
      focusArea: 'Matematică',
    },
    {
      id: 'student-2',
      name: 'Vlad Stan',
      avatarUrl: null,
      className: 'Clasa I',
      completedGames: 1,
      inProgressGames: 1,
      totalGames: 4,
      averageScore: 48,
      lastActivityAt: '2026-05-21T08:35:00.000Z',
      focusArea: 'Română',
    },
  ],
  recentActivity: [
    {
      id: 'activity-1',
      studentName: 'Maria Ionescu',
      studentAvatarUrl: null,
      gameTitle: 'Numărăm până la 10',
      timestamp: '2026-05-21T08:30:00.000Z',
      score: 94,
      status: 'completed',
    },
  ],
  weeklyActivity: [],
  subjectSnapshot: [
    { label: 'Matematică', value: 82, note: 'Ritm bun', color: 'blue' },
    {
      label: 'Limba română',
      value: 64,
      note: 'Mai are nevoie de citire',
      color: 'coral',
    },
  ],
}

function renderDashboard(props: TeacherDashboardContentProps = dashboardProps) {
  return render(
    <MantineProvider>
      <TeacherDashboardContent {...props} />
    </MantineProvider>,
  )
}

const globalsCss = () => readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')
const componentCss = () =>
  readFileSync(join(process.cwd(), 'src/features/teacher-dashboard/components/TeacherDashboardContent.module.css'), 'utf8')

const cssRuleStartingAt = (css: string, selector: string) => {
  const selectorIndex = css.indexOf(selector)
  if (selectorIndex === -1) return ''

  const openBraceIndex = css.indexOf('{', selectorIndex)
  if (openBraceIndex === -1) return ''

  const closeBraceIndex = css.indexOf('}', openBraceIndex)
  return closeBraceIndex === -1 ? '' : css.slice(openBraceIndex + 1, closeBraceIndex)
}

describe('TeacherDashboardContent', () => {
  it('renders the teacher home surface as the main landmark', () => {
    renderDashboard()

    const main = screen.getByRole('main', { name: /acasă profesor/i })

    expect(main).toHaveAttribute('data-testid', 'teacher-home')
  })

  it('renders the Mantine teacher home reference structure', () => {
    renderDashboard()

    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.queryByText(/bună, ana/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/învățătoare/i)).not.toBeInTheDocument()

    const actions = screen.getByRole('region', { name: /acțiuni rapide/i })
    expect(within(actions).queryByRole('heading', { name: /acțiuni rapide/i })).not.toBeInTheDocument()
    expect(within(actions).getAllByRole('link')).toHaveLength(3)
    expect(within(actions).getByRole('link', { name: /postează în jurnal/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS_JOURNAL_NEW('class-1'),
    )
    expect(within(actions).queryByRole('link', { name: /mesaje/i })).not.toBeInTheDocument()

    const discovery = screen.getByRole('region', { name: /activități gata de predat/i })
    expect(
      within(discovery).getByRole('heading', {
        name: /găsește activități gata de predat/i,
      }),
    ).toBeInTheDocument()
    expect(
      within(discovery).getByRole('searchbox', {
        name: /caută activități/i,
      }),
    ).toBeInTheDocument()
    expect(
      within(discovery).getByRole('heading', {
        name: /activități populare din comunitate/i,
      }),
    ).toBeInTheDocument()
    expect(within(discovery).getByRole('link', { name: /vezi biblioteca/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.LIBRARIES_EXPLORE,
    )

    const classes = screen.getByRole('region', { name: /clasele mele/i })
    expect(within(classes).getByRole('link', { name: /clasa i/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS('class-1'),
    )

    const resources = screen.getByRole('region', { name: /resurse pentru profesori/i })
    expect(within(resources).getAllByRole('link')).toHaveLength(4)

    expect(screen.queryByRole('region', { name: /flux clasă/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/reușite recente/i)).not.toBeInTheDocument()
  })

  it('does not depend on legacy EduPlay home utility classes', () => {
    const { container } = renderDashboard()

    expect(container.querySelector('.seesaw-home')).not.toBeInTheDocument()
    expect(container.querySelector('.seesaw-action-card')).not.toBeInTheDocument()
    expect(container.querySelector('.seesaw-community-card')).not.toBeInTheDocument()
    expect(container.querySelector('.seesaw-class-card')).not.toBeInTheDocument()
    expect(container.querySelector('.seesaw-resource-card')).not.toBeInTheDocument()
  })

  it('keeps the home content centered and scroll-contained below the persistent dashboard chrome with Mantine layout primitives', () => {
    const { container } = renderDashboard()
    const home = screen.getByTestId('teacher-home')
    const column = screen.getByTestId('teacher-home-column')

    expect(home).toHaveStyle({
      height: 'calc(100vh - 68px)',
      overflowY: 'auto',
    })
    expect(column).toHaveStyle({
      width: 'min(1520px, calc(100% - 48px))',
      marginInline: 'auto',
    })
    expect(container.querySelector('.mantine-TextInput-input')).toBeInTheDocument()
    expect(container.querySelectorAll('.mantine-Button-root')).toHaveLength(3)
    expect(container.querySelectorAll('.mantine-Card-root').length).toBeGreaterThanOrEqual(8)
  })

  it('adds Libraries-style hover feedback to primary teacher home interactions', () => {
    const { container } = renderDashboard()
    const css = componentCss()
    const hoverRule = cssRuleStartingAt(css, '.interactive')
    const surfaceHoverRule = cssRuleStartingAt(css, '.surfaceInteractive:hover')
    const actionHoverRule = cssRuleStartingAt(css, '.actionInteractive:hover')

    expect(container.querySelectorAll('.teacher-home-interactive').length).toBeGreaterThanOrEqual(13)
    expect(container.querySelector('.teacher-home-input-interactive')).toBeInTheDocument()
    expect(container.querySelectorAll('.mantine-Card-root.teacher-home-interactive').length).toBeGreaterThanOrEqual(8)
    expect(globalsCss()).not.toContain('.teacher-home-surface-interactive.mantine-Card-root')
    expect(hoverRule).toContain('transition:')
    expect(hoverRule).toContain('background-color 150ms cubic-bezier(0.4, 0, 0.2, 1)')
    expect(hoverRule).toContain('box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1)')
    expect(surfaceHoverRule).toContain('background-color: var(--color-surface-hover);')
    expect(surfaceHoverRule).toContain('box-shadow: var(--shadow-soft);')
    expect(actionHoverRule).toContain('box-shadow: var(--shadow-soft);')
    expect(actionHoverRule).toContain('filter: brightness(0.96);')
    expect(hoverRule).not.toContain('transform')
  })
})
