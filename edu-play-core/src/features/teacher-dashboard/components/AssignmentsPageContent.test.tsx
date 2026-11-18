import { fireEvent, render, screen, within } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { describe, expect, it, vi } from 'vitest'
import { AssignmentsPageContent } from './AssignmentsPageContent'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('../actions/assignment-actions', () => ({ deleteAssignment: vi.fn().mockResolvedValue({ success: false }) }))
vi.mock('./TeacherActivityPicker', () => ({ TeacherActivityPicker: () => null }))

describe('AssignmentsPageContent', () => {
  it('keeps the confirmation open and reports a failed deletion', async () => {
    render(<MantineProvider><AssignmentsPageContent profile={{ id: 't', full_name: 'T', email: '', role: 'teacher' }} totalCount={1} classes={[]} assignments={[{ id: 'a', teacher_id: 't', activity_id: 'g', version_id: 'v', class_id: null, student_id: null, due_date: null, is_mandatory: false, created_at: null, updated_at: null, activity: null, class: null, student: null }]} /></MantineProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'assignments.delete' }))
    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'assignments.deleteConfirm.confirm' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Nu am putut șterge. Încearcă din nou.')
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })
})
