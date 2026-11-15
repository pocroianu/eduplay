import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ROUTES } from '@/shared/lib/constants'

const redirectError = (path: string) => {
  const err = new Error(`NEXT_REDIRECT:${path}`)
  ;(err as Error & { __redirect__: string }).__redirect__ = path
  return err
}

const redirectMock = vi.fn((path: string) => {
  throw redirectError(path)
})
const getTeacherDashboardDataMock = vi.fn()

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}))

vi.mock('@/features/teacher-dashboard/server', () => ({
  getTeacherDashboardData: () => getTeacherDashboardDataMock(),
}))

const resources = {
  ro: {
    teacher: {
      dashboard: {
        home: {
          actions: {
            ariaLabel: 'Acțiuni rapide',
            postJournal: {
              title: 'Postează în jurnal',
              body: 'Un portofoliu cu poze, video și notițe',
            },
            createActivity: {
              title: 'Creează activitate',
              body: 'Cu răspunsuri multimedia captivante',
            },
            generateActivity: {
              title: 'Generează activitate',
              body: 'Pornește rapid cu EduPlay AI',
            },
          },
          library: {
            ariaLabel: 'Activități gata de predat',
            title: 'Găsește activități gata de predat pentru {{grade}}',
            gradeFallback: 'clasa ta',
            searchPlaceholder: 'Caută activități pentru citire, matematică, științe',
            popularTitle: 'Activități populare din comunitate în {{grade}}',
            viewAll: 'Vezi biblioteca',
            recentMeta: 'Din activitatea clasei',
            subjectMeta: 'Activitate',
            assessmentMeta: 'Evaluare',
            fallbackCards: {
              reading: {
                title: 'Potrivește sunetul lung',
                creator: 'Biblioteca EduPlay',
              },
              assessment: {
                title: 'Citire ghidată cu întrebări',
                creator: 'Comunitate',
              },
              math: {
                title: 'Adunări rapide până la 20',
                creator: 'Biblioteca EduPlay',
              },
              science: {
                title: 'Sortează animalele după habitat',
                creator: 'Comunitate',
              },
            },
          },
          classes: {
            ariaLabel: 'Clasele mele',
            title: 'Clasele mele',
            createClass: 'Creează clasă',
            openClass: 'Deschide clasa {{name}}',
            openCta: 'Deschide',
            studentOne: '{{count}} elev',
            studentOther: '{{count}} elevi',
            emptyTitle: 'Încă nu ai clase',
            emptyFilteredTitle: 'Clasele apar aici',
            emptyBody: 'Creează o clasă ca să vezi activitățile și progresul elevilor.',
          },
          resources: {
            ariaLabel: 'Resurse pentru profesori',
            title: 'Resurse pentru profesori',
            viewAll: 'Vezi toate',
            spotlight: {
              title: 'Spotlight EduPlay',
              meta: 'Video',
            },
            learning: {
              title: 'Centrul de învățare',
              meta: 'Website',
            },
            topics: {
              title: 'Subiecte de sezon',
              meta: 'Website',
            },
            community: {
              title: 'Comunitate și evenimente',
              meta: 'Website',
            },
          },
        },
      },
      classes: {
        gradeLevel: {
          'grade-1': 'Clasa I',
        },
      },
    },
  },
} as const

vi.mock('@/lib/i18n/server', () => ({
  getServerLanguage: () => Promise.resolve('ro'),
  preloadNamespaces: () => Promise.resolve(resources),
}))

import TeacherDashboard from './page'

const dashboardData = {
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
  subjectSnapshot: [],
} as const

beforeEach(() => {
  vi.clearAllMocks()
  getTeacherDashboardDataMock.mockResolvedValue(dashboardData)
})

describe('/teacher dashboard', () => {
  it('renders the upload-first teacher home entry regions', async () => {
    const ui = await TeacherDashboard()
    render(<MantineProvider>{ui}</MantineProvider>)

    const quickActions = screen.getByRole('region', { name: /acțiuni rapide/i })
    expect(within(quickActions).getByRole('link', { name: /creează activitate/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.ACTIVITY_CREATE,
    )

    const library = screen.getByRole('region', { name: /activități gata de predat/i })
    expect(within(library).getByRole('link', { name: /vezi biblioteca/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.LIBRARIES_EXPLORE,
    )

    const classes = screen.getByRole('region', { name: /clasele mele/i })
    expect(within(classes).getByRole('link', { name: /clasa i/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS('class-1'),
    )
    expect(screen.getByRole('region', { name: /resurse pentru profesori/i })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /flux clasă/i })).not.toBeInTheDocument()
  })
})
