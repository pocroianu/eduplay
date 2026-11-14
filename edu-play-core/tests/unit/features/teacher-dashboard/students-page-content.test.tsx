import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@/../tests/test-utils'
import { StudentsPageContent } from '@/features/teacher-dashboard'
import type { StudentRow } from '@/features/teacher-dashboard'

const replace = vi.fn()
const push = vi.fn()
let currentSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push,
    replace,
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/teacher/students',
  useSearchParams: () => currentSearchParams,
  useParams: () => ({}),
  redirect: vi.fn(),
}))

const profile = {
  id: 'teacher-1',
  full_name: 'Ana Popescu',
  email: 'ana@example.com',
  role: 'teacher',
  avatar_url: null,
}

const classMap = {
  'class-1': 'Clasa 1A',
  'class-2': 'Clasa 2B',
}

const componentSource = readFileSync(
  join(process.cwd(), 'src/features/teacher-dashboard/components/StudentsPageContent.tsx'),
  'utf8',
)

function makeStudent(overrides: Partial<StudentRow> = {}): StudentRow {
  return {
    id: 'student-1',
    username: 'maria.ionescu',
    class_id: 'class-1',
    profiles: {
      full_name: 'Maria Ionescu',
      email: 'maria@school.ro',
      avatar_url: null,
    },
    isActive: true,
    progressPercent: 65,
    lastActiveAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('StudentsPageContent', () => {
  beforeEach(() => {
    replace.mockReset()
    push.mockReset()
    currentSearchParams = new URLSearchParams()
  })

  afterEach(() => {
    currentSearchParams = new URLSearchParams()
  })

  it('renders empty state with EduPlay copy when no students exist', () => {
    render(
      <StudentsPageContent profile={profile} students={[]} classMap={classMap} />,
    )
    expect(screen.getByText('Încă nu ai adăugat elevi')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /adaugă elev/i }),
    ).toHaveAttribute('href', '/teacher/students/new')
  })

  it('populates avatar alt text with the student full name (bug fix)', () => {
    const studentWithAvatar = makeStudent({
      profiles: {
        full_name: 'Ion Marinescu',
        email: 'ion@school.ro',
        avatar_url: '/ion.png',
      },
    })
    render(
      <StudentsPageContent
        profile={profile}
        students={[studentWithAvatar]}
        classMap={classMap}
      />,
    )
    const avatars = screen.getAllByAltText('Ion Marinescu')
    expect(avatars.length).toBeGreaterThan(0)
  })

  it('renders Activ / Inactiv pills based on isActive flag', () => {
    render(
      <StudentsPageContent
        profile={profile}
        students={[
          makeStudent({ id: 'a', username: 'alex', profiles: { full_name: 'Alex Activ', email: '', avatar_url: null }, isActive: true }),
          makeStudent({ id: 'b', username: 'iulia', profiles: { full_name: 'Iulia Inactiv', email: '', avatar_url: null }, isActive: false }),
        ]}
        classMap={classMap}
      />,
    )
    // DataTable renders both desktop and mobile views, so each pill appears twice
    expect(screen.getAllByText('Activ').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Inactiv').length).toBeGreaterThan(0)
  })

  it('shows only active rows when filter=active is in URL', () => {
    currentSearchParams = new URLSearchParams('filter=active')
    render(
      <StudentsPageContent
        profile={profile}
        students={[
          makeStudent({ id: 'a', username: 'alex', profiles: { full_name: 'Alex Activ', email: '', avatar_url: null }, isActive: true }),
          makeStudent({ id: 'b', username: 'iulia', profiles: { full_name: 'Iulia Inactiv', email: '', avatar_url: null }, isActive: false }),
        ]}
        classMap={classMap}
      />,
    )
    expect(screen.getAllByText('Alex Activ').length).toBeGreaterThan(0)
    expect(screen.queryByText('Iulia Inactiv')).not.toBeInTheDocument()
  })

  it('shows only inactive rows when filter=inactive is in URL', () => {
    currentSearchParams = new URLSearchParams('filter=inactive')
    render(
      <StudentsPageContent
        profile={profile}
        students={[
          makeStudent({ id: 'a', username: 'alex', profiles: { full_name: 'Alex Activ', email: '', avatar_url: null }, isActive: true }),
          makeStudent({ id: 'b', username: 'iulia', profiles: { full_name: 'Iulia Inactiv', email: '', avatar_url: null }, isActive: false }),
        ]}
        classMap={classMap}
      />,
    )
    expect(screen.queryByText('Alex Activ')).not.toBeInTheDocument()
    expect(screen.getAllByText('Iulia Inactiv').length).toBeGreaterThan(0)
  })

  it('updates URL search params when activating the Inactiv filter pill', async () => {
    const user = userEvent.setup()
    render(
      <StudentsPageContent
        profile={profile}
        students={[makeStudent()]}
        classMap={classMap}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Inactivi' }))
    expect(replace).toHaveBeenCalledWith('/teacher/students?filter=inactive', { scroll: false })
  })

  it('clears the filter param when activating Toți pill', async () => {
    currentSearchParams = new URLSearchParams('filter=active')
    const user = userEvent.setup()
    render(
      <StudentsPageContent
        profile={profile}
        students={[makeStudent()]}
        classMap={classMap}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Toți' }))
    expect(replace).toHaveBeenCalledWith('/teacher/students', { scroll: false })
  })

  it('marks the active filter pill with aria-pressed="true"', () => {
    currentSearchParams = new URLSearchParams('filter=active')
    render(
      <StudentsPageContent
        profile={profile}
        students={[makeStudent()]}
        classMap={classMap}
      />,
    )
    expect(screen.getByRole('button', { name: 'Activi' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Toți' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('uses Mantine-backed filter and search controls', () => {
    render(
      <StudentsPageContent
        profile={profile}
        students={[makeStudent()]}
        classMap={classMap}
      />,
    )

    expect(screen.getByRole('group', { name: 'Filtrează elevi' })).toHaveClass(
      'mantine-FilterChipGroup-root',
    )
    expect(screen.getByPlaceholderText('Caută elevi…')).toHaveClass('mantine-TextInput-input')
    expect(componentSource).not.toContain('<button')
    expect(componentSource).not.toContain('<input')
  })

  it('filters rows by search input across full_name and username', async () => {
    const user = userEvent.setup()
    render(
      <StudentsPageContent
        profile={profile}
        students={[
          makeStudent({ id: 'a', username: 'alex.maritan', profiles: { full_name: 'Alex Maritan', email: '', avatar_url: null } }),
          makeStudent({ id: 'b', username: 'iulia.bran', profiles: { full_name: 'Iulia Brán', email: '', avatar_url: null } }),
        ]}
        classMap={classMap}
      />,
    )
    const searchInput = screen.getByPlaceholderText('Caută elevi…')
    await user.type(searchInput, 'iulia')
    expect(screen.queryByText('Alex Maritan')).not.toBeInTheDocument()
    expect(screen.getAllByText('Iulia Brán').length).toBeGreaterThan(0)
  })

  it('renders sortable column headers with aria-sort', async () => {
    const user = userEvent.setup()
    render(
      <StudentsPageContent
        profile={profile}
        students={[
          makeStudent({ id: 'a', username: 'beta', profiles: { full_name: 'Beta Bond', email: '', avatar_url: null } }),
          makeStudent({ id: 'b', username: 'alpha', profiles: { full_name: 'Alpha Aron', email: '', avatar_url: null } }),
        ]}
        classMap={classMap}
      />,
    )
    const elevHeader = screen.getByRole('columnheader', { name: /elev/i })
    expect(elevHeader).toHaveAttribute('aria-sort', 'ascending')
    const button = within(elevHeader).getByRole('button', { name: /elev/i })
    await user.click(button)
    expect(elevHeader).toHaveAttribute('aria-sort', 'descending')
  })

  it('renders an empty state when filter excludes all rows', () => {
    currentSearchParams = new URLSearchParams('filter=active')
    render(
      <StudentsPageContent
        profile={profile}
        students={[
          makeStudent({ id: 'b', username: 'iulia', profiles: { full_name: 'Iulia Inactiv', email: '', avatar_url: null }, isActive: false }),
        ]}
        classMap={classMap}
      />,
    )
    expect(screen.getByText('Niciun elev nu corespunde filtrului')).toBeInTheDocument()
  })
})
