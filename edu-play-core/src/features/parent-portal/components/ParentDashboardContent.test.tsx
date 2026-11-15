import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { ParentDashboardContent } from './ParentDashboardContent'

vi.mock('framer-motion', () => ({
  motion: {
    create: (component: unknown) => component,
    div: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
  },
  useReducedMotion: () => true,
}))

const props = {
  profile: {
    id: 'parent-1',
    full_name: 'Ana Popescu',
    email: 'ana@example.test',
    role: 'parent',
    avatar_url: null,
  },
  linkedChildren: [
    {
      id: 'child-1',
      name: 'Maria Ionescu',
      avatarUrl: null,
      relationshipType: 'mother',
      linkedAt: '2026-05-01T00:00:00.000Z',
      stats: {
        totalGamesPlayed: 6,
        completedGames: 6,
        inProgressGames: 0,
        averageScore: 88,
        totalPlayTime: 42,
        lastActivityAt: '2026-05-22T10:00:00.000Z',
      },
    },
  ],
  recentActivity: [],
  aggregateStats: {
    totalChildren: 1,
    totalGamesPlayed: 6,
    averageScore: 88,
    totalPlayTime: 42,
  },
  feedItems: [],
  activeChildId: null,
}

const resources = {
  en: {
    parent: {
      dashboard: {
        addChild: 'Add child',
        recommendation: { label: 'Recommendation' },
        stats: {
          connectedChildren: 'Connected Children',
          gamesPlayed: 'Games Played',
          averageScore: 'Average Score',
        },
        familyShell: {
          eyebrow: 'Family EduPlay',
          childrenHeading: 'Copiii mei',
          summary: 'Follow your children in a simple feed, similar to class messages.',
          threadsTitle: 'Family Threads',
          feedTitle: 'Family Feed',
          detailsTitle: 'For Families',
          connectedChildren: 'Connected Children',
          addAnotherChild: 'Add Another Child',
        },
      },
    },
  },
} as const

describe('ParentDashboardContent', () => {
  it('renders the EduPlay family thread shell', () => {
    render(
      <I18nProvider lang="en" resources={resources}>
        <ParentDashboardContent {...props} />
      </I18nProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Copiii mei', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Family EduPlay')).toBeInTheDocument()
    expect(screen.getAllByText('Connected Children').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Add Another Child')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Family Threads' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Family Feed' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'For Families' })).toBeInTheDocument()
    expect(screen.getByText('Recommendation')).toBeInTheDocument()
    const main = screen.getByRole('main')
    expect(main).toHaveClass('bg-surface')

    const dashboardShell = screen.getByTestId('parent-dashboard-shell')
    expect(dashboardShell).toHaveClass('rounded-xl', 'bg-surface-container-lowest', 'shadow-soft-sm')
    const parentCards = [
      ...screen.getAllByTestId('parent-overview-card'),
      screen.getByTestId('parent-action-card'),
      ...screen.getAllByTestId('parent-detail-card'),
    ]
    expect(parentCards.length).toBeGreaterThan(0)
    for (const card of parentCards) {
      expect(card).toHaveClass('mantine-Card-root', 'rounded-xl', 'shadow-soft-sm')
    }
  })

  it('uses the shared EduPlay focus ring for dashboard links', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'src/features/parent-portal/components/ParentDashboardContent.tsx',
      ),
      'utf8',
    )

    expect(source).toContain('SEESAW_FOCUS_RING_CLASS')
    expect(source).not.toContain('focus-visible:outline-blue')
  })
})
