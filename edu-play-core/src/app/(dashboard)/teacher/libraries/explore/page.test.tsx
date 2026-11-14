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

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
  useRouter: () => ({ push: routerPushMock }),
  useSearchParams: () => new URLSearchParams(),
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

    const content = screen.getByRole('region', { name: /conținut biblioteci/i })
    expect(content.parentElement).toHaveStyle({ height: 'calc(100vh - 98px)' })
    expect(within(content).queryByRole('tablist', { name: /surse bibliotecă/i })).not.toBeInTheDocument()
    expect(within(content).getByRole('heading', { name: 'Ce vrei să predai?', level: 2 })).toBeInTheDocument()
    expect(within(content).getByRole('searchbox', { name: 'Caută' })).toBeInTheDocument()
    expect(within(content).getByRole('searchbox', { name: 'Caută' })).toHaveClass('mantine-Input-input')
    expect(within(content).getByRole('search')).toHaveStyle({ width: 'min(796px, 100%)' })

    expect(within(content).getByRole('button', { name: 'Esențiale EduPlay' })).toHaveClass('mantine-UnstyledButton-root')
    expect(within(content).getByRole('button', { name: 'Evaluări' })).toHaveClass('mantine-UnstyledButton-root')
    expect(within(content).queryByRole('button', { name: 'Derulează dreapta' })).not.toBeInTheDocument()
    expect(within(content).getByRole('button', { name: 'Alege clasa' })).toHaveClass('mantine-InputBase-input')
    expect(within(content).getByRole('button', { name: 'Alege limba' })).toHaveClass('mantine-InputBase-input')
    expect(within(content).getByText(/standarde și curriculum/i)).toBeInTheDocument()
    expect(within(content).queryByRole('button', { name: /standarde și curriculum/i })).not.toBeInTheDocument()
    expect(within(content).queryByRole('link', { name: /standarde și curriculum/i })).not.toBeInTheDocument()
    expect(within(content).getByText(/standarde și curriculum/i)).not.toHaveClass('teacher-libraries-interactive')

    const featured = within(content).getByRole('region', { name: /colecții recomandate/i })
    expect(within(featured).getByRole('link', { name: /rutine zilnice/i })).toHaveClass('mantine-Card-root')

    const popular = within(content).getByRole('region', { name: /cele mai populare activități/i })
    expect(within(popular).getByRole('article', { name: /exersează sunetul m/i })).toBeInTheDocument()
    expect(within(popular).getByRole('button', { name: 'Atribuie activitatea Exersează sunetul M' })).toHaveClass('mantine-ActionIcon-root')
    expect(content.querySelector('[class*="seesaw-libraries"], [class*="seesaw-library-topic"], [class*="seesaw-explore-card"]')).toBeNull()
    expect(container.querySelectorAll('.teacher-libraries-interactive').length).toBeGreaterThanOrEqual(18)
    expect(container.querySelector('.teacher-libraries-input-interactive')).toBeInTheDocument()
    expect(container.querySelectorAll('.mantine-Card-root.teacher-libraries-interactive').length).toBeGreaterThanOrEqual(4)
    expect(getPublishedGamesMock).toHaveBeenCalledTimes(1)
    expect(getTeacherOwnedActivitiesMock).not.toHaveBeenCalled()
  })

  it('uses Mantine dropdowns for grade and language filters', async () => {
    const user = userEvent.setup()
    getPublishedGamesMock.mockResolvedValue([publicGame, upperGradeGame])

    const ui = await ExploreLibrariesPage()
    renderWithMantine(ui)

    const content = screen.getByRole('region', { name: /conținut biblioteci/i })
    const gradeFilter = within(content).getByRole('button', { name: 'Alege clasa' })
    const languageFilter = within(content).getByRole('button', { name: 'Alege limba' })
    const popular = within(content).getByRole('region', { name: /cele mai populare activități/i })

    expect(gradeFilter).toHaveClass('mantine-InputBase-input')
    expect(gradeFilter).toHaveTextContent('Alege clasa')
    expect(languageFilter).toHaveClass('mantine-InputBase-input')
    expect(languageFilter).toHaveTextContent('Alege limba')
    expect(within(popular).getByRole('article', { name: /exersează sunetul m/i })).toBeInTheDocument()
    expect(within(popular).getByRole('article', { name: /descoperă fracțiile/i })).toBeInTheDocument()

    await user.click(gradeFilter)
    await user.click(await screen.findByRole('option', { name: 'Clasa a IV-a', hidden: true }))
    expect(gradeFilter).toHaveTextContent('Clasa a IV-a')
    expect(routerPushMock).toHaveBeenLastCalledWith('/teacher/libraries/explore?grade=grade-4', {
      scroll: false,
    })
    expect(within(popular).queryByRole('article', { name: /exersează sunetul m/i })).not.toBeInTheDocument()
    expect(within(popular).getByRole('article', { name: /descoperă fracțiile/i })).toBeInTheDocument()

    await user.click(languageFilter)
    await user.click(await screen.findByRole('option', { name: 'Română', hidden: true }))
    expect(languageFilter).toHaveTextContent('Română')
    expect(routerPushMock).toHaveBeenLastCalledWith('/teacher/libraries/explore?grade=grade-4&language=ro', {
      scroll: false,
    })
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
    expect(content.parentElement).toHaveStyle({ height: 'calc(100vh - 68px)' })
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
    expect(within(collections).getByRole('textbox', { name: /creează o colecție nouă/i })).toHaveClass(
      'mantine-Input-input',
    )
    expect(within(collections).getByRole('button', { name: 'Creează' })).toHaveClass('mantine-Button-root')
    expect(within(collections).getByRole('button', { name: 'Creează' })).toBeDisabled()
    expect(content.querySelector('[class*="seesaw-library"]')).toBeNull()
    expect(container.querySelectorAll('.teacher-library-interactive').length).toBeGreaterThanOrEqual(6)
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

    expect(screen.getByRole('region', { name: /conținut biblioteca mea/i }).parentElement).toHaveStyle({
      height: 'calc(100vh - 68px)',
      overflowY: 'auto',
    })
    expect(container.querySelectorAll('.teacher-library-interactive').length).toBeGreaterThanOrEqual(6)
    expect(container.querySelectorAll('.teacher-library-surface-interactive').length).toBeGreaterThanOrEqual(4)
    expect(container.querySelectorAll('.teacher-library-action-interactive').length).toBeGreaterThanOrEqual(2)
    expect(baseRule).toContain('transition:')
    expect(surfaceHoverRule).toContain('background-color: var(--color-surface-hover);')
    expect(surfaceHoverRule).toContain('box-shadow: var(--shadow-soft);')
    expect(actionHoverRule).toContain('filter: brightness(0.96);')
  })

  it('removes obsolete My Library global Seesaw selectors after the Mantine rewrite', () => {
    expect(globalsCss()).not.toContain('.seesaw-library-page')
    expect(globalsCss()).not.toContain('.seesaw-library-column')
    expect(globalsCss()).not.toContain('.seesaw-library-card')
  })

  it('rounds Explore Library cards through Mantine component styling', async () => {
    getPublishedGamesMock.mockResolvedValue([publicGame])

    const ui = await ExploreLibrariesPage()
    renderWithMantine(ui)

    const content = screen.getByRole('region', { name: /conținut biblioteci/i })
    const featured = within(content).getByRole('region', { name: /colecții recomandate/i })
    const popular = within(content).getByRole('region', { name: /cele mai populare activități/i })

    expect(within(featured).getByRole('link', { name: /rutine zilnice/i })).toHaveStyle({ borderRadius: '12px' })
    expect(within(popular).getByRole('button', { name: 'Atribuie activitatea Exersează sunetul M' })).toHaveStyle({ borderRadius: '10px' })
  })
  it('adds Mantine CSS-module hover feedback to every Explore Library interaction', async () => {
    getPublishedGamesMock.mockResolvedValue([publicGame])

    const ui = await ExploreLibrariesPage()
    const { container } = renderWithMantine(ui)
    const css = componentCss()
    const baseRule = cssRuleStartingAt(css, '.interactive')
    const surfaceHoverRule = cssRuleStartingAt(css, '.surfaceInteractive:hover')
    const actionHoverRule = cssRuleStartingAt(css, '.actionInteractive:hover')

    expect(container.querySelectorAll('.teacher-libraries-interactive').length).toBeGreaterThanOrEqual(18)
    expect(container.querySelectorAll('.teacher-libraries-action-interactive').length).toBeGreaterThanOrEqual(2)
    expect(container.querySelectorAll('.teacher-libraries-surface-interactive').length).toBeGreaterThanOrEqual(16)
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
  it('keeps Libraries top bar styling out of global Seesaw CSS after the Mantine rewrite', () => {
    expect(globalsCss()).not.toContain('.seesaw-library-topbar')
    expect(globalsCss()).not.toContain('.seesaw-library-topbar__explore-title')
    expect(globalsCss()).not.toContain('.seesaw-library-topbar__explore-tabs')
    expect(globalsCss()).not.toContain('.seesaw-library-topbar__action')
  })
})
