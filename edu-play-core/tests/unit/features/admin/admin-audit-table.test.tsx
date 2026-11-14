import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MantineProvider } from '@mantine/core'
import { render } from '@/../tests/test-utils'
import { AdminAuditTable } from '@/features/admin'
import { ToastProvider } from '@/shared/components/ui/kit'
import type { AdminAuditEntry } from '@/features/admin/api/schemas'
import { installAdminTableDomMocks } from './test-helpers'

const mockFetch = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/admin/audit',
  useSearchParams: () => new URLSearchParams(),
}))

function createEntry(overrides: Partial<AdminAuditEntry> = {}): AdminAuditEntry {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    actorId: '11111111-1111-1111-1111-111111111111',
    action: 'user_suspended',
    resourceType: 'profiles',
    resourceId: '22222222-2222-2222-2222-222222222222',
    before: { status: 'active' },
    after: { status: 'suspended' },
    visibility: 'platform',
    createdAt: '2026-04-29T12:00:00.000Z',
    ...overrides,
  }
}

function renderTable(
  entries: AdminAuditEntry[],
  actorMap: Record<string, string> = {
    '11111111-1111-1111-1111-111111111111': 'Maria Administrator',
  },
) {
  return render(
    <MantineProvider>
      <ToastProvider>
        <AdminAuditTable
          initialEntries={entries}
          initialNextCursor={null}
          actorMap={actorMap}
        />
      </ToastProvider>
    </MantineProvider>,
  )
}

function withinDesktopTable() {
  return within(screen.getByRole('table'))
}

async function chooseComboboxOption(
  user: ReturnType<typeof userEvent.setup>,
  name: RegExp,
  optionName: RegExp,
) {
  await user.click(screen.getByRole('combobox', { name }))
  fireEvent.click(
    await screen.findByRole('option', { name: optionName, hidden: true }),
  )
}

describe('AdminAuditTable', () => {
  beforeEach(() => {
    installAdminTableDomMocks()
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
  })

  it('renders rows with humanised action label and actor name', () => {
    renderTable([createEntry()])
    const table = withinDesktopTable()

    expect(table.getByText('Suspendare cont')).toBeInTheDocument()
    expect(table.getByText('Maria Administrator')).toBeInTheDocument()
    expect(table.getByText('Cont utilizator')).toBeInTheDocument()
    expect(table.getByText('Platformă')).toBeInTheDocument()
  })

  it('renders Sistem placeholder for actorless rows', () => {
    renderTable([createEntry({ actorId: null })])
    const table = withinDesktopTable()
    expect(table.getByText('Sistem')).toBeInTheDocument()
  })

  it('falls back to humanised snake_case for unknown actions', () => {
    renderTable([createEntry({ action: 'cool_new_event' })])
    const table = withinDesktopTable()
    expect(table.getByText('Cool New Event')).toBeInTheDocument()
  })

  it('filters in-page via free-text search', async () => {
    const user = userEvent.setup()
    renderTable(
      [
        createEntry({ id: 'a', action: 'user_suspended' }),
        createEntry({
          id: 'b',
          action: 'flag_created',
          actorId: '33333333-3333-3333-3333-333333333333',
        }),
      ],
      {
        '11111111-1111-1111-1111-111111111111': 'Maria Administrator',
        '33333333-3333-3333-3333-333333333333': 'Andrei Sef',
      },
    )

    await user.type(screen.getByRole('searchbox'), 'flag')

    const table = withinDesktopTable()
    expect(table.queryByText('Suspendare cont')).not.toBeInTheDocument()
    expect(table.getByText('Creare flag')).toBeInTheDocument()
  })

  it('renders query filters as Mantine controls', () => {
    renderTable([createEntry()])

    expect(screen.getByLabelText(/de la/i)).toHaveClass('mantine-TextInput-input')
    expect(screen.getByLabelText(/până la/i)).toHaveClass('mantine-TextInput-input')
    expect(screen.getByRole('combobox', { name: /acțiune/i })).toHaveClass('mantine-Select-input')
    expect(screen.getByRole('combobox', { name: /resursă/i })).toHaveClass('mantine-Select-input')
    expect(screen.getByLabelText(/de la/i)).toHaveStyle({ minHeight: '44px' })
    expect(screen.getByRole('combobox', { name: /acțiune/i })).toHaveStyle({ minHeight: '44px' })
  })

  it('exports CSV via the v1 endpoint and forwards applied filters', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], meta: { nextCursor: null } }),
    })
    const user = userEvent.setup()
    renderTable([createEntry()])

    // Choose an action filter and apply it
    await chooseComboboxOption(user, /acțiune/i, /suspendare cont/i)
    await user.click(screen.getByRole('button', { name: /aplică filtrele/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/admin/audit?action=user_suspended',
      )
    })

    const exportLink = screen.getByRole('link', { name: /export csv/i })
    expect(exportLink).toHaveAttribute(
      'href',
      '/api/v1/admin/audit/export.csv?action=user_suspended',
    )
  })

  it('refetches with applied filters when "Aplică filtrele" is clicked', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [createEntry({ id: 'fresh', action: 'flag_created' })],
        meta: { nextCursor: null },
      }),
    })
    const user = userEvent.setup()
    renderTable([createEntry()])

    await chooseComboboxOption(user, /resursă/i, /feature flag/i)
    await user.click(screen.getByRole('button', { name: /aplică filtrele/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/admin/audit?resourceType=feature_flags',
      )
    })

    const table = withinDesktopTable()
    await waitFor(() => {
      expect(table.getByText('Creare flag')).toBeInTheDocument()
    })
  })

  it('renders empty state when no rows are present', () => {
    renderTable([])
    expect(screen.getByText(/jurnalul de audit este gol/i)).toBeInTheDocument()
  })
})
