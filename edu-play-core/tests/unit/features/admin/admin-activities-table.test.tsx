import { screen, waitFor, within } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@/../tests/test-utils'
import { AdminActivitiesTable } from '@/features/admin'
import { ToastProvider } from '@/shared/components/ui/kit'
import type {
  ActivityRow,
  ActivityTypeRow,
} from '@/features/api/schemas/activity.schema'
import { installAdminTableDomMocks } from './test-helpers'

const mockFetch = vi.fn()
const refresh = vi.fn()
const push = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh,
  }),
  usePathname: () => '/admin/cms/activities',
  useSearchParams: () => new URLSearchParams(),
}))

function createActivity(overrides: Partial<ActivityRow> = {}): ActivityRow {
  return {
    id: 'activity-1',
    template: 'multiple-choice',
    title: 'Fracții distractive',
    description: 'Exerciții cu jumătăți',
    thumbnailUrl: null,
    defaultLang: 'ro',
    defaultTheme: null,
    category: 'math',
    difficulty: 'easy',
    targetAgeMin: 6,
    targetAgeMax: 8,
    estimatedDuration: 10,
    questionCount: 8,
    tags: [],
    subject: 'math',
    skills: [],
    isPublished: false,
    status: 'draft',
    configData: { question: 'Cât este jumătate din 4?' },
    configSchemaVersion: 2,
    createdBy: 'admin-1',
    createdAt: '2026-05-08T00:00:00.000Z',
    updatedAt: '2026-05-08T00:00:00.000Z',
    ...overrides,
  }
}

const activityTypes: ActivityTypeRow[] = [
  {
    typeId: 'multiple-choice',
    displayName: 'Alegere multiplă',
    category: 'math',
    configSchema: {},
    rendererKey: 'multiple-choice',
    rendererKind: 'iframe',
    authoringMode: 'admin-only',
    producesSubmission: false,
    supportsReview: false,
    isAutoScored: true,
    version: 2,
    createdAt: '2026-05-08T00:00:00.000Z',
    updatedAt: '2026-05-08T00:00:00.000Z',
  },
  {
    typeId: 'matching-game',
    displayName: 'Potrivire',
    category: 'română',
    configSchema: {},
    rendererKey: 'matching-game',
    rendererKind: 'iframe',
    authoringMode: 'admin-only',
    producesSubmission: false,
    supportsReview: false,
    isAutoScored: true,
    version: 1,
    createdAt: '2026-05-08T00:00:00.000Z',
    updatedAt: '2026-05-08T00:00:00.000Z',
  },
]

function renderTable(
  activities: ActivityRow[],
  options: {
    meta?: { page: number; perPage: number; total: number; totalPages: number }
    subjectOptions?: string[]
  } = {},
) {
  return render(
    <MantineProvider>
      <ToastProvider>
        <AdminActivitiesTable
          initialActivities={activities}
          activityTypes={activityTypes}
          initialMeta={
            options.meta ?? {
              page: 1,
              perPage: 20,
              total: activities.length,
              totalPages: 1,
            }
          }
          {...({ subjectOptions: options.subjectOptions } as object)}
        />
      </ToastProvider>
    </MantineProvider>,
  )
}

function withinDesktopTable() {
  return within(screen.getByRole('table'))
}

