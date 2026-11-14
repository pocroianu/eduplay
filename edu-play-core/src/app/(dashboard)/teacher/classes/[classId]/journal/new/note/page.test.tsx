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
      'journal.note.back': 'Back to tools',
      'journal.note.heading': 'Type a Note',
      'journal.note.textbox': 'Journal Note',
      'journal.note.audience': 'Choose Audience',
      'journal.note.publish': 'Publish',
      'journal.note.headingLabel': 'Journal',
      'journal.note.description': 'Write a note for your class.',
      'journal.note.editorTitle': 'Note editor',
      'journal.note.editorDescription': 'Type directly on the lined page.',
      'journal.note.textboxPlaceholder': 'Start writing...',
      'journal.note.textboxHelp': 'Text is editable in this preview.',
      'journal.note.audienceDescription': 'Selected recipients',
    }[key] ?? key),
}))

vi.mock('@/lib/i18n/I18nProvider', () => ({
  I18nProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

import NewJournalNotePage from './page'

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
  ],
  leaderboard: [],
} as const

beforeEach(() => {
  redirectMock.mockClear()
  notFoundMock.mockClear()
  getClassDetailDataMock.mockReset()
})

describe('/teacher/classes/[classId]/journal/new/note', () => {
  it('redirects unauthenticated teachers to login', async () => {
    getClassDetailDataMock.mockResolvedValue(null)

    await expect(
      NewJournalNotePage({ params: Promise.resolve({ classId: 'class-1' }) }),
    ).rejects.toThrowError(/NEXT_REDIRECT:\/login/)
    expect(redirectMock).toHaveBeenCalledWith('/login')
  })

  it('returns notFound when the class is missing', async () => {
    getClassDetailDataMock.mockResolvedValue('not-found')

    await expect(
      NewJournalNotePage({ params: Promise.resolve({ classId: 'missing' }) }),
    ).rejects.toThrowError(/NEXT_NOT_FOUND/)
    expect(notFoundMock).toHaveBeenCalled()
  })

  it('renders a non-persistent Seesaw Type a Note editor with roster context', async () => {
    getClassDetailDataMock.mockResolvedValue(classDetailData)

    render(await NewJournalNotePage({ params: Promise.resolve({ classId: 'class-1' }) }))

    expect(screen.getByRole('heading', { name: 'Type a Note' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to tools/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS_JOURNAL_NEW('class-1'),
    )
    const textbox = screen.getByRole('textbox', { name: 'Journal Note' })
    expect(textbox).toHaveClass('mantine-Textarea-input')
    expect(textbox).not.toHaveAttribute('readonly')
    expect(textbox).toHaveAttribute('maxlength', '5000')
    expect(screen.getByRole('heading', { name: 'Choose Audience' })).toBeInTheDocument()
    expect(screen.getByText('Andrei Popescu')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /publish/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS('class-1'),
    )
  })
})
