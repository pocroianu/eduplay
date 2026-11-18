import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MantineProvider } from '@mantine/core'
import type { ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const redirectError = (path: string) => {
  const err = new Error(`NEXT_REDIRECT:${path}`)
  ;(err as Error & { __redirect__: string }).__redirect__ = path
  return err
}

const redirectMock = vi.fn((path: string) => {
  throw redirectError(path)
})
const createClientMock = vi.fn()
const getPublishedGamesMock = vi.fn()
const getTeacherOwnedActivitiesMock = vi.fn()
const routerPushMock = vi.fn()
const routerReplaceMock = vi.fn()
let searchParams = ''

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
  useRouter: () => ({ push: routerPushMock, replace: routerReplaceMock }),
  useSearchParams: () => new URLSearchParams(searchParams),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => createClientMock(),
}))

vi.mock('@/features/games/server', () => ({
  getPublishedGames: () => getPublishedGamesMock(),
}))

vi.mock('@/features/teacher-activities/server', () => ({
  getTeacherOwnedActivities: (...args: unknown[]) => getTeacherOwnedActivitiesMock(...args),
}))

vi.mock('@/lib/i18n/server', () => ({
  getServerLanguage: () => Promise.resolve('ro'),
  preloadNamespaces: () => Promise.resolve({}),
}))

vi.mock('@/lib/i18n/I18nProvider', () => ({
  I18nProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

function makeSupabase(profileRole = 'teacher') {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'teacher-1' } } }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { role: profileRole } }),
    })),
  }
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

const inlineStylePropertyNames = (element: Element) =>
  (element.getAttribute('style') ?? '')
    .split(';')
    .map((declaration) => declaration.slice(0, declaration.indexOf(':')).trim())
    .filter(Boolean)

const expectNoInlineHoverOverrides = (elements: Iterable<Element>, forbiddenProperties: readonly string[]) => {
  const forbidden = new Set(forbiddenProperties)

  for (const element of elements) {
    expect(inlineStylePropertyNames(element).filter((property) => forbidden.has(property))).toEqual([])
  }
}

function renderWithMantine(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>)
}

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

import ExploreLibrariesPage from './page'
import MyLibraryPage from '../../library/page'

beforeEach(() => {
  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: TestResizeObserver,
  })
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: TestResizeObserver,
  })
  vi.clearAllMocks()
  searchParams = ''
  createClientMock.mockReturnValue(makeSupabase())
  getPublishedGamesMock.mockResolvedValue([])
  getTeacherOwnedActivitiesMock.mockResolvedValue([])
})
const ownedActivity = {
  id: 'activity-1',
  title: 'Povestea personajului meu',
  template: 'free-response',
  status: 'published',
  visibilityScope: 'private',
  updatedAt: '2026-05-01T10:00:00.000Z',
  createdAt: '2026-04-30T10:00:00.000Z',
  configData: { prompt: 'Desenează un personaj și spune ce puteri are.' },
} as const

const publicGame = {
  id: 'game-1',
  title: 'Exersează sunetul M',
  description: 'Elevii ascultă, aleg și explică sunetul inițial.',
  thumbnail_url: null,
  game_url: '/games/game-1/index.html',
  category: 'phonics',
  difficulty_level: 1,
  target_age_min: 6,
  target_age_max: 8,
  estimated_duration: 10,
  learning_objectives: ['Sunete inițiale'],
  is_published: true,
  created_at: '2026-05-10T10:00:00.000Z',
  updated_at: '2026-05-10T10:00:00.000Z',
} as const

const upperGradeGame = {
  ...publicGame,
  id: 'game-2',
  title: 'Descoperă fracțiile',
  description: 'Elevii împart forme și compară părți egale.',
  game_url: '/games/game-2/index.html',
  category: 'math',
  target_age_min: 9,
  target_age_max: 10,
} as const

