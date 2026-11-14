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
      'journal.picker.back': 'Back to class journal',
      'journal.picker.heading': 'Post Student Work',
      'journal.picker.description': 'Choose a tool for this class. This remains a preview only.',
      'journal.picker.classActive': 'Active',
      'journal.picker.toolsTitle': 'Create a journal post',
      'journal.picker.photoDescription': 'Take a classroom photo.',
      'journal.picker.drawingDescription': 'Open a drawing canvas.',
      'journal.picker.videoDescription': 'Record a video.',
      'journal.picker.uploadDescription': 'Upload a file.',
      'journal.picker.noteDescription': 'Write a typed note.',
      'journal.picker.linkDescription': 'Share a link.',
      'journal.picker.noPersistenceTitle': 'Preview only',
      'journal.picker.noPersistenceDescription': 'Choose a tool without saving a post in this test flow.',
      'journal.picker.photo': 'Photo',
      'journal.picker.drawing': 'Drawing',
      'journal.picker.video': 'Video',
      'journal.picker.upload': 'Upload',
      'journal.picker.note': 'Note',
      'journal.picker.link': 'Link',
      'journal.picker.preview': 'Preview',
    }[key] ?? key),
}))

vi.mock('@/lib/i18n/I18nProvider', () => ({
  I18nProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

import NewJournalPostPage from './page'

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

describe('/teacher/classes/[classId]/journal/new', () => {
  it('adds teacher class journal picker and note editor route constants', () => {
    expect(ROUTES.TEACHER.CLASS_JOURNAL_NEW('class-1')).toBe('/teacher/classes/class-1/journal/new')
    expect(ROUTES.TEACHER.CLASS_JOURNAL_NOTE_NEW('class-1')).toBe(
      '/teacher/classes/class-1/journal/new/note',
    )
  })

  it('redirects unauthenticated teachers to login', async () => {
    getClassDetailDataMock.mockResolvedValue(null)

    await expect(
      NewJournalPostPage({ params: Promise.resolve({ classId: 'class-1' }) }),
    ).rejects.toThrowError(/NEXT_REDIRECT:\/login/)
    expect(redirectMock).toHaveBeenCalledWith('/login')
  })

  it('returns notFound when the class is missing', async () => {
    getClassDetailDataMock.mockResolvedValue('not-found')

    await expect(
      NewJournalPostPage({ params: Promise.resolve({ classId: 'missing' }) }),
    ).rejects.toThrowError(/NEXT_NOT_FOUND/)
    expect(notFoundMock).toHaveBeenCalled()
  })

  it('renders the Seesaw post-to-journal picker with real roster context', async () => {
    getClassDetailDataMock.mockResolvedValue(classDetailData)

    render(await NewJournalPostPage({ params: Promise.resolve({ classId: 'class-1' }) }))

    expect(screen.getByRole('heading', { name: 'Post Student Work' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to class journal/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS('class-1'),
    )
    expect(screen.getByText('Active')).toBeInTheDocument()
    for (const tool of ['Photo', 'Drawing', 'Video', 'Upload', 'Note', 'Link']) {
      expect(screen.getByRole('heading', { name: tool })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: /photo take a classroom photo/i })).toHaveClass(
      'mantine-UnstyledButton-root',
    )
    expect(screen.getByRole('button', { name: /drawing open a drawing canvas/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /note/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS_JOURNAL_NOTE_NEW('class-1'),
    )
    expect(screen.getByText('Preview only')).toBeInTheDocument()
  })
})
