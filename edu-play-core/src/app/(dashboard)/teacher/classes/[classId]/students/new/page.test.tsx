import { readFileSync } from 'node:fs'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ROUTES } from '@/shared/lib/constants'

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: ComponentPropsWithoutRef<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`)
})

const notFoundMock = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
  notFound: () => notFoundMock(),
}))

const getClassDetailDataMock = vi.fn()

vi.mock('@/features/teacher-dashboard/server', () => ({
  getClassDetailData: (classId: string) => getClassDetailDataMock(classId),
}))

vi.mock('@/lib/i18n/server', () => ({
  getServerLanguage: () => Promise.resolve('en'),
  preloadNamespaces: () => Promise.resolve({}),
  getServerTranslation: (_lang: string, _namespace: string, key: string) =>
    Promise.resolve({
      'students.add.back': 'Back to class',
      'students.add.heading': 'Add Students to Class',
      'students.add.pasteTitle': 'Paste a list of student names',
      'students.add.moreLater': 'You can always add more later.',
      'students.add.addPeopleTitle': 'Add People to Class',
      'students.add.studentsTitle': 'Students',
      'students.add.familiesTitle': 'Families',
      'students.add.headingEyebrow': 'Students for Class',
      'students.add.description': 'Preview adding students to this class. Use the existing student creation flow to save changes.',
      'students.add.classActive': 'Active class',
      'students.add.classArchived': 'Archived class',
      'students.add.createReal': 'Create Real Student',
      'students.add.addStudentsTitle': 'Add Students to Class',
      'students.add.addStudentsDescription': 'Add one name at a time or paste a list of names, one per line.',
      'students.add.pasteDescription': 'Paste a student list to preview it; the list is not submitted automatically.',
      'students.add.manualTitle': 'Manual rows',
      'students.add.preview': 'Preview',
      'students.add.studentsDescription': 'Preview of the real roster for this class.',
      'students.add.noStudents': 'There are no students in this class yet.',
      'students.add.familiesDescription': 'Prepare family access after student creation.',
      'students.add.classCode': 'Class Code',
      'students.add.classCodeDescription': 'Preview-only class code. Regeneration and sharing stay in class settings.',
      'students.add.deviceShared': 'Shared Device',
      'students.add.deviceSharedDescription': 'Students can use the class code on a shared device.',
      'students.add.home': 'Home',
      'students.add.homeDescription': 'For home access, use the home learning codes setting.',
      'students.add.existingAccount': 'Existing Account',
      'students.add.existingAccountDescription': 'Students with usernames can keep using the existing sign-in flow.',
      'students.add.classSummary': 'Class Summary',
      'students.add.classSettings': 'Class Settings',
    }[key] ?? key),
}))

vi.mock('@/lib/i18n/I18nProvider', () => ({
  I18nProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

import NewClassStudentPage from './page'

const classDetailData = {
  profile: {
    id: 'teacher-1',
    full_name: 'Prof. Maria Ionescu',
    email: 'maria@example.com',
    role: 'teacher',
    avatar_url: null,
  },
  classData: {
    id: 'class-1',
    name: 'Clasa Buburuzelor',
    description: 'Grupa de dimineață',
    grade_level: 'Clasa I',
    school_year: '2025-2026',
    is_active: true,
  },
  stats: {
    totalStudents: 2,
    activeStudents: 1,
    lessonsInProgress: 0,
    awardsToday: 0,
  },
  studentRoster: [
    {
      id: 'student-1',
      fullName: 'Andrei Popescu',
      username: 'andrei.popescu',
      avatarUrl: null,
      status: 'online',
      recentGameTitle: null,
      recentGameTime: null,
      lessonProgress: 0,
      totalScore: 0,
    },
    {
      id: 'student-2',
      fullName: 'Ioana Marin',
      username: 'ioana.marin',
      avatarUrl: null,
      status: 'offline',
      recentGameTitle: null,
      recentGameTime: null,
      lessonProgress: 0,
      totalScore: 0,
    },
  ],
  leaderboard: [],
} as const

beforeEach(() => {
  redirectMock.mockClear()
  notFoundMock.mockClear()
  getClassDetailDataMock.mockReset()
})

describe('/teacher/classes/[classId]/students/new', () => {
  it('adds a teacher class add-students route constant', () => {
    expect(ROUTES.TEACHER.CLASS_STUDENT_NEW('class-1')).toBe('/teacher/classes/class-1/students/new')
  })

  it('redirects unauthenticated teachers to login', async () => {
    getClassDetailDataMock.mockResolvedValue(null)

    await expect(
      NewClassStudentPage({ params: Promise.resolve({ classId: 'class-1' }) }),
    ).rejects.toThrowError(/NEXT_REDIRECT:\/login/)
    expect(redirectMock).toHaveBeenCalledWith('/login')
  })

  it('returns notFound when the class is missing', async () => {
    getClassDetailDataMock.mockResolvedValue('not-found')

    await expect(
      NewClassStudentPage({ params: Promise.resolve({ classId: 'missing' }) }),
    ).rejects.toThrowError(/NEXT_NOT_FOUND/)
    expect(notFoundMock).toHaveBeenCalled()
  })

  it('renders the EduPlay add-students flow with class roster data', async () => {
    getClassDetailDataMock.mockResolvedValue(classDetailData)

    render(await NewClassStudentPage({ params: Promise.resolve({ classId: 'class-1' }) }))

    expect(screen.getByRole('heading', { name: 'Add Students to Class', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to class/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS('class-1'),
    )
    expect(screen.getByRole('link', { name: /create real student/i })).toHaveAttribute(
      'href',
      `${ROUTES.TEACHER.STUDENT_NEW}?classId=class-1`,
    )
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByText('Editabil')).not.toBeInTheDocument()
    expect(screen.queryByText('Preview')).not.toBeInTheDocument()
    expect(screen.queryByText(/Numele elevului/)).not.toBeInTheDocument()
    expect(screen.getByText('Add People to Class')).toBeInTheDocument()
    expect(screen.getAllByText('Students')).toHaveLength(1)
    expect(screen.getAllByText('Families')).toHaveLength(1)
    expect(screen.getByText('Andrei Popescu')).toBeInTheDocument()
    expect(screen.getByText('Ioana Marin')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /class settings/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS_SETTINGS('class-1'),
    )
  })

  it('does not render mock form controls that have no submit flow', () => {
    const source = readFileSync(
      'src/app/(dashboard)/teacher/classes/[classId]/students/new/page.tsx',
      'utf8',
    )

    expect(source).not.toContain('TextareaField')
    expect(source).not.toContain('TextField')
    expect(source).not.toContain('<textarea')
    expect(source).not.toContain('<input')
  })
})