describe('/teacher/libraries/explore page', () => {
  it('renders the Mantine-rewritten Explore Libraries page with the previous visual structure below top-panel source tabs', async () => {
    getPublishedGamesMock.mockResolvedValue([publicGame])

    const ui = await ExploreLibrariesPage()
    const { container } = renderWithMantine(ui)

    expect(screen.queryByRole('heading', { name: 'Biblioteci', level: 1 })).not.toBeInTheDocument()

    const content = screen.getByTestId('library-explore-content')
    expect(content).toHaveClass('teacher-scroll-page')
    expect(within(content).queryByRole('tablist', { name: /surse bibliotecă/i })).not.toBeInTheDocument()
    expect(within(content).getByRole('heading', { name: 'Ce vrei să predai?', level: 2 })).toBeInTheDocument()
    expect(within(content).getByRole('searchbox', { name: 'Caută' })).toBeInTheDocument()
    expect(within(content).getByRole('searchbox', { name: 'Caută' })).toHaveClass('mantine-Input-input')
    expect(within(content).getByRole('search')).toHaveStyle({ width: 'min(796px, 100%)' })

    expect(within(content).getByRole('button', { name: 'Toate' })).toHaveClass('mantine-UnstyledButton-root')
    expect(within(content).getByRole('button', { name: 'Sunete și litere' })).toHaveClass('mantine-UnstyledButton-root')
    expect(within(content).queryByRole('button', { name: 'Matematică' })).not.toBeInTheDocument()
    expect(within(content).queryByRole('button', { name: 'Derulează dreapta' })).not.toBeInTheDocument()
    expect(within(content).getByRole('button', { name: /Alege clasa/ })).toHaveClass('mantine-InputBase-input')
    expect(within(content).getByRole('button', { name: /Alege limba/ })).toHaveClass('mantine-InputBase-input')
    expect(within(content).queryByText(/standarde și curriculum/i)).not.toBeInTheDocument()
    expect(within(content).queryByRole('button', { name: /standarde și curriculum/i })).not.toBeInTheDocument()
    expect(within(content).queryByRole('link', { name: /standarde și curriculum/i })).not.toBeInTheDocument()
    expect(within(content).queryByRole('region', { name: /colecții recomandate/i })).not.toBeInTheDocument()

    const popular = within(content).getByRole('region', { name: /activități din biblioteca eduplay/i })
    expect(within(popular).getByRole('article', { name: /exersează sunetul m/i })).toBeInTheDocument()
    expect(within(popular).getByRole('button', { name: 'Atribuie activitatea Exersează sunetul M' })).toHaveClass('mantine-ActionIcon-root')
    expect(content.querySelector('[class*="ep-libraries"], [class*="ep-library-topic"], [class*="ep-explore-card"]')).toBeNull()
    expect(container.querySelectorAll('.teacher-libraries-interactive').length).toBeGreaterThanOrEqual(8)
    expect(container.querySelector('.teacher-libraries-input-interactive')).toBeInTheDocument()
    expect(container.querySelectorAll('.mantine-Card-root.teacher-libraries-interactive')).toHaveLength(1)
    expect(getPublishedGamesMock).toHaveBeenCalledTimes(1)
    expect(getTeacherOwnedActivitiesMock).not.toHaveBeenCalled()
  })

  it('uses Mantine dropdowns for grade and language filters', async () => {
    const user = userEvent.setup()
    getPublishedGamesMock.mockResolvedValue([publicGame, upperGradeGame])

    const ui = await ExploreLibrariesPage()
    renderWithMantine(ui)

    const content = screen.getByTestId('library-explore-content')
    const gradeFilter = within(content).getByRole('button', { name: /Alege clasa/ })
    const languageFilter = within(content).getByRole('button', { name: /Alege limba/ })
    const popular = within(content).getByRole('region', { name: /activități din biblioteca eduplay/i })

    expect(gradeFilter).toHaveClass('mantine-InputBase-input')
    expect(gradeFilter).toHaveTextContent('Alege clasa')
    expect(languageFilter).toHaveClass('mantine-InputBase-input')
    expect(languageFilter).toHaveTextContent('Alege limba')
    expect(within(popular).getByRole('article', { name: /exersează sunetul m/i })).toBeInTheDocument()
    expect(within(popular).getByRole('article', { name: /descoperă fracțiile/i })).toBeInTheDocument()

    await user.click(gradeFilter)
    await user.click(await screen.findByRole('option', { name: 'Clasa a IV-a', hidden: true }))
    expect(gradeFilter).toHaveTextContent('Clasa a IV-a')
    expect(routerReplaceMock).toHaveBeenLastCalledWith('/teacher/libraries/explore?grade=grade-4', {
      scroll: false,
    })
    expect(within(popular).queryByRole('article', { name: /exersează sunetul m/i })).not.toBeInTheDocument()
    expect(within(popular).getByRole('article', { name: /descoperă fracțiile/i })).toBeInTheDocument()

    await user.click(languageFilter)
    await user.click(await screen.findByRole('option', { name: 'Română', hidden: true }))
    expect(languageFilter).toHaveTextContent('Română')
    expect(routerReplaceMock).toHaveBeenLastCalledWith('/teacher/libraries/explore?grade=grade-4&language=ro', {
      scroll: false,
    })
  })

  it('filters by a catalog topic and persists it without adding history', async () => {
    const user = userEvent.setup()
    getPublishedGamesMock.mockResolvedValue([publicGame, upperGradeGame])
    renderWithMantine(await ExploreLibrariesPage())
    await user.click(screen.getByRole('button', { name: 'Sunete și litere' }))
    expect(routerReplaceMock).toHaveBeenLastCalledWith('/teacher/libraries/explore?topic=phonics', { scroll: false })
    expect(screen.getByRole('button', { name: 'Sunete și litere' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('article', { name: /descoperă fracțiile/i })).not.toBeInTheDocument()
  })

  it('restores known topics and treats unknown topics as all', async () => {
    getPublishedGamesMock.mockResolvedValue([publicGame, upperGradeGame])
    searchParams = 'topic=phonics'
    const first = renderWithMantine(await ExploreLibrariesPage())
    expect(screen.getByRole('button', { name: 'Sunete și litere' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('article', { name: /descoperă fracțiile/i })).not.toBeInTheDocument()
    first.unmount()
    searchParams = 'topic=unknown'
    renderWithMantine(await ExploreLibrariesPage())
    expect(screen.getByRole('button', { name: 'Toate' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('article')).toHaveLength(2)
  })

  it('pushes assignment navigation with the existing assignment context', async () => {
    const user = userEvent.setup()
    searchParams = 'classId=class-1&assignTo=class'
    getPublishedGamesMock.mockResolvedValue([publicGame])
    renderWithMantine(await ExploreLibrariesPage())
    await user.click(screen.getByRole('button', { name: 'Atribuie activitatea Exersează sunetul M' }))
    expect(routerPushMock).toHaveBeenCalledWith('/teacher/assignments/new?activityId=game-1&assignTo=class&classId=class-1')
  })

  it('reveals more results and resets the page size when searching', async () => {
    const user = userEvent.setup()
    getPublishedGamesMock.mockResolvedValue(Array.from({ length: 30 }, (_, i) => ({ ...publicGame, id: `game-${i}`, title: `Activitate ${i}` })))
    renderWithMantine(await ExploreLibrariesPage())
    expect(screen.getAllByRole('article')).toHaveLength(24)
    expect(screen.getByText(/24 din 30/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Vezi mai multe' }))
    expect(screen.getAllByRole('article')).toHaveLength(30)
    await user.type(screen.getByRole('searchbox', { name: 'Caută' }), 'Activitate')
    expect(screen.getAllByRole('article')).toHaveLength(24)
  })

  it('redirects unauthenticated visitors to login', async () => {
    createClientMock.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })

    await expect(ExploreLibrariesPage()).rejects.toMatchObject({
      __redirect__: '/login',
    })
  })
})

describe('/teacher/library page', () => {
  it('renders the Mantine-rewritten owned-library page with the previous visual structure', async () => {
    getTeacherOwnedActivitiesMock.mockResolvedValue([ownedActivity])

    const ui = await MyLibraryPage({
      searchParams: Promise.resolve({ status: 'published', sort: 'title', tab: 'library' }),
    })
    const { container } = renderWithMantine(ui)

    expect(screen.queryByRole('heading', { name: 'Activități recente', level: 1 })).not.toBeInTheDocument()

    const content = screen.getByRole('region', { name: /conținut biblioteca mea/i })
    expect(content.parentElement).toHaveClass('teacher-scroll-page')
    expect(within(content).getByText('Toate clasele').closest('.mantine-Badge-root')).toBeInTheDocument()
    expect(within(content).getByText('Toate subiectele').closest('.mantine-Badge-root')).toBeInTheDocument()
    expect(within(content).getByText('Toate limbile').closest('.mantine-Badge-root')).toBeInTheDocument()
    expect(within(content).queryByRole('button', { name: 'Toate clasele' })).not.toBeInTheDocument()
    expect(within(content).getByRole('searchbox', { name: 'Caută' })).toHaveClass('mantine-Input-input')
    expect(within(content).getByRole('searchbox', { name: 'Caută' })).toHaveValue('')

    const recent = within(content).getByRole('region', { name: /activitățile mele recente/i })
    expect(within(recent).getByRole('link', { name: /vezi toate activitățile recente/i })).toHaveClass(
      'mantine-Anchor-root',
    )
    expect(within(recent).getByRole('link', { name: /creează o activitate sau evaluare automată/i })).toHaveAttribute(
      'href',
      '/teacher/activities/create',
    )
    expect(within(recent).getByRole('article', { name: /povestea personajului meu/i })).toHaveClass(
      'mantine-Card-root',
    )
    expect(within(recent).getByRole('link', { name: 'Atribuie' })).toHaveClass('mantine-Button-root')
    expect(within(recent).getByRole('link', { name: 'Atribuie' })).toHaveAttribute(
      'href',
      '/teacher/assignments/new?activityId=activity-1',
    )
    expect(within(recent).getByRole('link', { name: /răsfoiește biblioteca comunității/i })).toHaveAttribute(
      'href',
      '/teacher/libraries/explore',
    )

    const collections = within(content).getByRole('region', { name: /colecțiile mele/i })
    expect(within(collections).getByRole('heading', { name: 'Colecțiile mele (0)', level: 2 })).toBeInTheDocument()
    expect(within(collections).getByRole('link', { name: /1 activitate fără colecție/i })).toHaveClass(
      'mantine-UnstyledButton-root',
    )
    expect(within(collections).getByText('Crearea colecțiilor nu este disponibilă încă.')).toBeInTheDocument()
    expect(within(collections).queryByRole('button', { name: 'Creează' })).not.toBeInTheDocument()
    expect(content.querySelector('[class*="ep-library"]')).toBeNull()
    expect(container.querySelectorAll('.teacher-library-interactive').length).toBeGreaterThanOrEqual(4)
    expect(container.querySelectorAll('.mantine-Card-root.teacher-library-interactive').length).toBeGreaterThanOrEqual(
      3,
    )
    expect(getTeacherOwnedActivitiesMock).toHaveBeenCalledWith(expect.anything(), 'teacher-1')
  })

  it('redirects non-teachers to login', async () => {
    createClientMock.mockReturnValue(makeSupabase('student'))

    await expect(MyLibraryPage({ searchParams: Promise.resolve({}) })).rejects.toMatchObject({
      __redirect__: '/login',
    })
  })
})

describe('teacher library reference layout CSS', () => {
  it('keeps My Library layout and hover styling in the Mantine component layer', async () => {
    getTeacherOwnedActivitiesMock.mockResolvedValue([ownedActivity])

    const ui = await MyLibraryPage({
      searchParams: Promise.resolve({ status: 'published', sort: 'title' }),
    })
    const { container } = renderWithMantine(ui)
    const css = componentCss()
    const baseRule = cssRuleStartingAt(css, '.interactive')
    const surfaceHoverRule = cssRuleStartingAt(css, '.surfaceInteractive:hover')
    const actionHoverRule = cssRuleStartingAt(css, '.actionInteractive:hover')

    expect(screen.getByRole('region', { name: /conținut biblioteca mea/i }).parentElement).toHaveClass('teacher-scroll-page')
    expect(container.querySelectorAll('.teacher-library-interactive').length).toBeGreaterThanOrEqual(6)
    expect(container.querySelectorAll('.teacher-library-surface-interactive').length).toBeGreaterThanOrEqual(4)
    expect(container.querySelectorAll('.teacher-library-action-interactive').length).toBeGreaterThanOrEqual(2)
    expect(baseRule).toContain('transition:')
    expect(surfaceHoverRule).toContain('background-color: var(--color-surface-hover);')
    expect(surfaceHoverRule).toContain('box-shadow: var(--shadow-soft);')
    expect(actionHoverRule).toContain('filter: brightness(0.96);')
  })

  it('removes obsolete My Library global EduPlay selectors after the Mantine rewrite', () => {
    expect(globalsCss()).not.toContain('.ep-library-page')
    expect(globalsCss()).not.toContain('.ep-library-column')
    expect(globalsCss()).not.toContain('.ep-library-card')
  })

  it('rounds Explore Library cards through Mantine component styling', async () => {
    getPublishedGamesMock.mockResolvedValue([publicGame])

    const ui = await ExploreLibrariesPage()
    renderWithMantine(ui)

    const content = screen.getByTestId('library-explore-content')
    const popular = within(content).getByRole('region', { name: /activități din biblioteca eduplay/i })

    expect(within(popular).getByRole('article').className).toContain('librariesCardBase')
    expect(within(popular).getByRole('button', { name: 'Atribuie activitatea Exersează sunetul M' })).toHaveClass('teacher-libraries-action-interactive')
  })
  it('adds Mantine CSS-module hover feedback to every Explore Library interaction', async () => {
    getPublishedGamesMock.mockResolvedValue([publicGame])

    const ui = await ExploreLibrariesPage()
    const { container } = renderWithMantine(ui)
    const css = componentCss()
    const baseRule = cssRuleStartingAt(css, '.interactive')
    const surfaceHoverRule = cssRuleStartingAt(css, '.surfaceInteractive:hover')
    const actionHoverRule = cssRuleStartingAt(css, '.actionInteractive:hover')

    expect(container.querySelectorAll('.teacher-libraries-interactive').length).toBeGreaterThanOrEqual(8)
    expect(container.querySelectorAll('.teacher-libraries-action-interactive').length).toBeGreaterThanOrEqual(2)
    expect(container.querySelectorAll('.teacher-libraries-surface-interactive').length).toBeGreaterThanOrEqual(6)
    expect(globalsCss()).not.toContain('.teacher-libraries-interactive')
    expect(baseRule).toContain('transition:')
    expect(surfaceHoverRule).toContain('background-color: var(--color-surface-hover);')
    expect(surfaceHoverRule).toContain('box-shadow: var(--shadow-soft);')
    expect(actionHoverRule).toContain('filter: brightness(0.96);')
  })
  it('lets the same hover classes as the Teacher dashboard own the visible hover properties', async () => {
    getPublishedGamesMock.mockResolvedValue([publicGame])

    const ui = await ExploreLibrariesPage()
    const { container } = renderWithMantine(ui)

    expectNoInlineHoverOverrides(container.querySelectorAll('.teacher-libraries-surface-interactive'), [
      'background',
      'background-color',
      'border',
      'border-color',
      'box-shadow',
    ])
    expectNoInlineHoverOverrides(container.querySelectorAll('.teacher-libraries-action-interactive'), [
      'box-shadow',
      'filter',
    ])
  })
  it('keeps Libraries top bar styling out of global EduPlay CSS after the Mantine rewrite', () => {
    expect(globalsCss()).not.toContain('.ep-library-topbar')
    expect(globalsCss()).not.toContain('.ep-library-topbar__explore-title')
    expect(globalsCss()).not.toContain('.ep-library-topbar__explore-tabs')
    expect(globalsCss()).not.toContain('.ep-library-topbar__action')
  })
})