describe('AdminActivitiesTable', () => {
  beforeEach(() => {
    installAdminTableDomMocks()
    mockFetch.mockReset()
    refresh.mockReset()
    push.mockReset()
    vi.stubGlobal('fetch', mockFetch)
    vi.stubGlobal('confirm', vi.fn())
  })

  it('renders activity rows with type, subject and lifecycle status', () => {
    renderTable([createActivity()])
    const table = withinDesktopTable()

    expect(table.getByText('Fracții distractive')).toBeInTheDocument()
    expect(table.getByText('Alegere multiplă')).toBeInTheDocument()
    expect(table.getByText('Matematică')).toBeInTheDocument()
    expect(table.getByText('Ciornă')).toBeInTheDocument()
  })

  it('reloads rows from the CMS API when the draft filter is selected', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [createActivity({ id: 'draft-2', title: 'Numere draft' })],
        meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
      }),
    })

    renderTable([
      createActivity({ id: 'draft-1', title: 'Fracții distractive' }),
      createActivity({
        id: 'published-1',
        title: 'Litere magice',
        template: 'matching-game',
        subject: 'română',
        status: 'published',
        isPublished: true,
      }),
    ])

    await user.click(screen.getByRole('button', { name: /^ciornă/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/activities?perPage=20&status=draft',
      )
    })
    const table = withinDesktopTable()
    expect(table.getByText('Numere draft')).toBeInTheDocument()
    expect(table.queryByText('Litere magice')).not.toBeInTheDocument()
  })

  it('uses pagination metadata from the API envelope after filtering', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [createActivity({ id: 'draft-2', title: 'Numere draft' })],
        meta: {
          pagination: { page: 2, perPage: 20, total: 45, totalPages: 3 },
        },
      }),
    })

    renderTable([createActivity()], {
      meta: { page: 1, perPage: 20, total: 45, totalPages: 3 },
    })

    await user.click(screen.getByRole('button', { name: /^ciornă/i }))

    expect(await screen.findByText('Pagina 2 din 3')).toBeInTheDocument()
    expect(screen.getByText('45 activități găsite')).toBeInTheDocument()
  })

  it('renders type and subject filters as Mantine Combobox-backed controls', async () => {
    const user = userEvent.setup()
    renderTable([createActivity({ subject: 'math' })], {
      subjectOptions: ['math', 'științe'],
    })

    expect(
      screen.getByRole('button', { name: /filtrează după tip/i }),
    ).toHaveTextContent('Toate tipurile')
    expect(
      screen.getByRole('button', { name: /filtrează după materie/i }),
    ).toHaveTextContent('Toate materiile')

    await user.click(screen.getByRole('button', { name: /filtrează după materie/i }))

    expect(
      await screen.findByRole('option', { name: 'Științe', hidden: true }),
    ).toBeInTheDocument()
  })

  it('opens the activity editor from the row action menu', async () => {
    const user = userEvent.setup()
    renderTable([createActivity()])

    await user.click(
      withinDesktopTable().getByRole('button', { name: /acțiuni pentru fracții distractive/i }),
    )
    await user.click(await screen.findByRole('menuitem', { name: /deschide editorul/i }))

    expect(push).toHaveBeenCalledWith('/admin/cms/activities/activity-1')
  })

  it('bulk publishes selected drafts through the publish endpoint', async () => {
    const user = userEvent.setup()
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            activity: {
              ...createActivity({ status: 'published', isPublished: true }),
              updatedAt: '2026-05-09T00:00:00.000Z',
            },
            version: { versionNumber: 1 },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [],
          meta: { pagination: { page: 1, perPage: 20, total: 0, totalPages: 1 } },
        }),
      })

    renderTable([createActivity()])
    await user.click(screen.getByRole('checkbox', { name: /selectează fracții distractive/i }))
    await user.click(screen.getByRole('button', { name: /publică selectate/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/activities/activity-1/publish', {
        method: 'POST',
      })
    })
    await waitFor(() => {
      expect(mockFetch).toHaveBeenLastCalledWith('/api/v1/activities?perPage=20')
    })
    expect(await screen.findByText('Activități publicate')).toBeInTheDocument()
    expect(refresh).toHaveBeenCalled()
  })

  it('reconciles partial bulk publish success by reloading the active filters', async () => {
    const user = userEvent.setup()
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            createActivity({ id: 'activity-1', title: 'Fracții distractive' }),
            createActivity({ id: 'activity-2', title: 'Numere draft' }),
          ],
          meta: { pagination: { page: 1, perPage: 20, total: 2, totalPages: 1 } },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            activity: createActivity({
              id: 'activity-1',
              status: 'published',
              isPublished: true,
            }),
            version: { versionNumber: 1 },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: 'Publicarea a eșuat' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [createActivity({ id: 'activity-2', title: 'Numere draft' })],
          meta: { pagination: { page: 1, perPage: 20, total: 1, totalPages: 1 } },
        }),
      })

    renderTable([
      createActivity({ id: 'activity-1', title: 'Fracții distractive' }),
      createActivity({ id: 'activity-2', title: 'Numere draft' }),
    ])

    await user.click(screen.getByRole('button', { name: /^ciornă/i }))
    await user.click(await screen.findByRole('checkbox', { name: /selectează fracții/i }))
    await user.click(screen.getByRole('checkbox', { name: /selectează numere/i }))
    await user.click(screen.getByRole('button', { name: /publică selectate/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenLastCalledWith(
        '/api/v1/activities?perPage=20&status=draft',
      )
    })
    expect(await screen.findByText('Publicare parțială')).toBeInTheDocument()
  })

  it('publishes a single row and reloads active filters', async () => {
    const user = userEvent.setup()
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            activity: {
              ...createActivity({ status: 'published', isPublished: true }),
              updatedAt: '2026-05-09T00:00:00.000Z',
            },
            version: { versionNumber: 1 },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [],
          meta: { pagination: { page: 1, perPage: 20, total: 0, totalPages: 1 } },
        }),
      })

    renderTable([createActivity()])

    await user.click(
      withinDesktopTable().getByRole('button', { name: /acțiuni pentru fracții distractive/i }),
    )
    await user.click(await screen.findByRole('menuitem', { name: /^publică/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenLastCalledWith('/api/v1/activities?perPage=20')
    })
    expect(await screen.findByText('Activitate publicată')).toBeInTheDocument()
  })

  it('archives a row by PATCHing status archived', async () => {
    const user = userEvent.setup()
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: createActivity({ status: 'archived', isPublished: false }),
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [],
          meta: { pagination: { page: 1, perPage: 20, total: 0, totalPages: 1 } },
        }),
      })

    renderTable([createActivity()])
    const table = withinDesktopTable()

    await user.click(table.getByRole('button', { name: /acțiuni pentru fracții distractive/i }))
    await user.click(await screen.findByRole('menuitem', { name: /arhivează/i }))
    const dialog = await screen.findByRole('alertdialog', {
      name: /arhivezi activitatea/i,
    })

    expect(within(dialog).getByText(/fracții distractive/i)).toBeInTheDocument()
    expect(window.confirm).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: /^arhivează$/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/activities/activity-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived', isPublished: false }),
      })
    })
    await waitFor(() => {
      expect(mockFetch).toHaveBeenLastCalledWith('/api/v1/activities?perPage=20')
    })
    expect(await screen.findByText('Activitate arhivată')).toBeInTheDocument()
  })

  it('does not archive when the Mantine confirm dialog is canceled', async () => {
    const user = userEvent.setup()
    renderTable([createActivity()])
    const table = withinDesktopTable()

    await user.click(table.getByRole('button', { name: /acțiuni pentru fracții distractive/i }))
    await user.click(await screen.findByRole('menuitem', { name: /arhivează/i }))

    const dialog = await screen.findByRole('alertdialog', {
      name: /arhivezi activitatea/i,
    })
    await user.click(within(dialog).getByRole('button', { name: /renunță/i }))

    expect(screen.queryByRole('alertdialog', { name: /arhivezi activitatea/i })).toBeNull()
    expect(window.confirm).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
