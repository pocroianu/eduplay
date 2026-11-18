import { fireEvent, render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n/I18nProvider'

const pushMock = vi.fn()
const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  }),
}))

import NewClassPage from './page'

const resources = {
  en: {
    teacher: {
      createClass: {
        back: 'Back',
        setupBadge: 'Class Setup',
        eyebrow: 'Create Class',
        heading: 'Create Your Class',
        subtitle: 'Set up the basics for your class before adding students.',
        importGoogle: 'Import from Google Classroom',
        importNote: 'Reference-only visual option; EduPlay does not connect Google Classroom yet.',
        or: 'or',
        gradeTitle: 'Choose Your Grade Level',
        name: 'Class Name',
        description: 'Description',
        grade: 'Grade Level',
        schoolYear: 'School Year',
        cancel: 'Cancel',
        submit: 'Create Class',
        submitting: 'Creating...',
        option: {
          select: 'Select grade level',
          preschool: 'PK-TK',
          kindergarten: 'K',
          grade1: '1st',
          grade2: '2nd',
        },
      },
    },
  },
} as const

describe('/teacher/classes/new', () => {
  it('shows an alert when saving fails', async () => {
    render(<MantineProvider><I18nProvider lang="en" resources={resources}><NewClassPage /></I18nProvider></MantineProvider>)
    fireEvent.change(screen.getByRole('textbox', { name: 'Class Name' }), { target: { value: 'Clasa mea' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Class' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nu am putut salva. Încearcă din nou.')
  })
  it('renders the EduPlay create class flow with i18n copy', () => {
    render(
      <MantineProvider>
        <I18nProvider lang="en" resources={resources}>
          <NewClassPage />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Create Your Class', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Back/i })).toHaveAttribute('href', '/teacher/classes')
    expect(screen.getByText('Reference-only visual option; EduPlay does not connect Google Classroom yet.')).toBeInTheDocument()
    expect(screen.getByText('Choose Your Grade Level')).toBeInTheDocument()
    expect(screen.getByText('Class Name')).toBeInTheDocument()
    expect(screen.queryByText('Description')).not.toBeInTheDocument()
    expect(screen.queryByText('Grade Level')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'School Year' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create Class' })).toBeInTheDocument()
  })
})
