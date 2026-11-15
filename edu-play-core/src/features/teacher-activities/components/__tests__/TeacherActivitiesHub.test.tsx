import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/components/ui/kit'
import { TeacherActivitiesHub } from '../TeacherActivitiesHub'
import type { TeacherOwnedActivity } from '../../types'
import type { Game } from '@/features/games/types'

const navigationMocks = vi.hoisted(() => ({
  push: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navigationMocks.push }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('../ArchiveActivityForm', () => ({
  ArchiveActivityForm: ({ activityId }: { activityId: string }) => (
    <form>
      <input type="hidden" name="activityId" value={activityId} />
      <button type="submit">Arhivează</button>
    </form>
  ),
}))

vi.mock('../DuplicateActivityForm', () => ({
  DuplicateActivityForm: ({ activityId }: { activityId: string }) => (
    <form>
      <input type="hidden" name="activityId" value={activityId} />
      <button type="submit">Duplică</button>
    </form>
  ),
}))

vi.mock('../MakeActivityReadyForm', () => ({
  MakeActivityReadyForm: ({ activityId }: { activityId: string }) => (
    <form>
      <input type="hidden" name="activityId" value={activityId} />
      <button type="submit">Marchează ca gata</button>
    </form>
  ),
}))

vi.mock('../PreviewActivityForm', () => ({
  PreviewActivityForm: ({ activityId }: { activityId: string }) => (
    <form>
      <input type="hidden" name="activityId" value={activityId} />
      <button type="submit">Previzualizează</button>
    </form>
  ),
}))

vi.mock('../RestoreActivityForm', () => ({
  RestoreActivityForm: ({ activityId }: { activityId: string }) => (
    <form>
      <input type="hidden" name="activityId" value={activityId} />
      <button type="submit">Restaurează</button>
    </form>
  ),
}))

vi.mock('../../actions', () => ({
  archiveTeacherActivity: vi.fn(),
  createTeacherActivityPreview: vi.fn(),
  duplicateTeacherActivity: vi.fn(),
}))

vi.mock('../ActivityCardMenu', () => ({
  ActivityCardMenu: ({
    items,
  }: {
    items: Array<{
      key: string
      label: ReactNode
      disabled?: boolean
      destructive?: boolean
      onSelect: () => void
    }>
  }) => (
    <div data-testid="card-menu">
      {items.map((item) => (
        <button key={item.key} type="button" disabled={item.disabled} onClick={item.onSelect}>
          {item.label}
        </button>
      ))}
    </div>
  ),
}))

function TestProviders({ children }: { children: ReactNode }) {
  return (
    <MantineProvider>
      <ToastProvider>{children}</ToastProvider>
    </MantineProvider>
  )
}

function renderHub(element: ReactElement) {
  return render(element, { wrapper: TestProviders })
}

const draftActivity: TeacherOwnedActivity = {
  id: 'draft-1',
  title: 'Povestea personajului meu',
  template: 'free-response',
  status: 'draft',
  visibilityScope: 'private',
  updatedAt: '2026-05-19T10:00:00.000Z',
  createdAt: '2026-05-19T09:00:00.000Z',
  configData: {
    prompt: 'Desenează și povestește.',
    allowedTools: { text: true, drawing: true, voice: true },
    shareWithFamilyOnApproval: false,
  },
}

const readyActivity: TeacherOwnedActivity = {
  ...draftActivity,
  id: 'ready-1',
  title: 'Activitate gata',
  status: 'published',
}

const archivedActivity: TeacherOwnedActivity = {
  ...draftActivity,
  id: 'archived-1',
  title: 'Activitate veche',
  status: 'archived',
}

const libraryActivity: Game = {
  id: 'library-1',
  title: 'Litere magice',
  description: 'Activitate publică',
  template: 'matching-game',
  thumbnail_url: null,
  game_url: '/play/library-1',
  category: 'literacy',
  difficulty_level: 1,
  target_age_min: null,
  target_age_max: null,
  estimated_duration: null,
  learning_objectives: null,
  is_published: true,
  created_at: '2026-05-18T00:00:00.000Z',
  updated_at: '2026-05-18T00:00:00.000Z',
}

const teacherLibraryChromeFiles = [
  'src/features/teacher-activities/components/TeacherActivitiesHub.tsx',
  'src/features/games/components/TeacherGamesPageContent.tsx',
  'src/app/(dashboard)/teacher/libraries/explore/page.tsx',
  'src/app/(dashboard)/teacher/library/page.tsx',
]

describe('<TeacherActivitiesHub />', () => {
  beforeEach(() => {
    navigationMocks.push.mockClear()
  })

  it('keeps the public library as the default tab', async () => {
    const user = userEvent.setup()

    renderHub(
      <TeacherActivitiesHub
        activeTab="library"
        statusFilter="all"
        libraryActivities={[libraryActivity]}
        ownedActivities={[draftActivity]}
      />,
    )

    const sourceGroup = screen.getByRole('group', { name: /alege sursa activităților/i })
    expect(within(sourceGroup).getByRole('button', { name: /bibliotecă eduplay/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(sourceGroup).getByRole('button', { name: /bibliotecă eduplay/i })).toHaveTextContent('1')
    expect(within(sourceGroup).getByRole('button', { name: /activitățile mele/i })).toHaveTextContent('1')
    await user.click(within(sourceGroup).getByRole('button', { name: /activitățile mele/i }))
    expect(navigationMocks.push).toHaveBeenCalledWith('/teacher/activities?tab=my')
    expect(screen.getByRole('heading', { name: 'Activități' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Explorează biblioteca EduPlay' })).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: /caută activități/i })).toHaveAttribute('placeholder', 'Ce vrei să predai?')
    expect(screen.getByRole('button', { name: /toate materiile/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('button', { name: /litere/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Colecții recomandate' })).toBeInTheDocument()
    expect(screen.getByText('Litere magice')).toBeInTheDocument()
    expect(screen.queryByText('Povestea personajului meu')).not.toBeInTheDocument()
  })

  it('uses explicit library route hrefs when provided', async () => {
    const user = userEvent.setup()

    renderHub(
      <TeacherActivitiesHub
        activeTab="my"
        statusFilter="all"
        sortBy="newest"
        libraryActivities={[libraryActivity]}
        ownedActivities={[draftActivity]}
        libraryHref="/teacher/libraries/explore"
        ownedHref="/teacher/library"
      />,
    )

    const sourceGroup = screen.getByRole('group', { name: /alege sursa activităților/i })
    expect(within(sourceGroup).getByRole('button', { name: /bibliotecă eduplay/i })).toHaveTextContent('1')
    expect(within(sourceGroup).getByRole('button', { name: /activitățile mele/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(within(sourceGroup).getByRole('button', { name: /bibliotecă eduplay/i }))
    expect(navigationMocks.push).toHaveBeenCalledWith('/teacher/libraries/explore')
    await user.click(within(sourceGroup).getByRole('button', { name: /activitățile mele/i }))
    expect(navigationMocks.push).toHaveBeenCalledWith('/teacher/library')
    expect(
      within(screen.getByRole('group', { name: /filtrează activitățile mele după status/i })).getByRole('button', {
        name: /toate active/i,
      }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(within(screen.getByRole('group', { name: /sortare/i })).getByRole('button', { name: /cele mai recente/i }))
      .toHaveAttribute('aria-pressed', 'true')
  })

  it('shows teacher-owned draft activities when the draft filter is active', () => {
    renderHub(
      <TeacherActivitiesHub
        activeTab="my"
        statusFilter="draft"
        libraryActivities={[libraryActivity]}
        ownedActivities={[draftActivity, readyActivity]}
      />,
    )

    const sourceGroup = screen.getByRole('group', { name: /alege sursa activităților/i })
    expect(within(sourceGroup).getByRole('button', { name: /activitățile mele/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('heading', { name: 'Biblioteca mea' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Activitățile mele recente' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /toate nivelurile/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /toate materiile/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /toate limbile/i })).toBeDisabled()
    expect(screen.getByRole('searchbox', { name: /caută în activitățile mele/i })).toHaveAttribute('placeholder', 'Caută')
    expect(screen.getByRole('searchbox', { name: /caută în activitățile mele/i })).toHaveClass(
      'mantine-TextInput-input',
    )
    expect(screen.getByRole('link', { name: /creează o activitate sau o evaluare automată/i })).toHaveAttribute(
      'href',
      '/teacher/activities/create',
    )
    expect(screen.getByRole('link', { name: /vezi tot/i })).toHaveAttribute('href', '/teacher/activities?tab=my&view=all')
    expect(screen.getByText(/ai nevoie de idei/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /răsfoiește biblioteca comunității/i })).toHaveAttribute('href', '/teacher/libraries/explore')
    expect(screen.getByText(/colecțiile mele \(0\)/i)).toBeInTheDocument()
    expect(screen.getByText('Activități care nu sunt într-o colecție')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^creează$/i })).toBeDisabled()
    expect(
      within(screen.getByRole('group', { name: /filtrează activitățile mele după status/i })).getByRole('button', {
        name: /ciorne/i,
      }),
    ).toHaveAttribute('aria-pressed', 'true')

    const card = screen.getByRole('heading', { name: 'Povestea personajului meu' }).closest('article, div')
    expect(screen.getByText('Povestea personajului meu')).toBeInTheDocument()
    expect(screen.getByText('Ciornă')).toBeInTheDocument()
    expect(screen.getByText('Răspuns liber')).toBeInTheDocument()
    expect(screen.getByText(/actualizată/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /continuă editarea/i })).toHaveAttribute(
      'href',
      '/teacher/activities/draft-1/edit',
    )
    expect(screen.getByText('Desenează și povestește.')).toBeInTheDocument()
    expect(screen.getByText(/Pas următor: continuă editarea/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /previzualizează/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /duplică/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /marchează ca gata/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /arhivează/i })).toBeEnabled()
    expect(screen.getAllByDisplayValue('draft-1')).toHaveLength(1)
    expect(card).not.toBeNull()
    expect(screen.queryByText('Activitate gata')).not.toBeInTheDocument()
    expect(screen.queryByText('Litere magice')).not.toBeInTheDocument()
  })

  it('filters owned activities from the search input', async () => {
    const user = userEvent.setup()

    renderHub(
      <TeacherActivitiesHub
        activeTab="my"
        statusFilter="all"
        libraryActivities={[]}
        ownedActivities={[draftActivity, readyActivity]}
      />,
    )

    await user.type(screen.getByRole('searchbox', { name: /caută în activitățile mele/i }), 'gata')

    expect(screen.getByRole('heading', { name: 'Activitate gata' })).toBeInTheDocument()
    expect(screen.queryByText('Povestea personajului meu')).not.toBeInTheDocument()
  })

  it('hides archived activities from the active filter and shows them in the archive filter', () => {
    const { rerender } = renderHub(
      <TeacherActivitiesHub
        activeTab="my"
        statusFilter="all"
        libraryActivities={[]}
        ownedActivities={[draftActivity, archivedActivity]}
      />,
    )

    expect(
      within(screen.getByRole('group', { name: /filtrează activitățile mele după status/i })).getByRole('button', {
        name: /active/i,
      }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Povestea personajului meu')).toBeInTheDocument()
    expect(screen.queryByText('Activitate veche')).not.toBeInTheDocument()

    rerender(
      <TeacherActivitiesHub
        activeTab="my"
        statusFilter="archived"
        libraryActivities={[]}
        ownedActivities={[draftActivity, archivedActivity]}
      />,
    )

    expect(
      within(screen.getByRole('group', { name: /filtrează activitățile mele după status/i })).getByRole('button', {
        name: /arhivate/i,
      }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Activitate veche')).toBeInTheDocument()
    expect(screen.getAllByText('Arhivată').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /duplică/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /restaurează/i })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /^arhivată$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /previzualizează/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /arhivează/i })).not.toBeInTheDocument()
  })

  it('enables assignment only for ready owned activities', () => {
    renderHub(
      <TeacherActivitiesHub
        activeTab="my"
        statusFilter="published"
        libraryActivities={[]}
        ownedActivities={[draftActivity, readyActivity]}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Activitate gata' })).toBeInTheDocument()
    expect(screen.queryByText('Povestea personajului meu')).not.toBeInTheDocument()
    expect(screen.getByText('Gata de atribuit')).toBeInTheDocument()
    expect(screen.getByText(/Pas următor: atribuie activitatea/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /atribuie/i })).toHaveAttribute(
      'href',
      '/teacher/assignments/new?activityId=ready-1',
    )
  })

  it('summarizes owned activity workload before the filtered grid', () => {
    renderHub(
      <TeacherActivitiesHub
        activeTab="my"
        statusFilter="all"
        libraryActivities={[libraryActivity]}
        ownedActivities={[draftActivity, readyActivity, archivedActivity]}
      />,
    )

    // Filter nav shows status labels with counts
    expect(screen.getByText('Toate active')).toBeInTheDocument()
    expect(screen.getByText('Ciorne')).toBeInTheDocument()
    expect(screen.getByText('Gata')).toBeInTheDocument()
    expect(screen.getByText('Arhivate')).toBeInTheDocument()
    const sourceGroup = screen.getByRole('group', { name: /alege sursa activităților/i })
    expect(within(sourceGroup).getByRole('button', { name: /bibliotecă eduplay/i })).toHaveTextContent('1')
    expect(within(sourceGroup).getByRole('button', { name: /activitățile mele/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('keeps explicit teacher library chrome on the new EduPlay kit primitives', () => {
    const offenders = teacherLibraryChromeFiles.flatMap((relativePath) => {
      const source = readFileSync(join(process.cwd(), relativePath), 'utf8')

      return ['ChunkyButton', 'DuoCard'].flatMap((pattern) =>
        source.includes(pattern) ? [`${relativePath}: ${pattern}`] : [],
      )
    })

    expect(offenders).toEqual([])
  })

  it('keeps the owned activity controls on Mantine-backed primitives', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/teacher-activities/components/TeacherActivitiesHub.tsx'),
      'utf8',
    )

    expect(source).toContain('TextField')
    expect(source).toContain('FilterChipGroup')
    expect(source).toContain('MantineButton')
    expect(source).not.toContain('<input')
    expect(source).not.toContain('<button')
  })
})
