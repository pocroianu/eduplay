import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MantineProvider } from '@mantine/core'
import { render } from '@/../tests/test-utils'
import { AdminUsersTable } from '@/features/admin'
import { ToastProvider } from '@/shared/components/ui/kit'
import type { AdminUserSummary } from '@/features/admin/api/schemas'

const mockFetch = vi.fn()
const refresh = vi.fn()

function installScrollIntoViewMock() {
  Element.prototype.scrollIntoView = () => {}
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh,
  }),
  usePathname: () => '/admin/users',
  useSearchParams: () => new URLSearchParams(),
}))

function createUser(overrides: Partial<AdminUserSummary> = {}): AdminUserSummary {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'maria.profesor@scoala.ro',
    fullName: 'Maria Profesor',
    role: 'teacher',
    status: 'active',
    lastSignInAt: '2026-04-25T10:00:00.000Z',
    createdAt: '2026-01-10T08:00:00.000Z',
    ...overrides,
  }
}

function renderTable(users: AdminUserSummary[]) {
  return render(
    <MantineProvider>
      <ToastProvider>
        <AdminUsersTable
          initialUsers={users}
          initialNextCursor={null}
          totals={{
            active: users.filter((u) => u.status === 'active').length,
            suspended: users.filter((u) => u.status === 'suspended').length,
          }}
        />
      </ToastProvider>
    </MantineProvider>,
  )
}

function withinDesktopTable() {
  return within(screen.getByRole('table'))
}

async function chooseRowAction(user: ReturnType<typeof userEvent.setup>, actionName: RegExp) {
  await user.click(
    withinDesktopTable().getByRole('button', {
      name: /acțiuni pentru maria profesor/i,
    }),
  )
  await user.click(await screen.findByRole('menuitem', { name: actionName }))
}

