import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MantineProvider } from '@mantine/core'
import { render } from '@/../tests/test-utils'
import { AdminGamesTable } from '@/features/admin'
import { ToastProvider } from '@/shared/components/ui/kit'
import type { Game } from '@/features/games/types/game.types'
import { installAdminTableDomMocks } from './test-helpers'

const mockFetch = vi.fn()
const push = vi.fn()
const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh,
  }),
  usePathname: () => '/admin/games',
  useSearchParams: () => new URLSearchParams(),
}))

function createGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'game-1',
    title: 'Numere vesele',
    description: 'Joc de matematică pentru clasa pregătitoare',
    thumbnail_url: null,
    game_url: '/games/numere/index.html',
    category: 'math',
    difficulty_level: 2,
    target_age_min: 5,
    target_age_max: 7,
    estimated_duration: 10,
    learning_objectives: ['adunare'],
    is_published: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function renderTable(games: Game[]) {
  return render(
    <MantineProvider>
      <ToastProvider>
        <AdminGamesTable games={games} />
      </ToastProvider>
    </MantineProvider>,
  )
}

/**
 * DataTable renders both desktop (`<table>`) and mobile (stacked cards) views
 * to the DOM in jsdom. Scope row-level assertions to the desktop table so we
 * don't need to defeat duplicate matches across both layouts.
 */
function withinDesktopTable() {
  return within(screen.getByRole('table'))
}

describe('AdminGamesTable', () => {
  beforeEach(() => {
    installAdminTableDomMocks()
    mockFetch.mockReset()
    push.mockReset()
    refresh.mockReset()
    vi.stubGlobal('fetch', mockFetch)
    vi.stubGlobal('confirm', vi.fn())
  })

  it('renders the games table with title, category and status', () => {
    renderTable([createGame({ is_published: true })])
    const table = withinDesktopTable()

    expect(table.getByText('Numere vesele')).toBeInTheDocument()
    expect(table.getByText('Numere')).toBeInTheDocument()
    expect(table.getByText('Publicat')).toBeInTheDocument()
  })

  it('filters by status chip and updates the visible row count', async () => {
    const user = userEvent.setup()
    renderTable([
      createGame({ id: 'g-1', title: 'Joc publicat', is_published: true }),
      createGame({ id: 'g-2', title: 'Joc draft', is_published: false }),
    ])

    let table = withinDesktopTable()
    expect(table.getByText('Joc publicat')).toBeInTheDocument()
    expect(table.getByText('Joc draft')).toBeInTheDocument()

    await user.click(
      within(screen.getByRole('group', { name: /filtrează/i })).getByRole(
        'button',
        { name: /draft/i },
      ),
    )

    table = withinDesktopTable()
    expect(table.queryByText('Joc publicat')).not.toBeInTheDocument()
    expect(table.getByText('Joc draft')).toBeInTheDocument()
  })

  it('filters by free-text search across title and description', async () => {
    const user = userEvent.setup()
    renderTable([
      createGame({ id: 'g-1', title: 'Numere vesele', description: 'matematică' }),
      createGame({ id: 'g-2', title: 'Litere magice', description: 'alfabet' }),
    ])

    await user.type(screen.getByRole('searchbox'), 'litere')

    const table = withinDesktopTable()
    expect(table.queryByText('Numere vesele')).not.toBeInTheDocument()
    expect(table.getByText('Litere magice')).toBeInTheDocument()
  })

  it('renders the category filter as a controlled Mantine select', () => {
    renderTable([createGame()])

    const categoryFilter = screen.getByRole('combobox', {
      name: /filtrează după categorie/i,
    })
    expect(categoryFilter).toHaveClass('mantine-Select-input')
    expect(categoryFilter).toHaveValue('Toate categoriile')
    expect(categoryFilter).toHaveStyle({ minHeight: '44px' })
  })

  it('toggles publish via the row action menu and shows a success toast', async () => {
    const user = userEvent.setup()
    const game = createGame({ is_published: false })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { isPublished: true, updatedAt: '2026-04-01T12:00:00.000Z' },
      }),
    })

    renderTable([game])
    const table = withinDesktopTable()

    await user.click(table.getByRole('button', { name: /acțiuni pentru numere vesele/i }))
    await user.click(await screen.findByRole('menuitem', { name: /^publică$/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/games/game-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: true }),
      })
    })

    expect(await screen.findByText('Joc publicat')).toBeInTheDocument()
    expect(refresh).toHaveBeenCalled()
  })

  it('surfaces an error toast when publish fails', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Update failed' } }),
    })

    renderTable([createGame()])
    const table = withinDesktopTable()

    await user.click(table.getByRole('button', { name: /acțiuni pentru numere vesele/i }))
    await user.click(await screen.findByRole('menuitem', { name: /^publică$/i }))

    expect(await screen.findByText('Update failed')).toBeInTheDocument()
  })

  it('skips delete when the user cancels the confirm dialog', async () => {
    const user = userEvent.setup()

    renderTable([createGame()])
    const table = withinDesktopTable()

    await user.click(table.getByRole('button', { name: /acțiuni pentru numere vesele/i }))
    await user.click(await screen.findByRole('menuitem', { name: /șterge/i }))
    const dialog = await screen.findByRole('alertdialog', { name: /ștergi jocul/i })

    expect(within(dialog).getByText(/numere vesele/i)).toBeInTheDocument()
    expect(window.confirm).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: /renunță/i }))

    expect(screen.queryByRole('alertdialog', { name: /ștergi jocul/i })).toBeNull()
    expect(table.getByText('Numere vesele')).toBeInTheDocument()
  })

  it('deletes via API and removes the row when confirmed', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({ ok: true })

    renderTable([createGame()])
    const table = withinDesktopTable()

    await user.click(table.getByRole('button', { name: /acțiuni pentru numere vesele/i }))
    await user.click(await screen.findByRole('menuitem', { name: /șterge/i }))
    const dialog = await screen.findByRole('alertdialog', { name: /ștergi jocul/i })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(window.confirm).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: /^șterge$/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/games/game-1', { method: 'DELETE' })
    })

    await waitFor(() => {
      expect(table.queryByText('Numere vesele')).not.toBeInTheDocument()
    })
    expect(await screen.findByText('Joc șters')).toBeInTheDocument()
  })
})
