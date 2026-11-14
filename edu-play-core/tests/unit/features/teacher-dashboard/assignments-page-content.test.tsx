import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { AssignmentsPageContent } from '@/features/teacher-dashboard/components/AssignmentsPageContent'
import type { AssignmentRow } from '@/features/teacher-dashboard/queries'

vi.mock('@/features/teacher-dashboard/components/TeacherActivityPicker', () => ({
  TeacherActivityPicker: () => <section aria-label="Trimitere rapidă" />,
}))

vi.mock('@/features/teacher-dashboard/actions/assignment-actions', () => ({
  deleteAssignment: vi.fn().mockResolvedValue({ success: true }),
}))

const componentSource = readFileSync(
  join(process.cwd(), 'src/features/teacher-dashboard/components/AssignmentsPageContent.tsx'),
  'utf8',
)

function renderWithMantine(element: ReactElement) {
  return render(<MantineProvider>{element}</MantineProvider>)
}

function makeAssignment(overrides: Partial<AssignmentRow> = {}): AssignmentRow {
  return {
    id: 'assignment-1',
    teacher_id: 'teacher-1',
    activity_id: 'activity-1',
    version_id: 'version-1',
    class_id: 'class-1',
    student_id: null,
    due_date: null,
    is_mandatory: false,
    created_at: null,
    updated_at: null,
    activity: {
      id: 'activity-1',
      title: 'Citire expresivă',
      category: 'literacy',
      difficulty: null,
      thumbnail_url: null,
    },
    class: {
      id: 'class-1',
      name: 'Clasa 1A',
    },
    student: null,
    ...overrides,
  }
}

describe('AssignmentsPageContent', () => {
  it('renders assignment filters with the shared Mantine chip group', () => {
    renderWithMantine(
      <AssignmentsPageContent
        profile={{ id: 'teacher-1', full_name: 'Ana', email: 'ana@example.test', role: 'teacher' }}
        assignments={[makeAssignment()]}
        totalCount={1}
        classes={[{ id: 'class-1', name: 'Clasa 1A' }]}
      />,
    )

    expect(screen.getByRole('group', { name: 'Filtrează teme' })).toHaveClass(
      'mantine-FilterChipGroup-root',
    )
    expect(screen.getByRole('button', { name: 'Toate' })).toHaveAttribute('aria-pressed', 'true')
    expect(componentSource).not.toContain('<button')
  })

  it('filters the assignment list from the Mantine chip controls', async () => {
    const user = userEvent.setup()
    renderWithMantine(
      <AssignmentsPageContent
        profile={{ id: 'teacher-1', full_name: 'Ana', email: 'ana@example.test', role: 'teacher' }}
        assignments={[
          makeAssignment({ id: 'standard', activity: { ...makeAssignment().activity!, title: 'Activitate standard' } }),
          makeAssignment({
            id: 'mandatory',
            is_mandatory: true,
            activity: { ...makeAssignment().activity!, title: 'Activitate obligatorie' },
          }),
        ]}
        totalCount={2}
        classes={[{ id: 'class-1', name: 'Clasa 1A' }]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Obligatorii' }))

    expect(screen.queryByText('Activitate standard')).not.toBeInTheDocument()
    expect(screen.getByText('Activitate obligatorie')).toBeInTheDocument()
  })

  it('uses Mantine action icons for assignment row actions', () => {
    renderWithMantine(
      <AssignmentsPageContent
        profile={{ id: 'teacher-1', full_name: 'Ana', email: 'ana@example.test', role: 'teacher' }}
        assignments={[makeAssignment()]}
        totalCount={1}
        classes={[{ id: 'class-1', name: 'Clasa 1A' }]}
      />,
    )

    const card = screen.getByTestId('assignment-card')
    expect(within(card).getByRole('link', { name: 'Editează tema' })).toHaveClass(
      'mantine-ActionIcon-root',
    )
    expect(within(card).getByRole('button', { name: 'Șterge tema' })).toHaveClass(
      'mantine-ActionIcon-root',
    )
  })
})