describe('AdminUsersTable', () => {
  beforeEach(() => {
    installScrollIntoViewMock()
    mockFetch.mockReset()
    refresh.mockReset()
    vi.stubGlobal('fetch', mockFetch)
    vi.stubGlobal('confirm', vi.fn())
  })

  it('renders rows with name, role and status', () => {
    renderTable([createUser()])
    const table = withinDesktopTable()

    expect(table.getByText('Maria Profesor')).toBeInTheDocument()
    expect(table.getByText('maria.profesor@scoala.ro')).toBeInTheDocument()
    expect(table.getByText('Profesor')).toBeInTheDocument()
    expect(table.getByText('Activ')).toBeInTheDocument()
  })

  it('filters by status chip', async () => {
    const user = userEvent.setup()
    renderTable([
      createUser({ id: 'u-1', fullName: 'Profesor Activ', status: 'active' }),
      createUser({ id: 'u-2', fullName: 'Profesor Suspendat', status: 'suspended' }),
    ])

    await user.click(
      within(screen.getByRole('group', { name: /filtrează/i })).getByRole(
        'button',
        { name: /suspendați/i },
      ),
    )

    const table = withinDesktopTable()
    expect(table.queryByText('Profesor Activ')).not.toBeInTheDocument()
    expect(table.getByText('Profesor Suspendat')).toBeInTheDocument()
  })

  it('filters by free-text search across name and email', async () => {
    const user = userEvent.setup()
    renderTable([
      createUser({ id: 'u-1', fullName: 'Maria Ionescu', email: 'maria@a.ro' }),
      createUser({ id: 'u-2', fullName: 'Andrei Popa', email: 'andrei@b.ro' }),
    ])

    await user.type(screen.getByRole('searchbox'), 'andrei')

    const table = withinDesktopTable()
    expect(table.queryByText('Maria Ionescu')).not.toBeInTheDocument()
    expect(table.getByText('Andrei Popa')).toBeInTheDocument()
  })

  it('renders the role filter as a Mantine Combobox-backed filter select', async () => {
    const user = userEvent.setup()
    renderTable([createUser()])

    const roleFilter = screen.getByRole('button', {
      name: /filtrează după rol/i,
    })
    expect(roleFilter).toHaveClass('mantine-InputBase-input')
    expect(roleFilter).toHaveTextContent('Toate rolurile')

    await user.click(roleFilter)
    await user.click(
      await screen.findByRole('option', { name: /administrator/i, hidden: true }),
    )

    expect(roleFilter).toHaveTextContent('Administrator')
  })

  it('suspends an active user via PATCH and shows a success toast', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: '11111111-1111-1111-1111-111111111111', status: 'suspended' } }),
    })

    renderTable([createUser()])

    await chooseRowAction(user, /suspendă/i)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/admin/users/11111111-1111-1111-1111-111111111111', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'suspended' }),
      })
    })

    expect(await screen.findByText('Cont suspendat')).toBeInTheDocument()
    expect(refresh).toHaveBeenCalled()
  })

  it('reveals a freshly minted PIN in a dialog after a student reset', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { channel: 'pin', pin: '1234' } }),
    })

    renderTable([createUser({ role: 'student', fullName: 'Andrei Elev', email: null })])
    const table = withinDesktopTable()

    await user.click(table.getByRole('button', { name: /acțiuni pentru andrei elev/i }))
    await user.click(await screen.findByRole('menuitem', { name: /resetează pin/i }))
    const confirmDialog = await screen.findByRole('dialog', { name: /resetezi pin-ul/i })

    expect(within(confirmDialog).getByText(/afișat o singură dată/i)).toBeInTheDocument()
    expect(window.confirm).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()

    await user.click(within(confirmDialog).getByRole('button', { name: /generează pin/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/admin/users/11111111-1111-1111-1111-111111111111/reset-credentials',
        { method: 'POST' },
      )
    })

    const dialog = await screen.findByRole('dialog', { name: /pin nou pentru andrei elev/i })
    expect(within(dialog).getByText('1234')).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: /pin nou pentru andrei elev/i })).toBeInTheDocument()
    expect(
      within(dialog)
        .getAllByRole('button', { name: /închide/i })
        .some((button) => button.classList.contains('mantine-Modal-close')),
    ).toBe(true)
  })

  it('toasts the reset-email destination for non-student users', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { channel: 'email', emailSentTo: 'maria.profesor@scoala.ro' } }),
    })

    renderTable([createUser()])

    await chooseRowAction(user, /resetează parola/i)
    const confirmDialog = await screen.findByRole('dialog', {
      name: /trimiți resetarea parolei/i,
    })

    expect(within(confirmDialog).getByText(/maria profesor/i)).toBeInTheDocument()
    expect(window.confirm).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()

    await user.click(within(confirmDialog).getByRole('button', { name: /trimite email/i }))

    const toast = await screen.findByText('Email de resetare trimis')
    const toastRegion = toast.closest('[role="status"]') as HTMLElement | null
    expect(toastRegion).not.toBeNull()
    expect(within(toastRegion!).getByText('maria.profesor@scoala.ro')).toBeInTheDocument()
  })

  it('initiates deletion and shows confirmation toast', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'deletion-1', status: 'pending' } }),
    })

    renderTable([createUser()])

    await chooseRowAction(user, /inițiază ștergerea/i)
    const dialog = await screen.findByRole('alertdialog', { name: /inițiezi ștergerea/i })

    expect(within(dialog).getByText(/perioadă de grație de 30 de zile/i)).toBeInTheDocument()
    expect(window.confirm).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: /^inițiază ștergerea$/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/admin/users/11111111-1111-1111-1111-111111111111/initiate-deletion',
        { method: 'POST' },
      )
    })

    expect(await screen.findByText('Cerere de ștergere creată')).toBeInTheDocument()
  })

  it('skips reset-credentials when admin cancels the confirm dialog', async () => {
    const user = userEvent.setup()

    renderTable([createUser({ role: 'student', fullName: 'Andrei Elev', email: null })])
    const table = withinDesktopTable()

    await user.click(table.getByRole('button', { name: /acțiuni pentru andrei elev/i }))
    await user.click(await screen.findByRole('menuitem', { name: /resetează pin/i }))
    const dialog = await screen.findByRole('dialog', { name: /resetezi pin-ul/i })

    await user.click(within(dialog).getByRole('button', { name: /renunță/i }))

    expect(screen.queryByRole('dialog', { name: /resetezi pin-ul/i })).toBeNull()
    expect(window.confirm).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
