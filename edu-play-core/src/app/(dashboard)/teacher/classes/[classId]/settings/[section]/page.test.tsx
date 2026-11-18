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

vi.mock('@/lib/i18n/server', async () => {
  const { readFileSync } = await import('node:fs')
  const resources = JSON.parse(readFileSync('public/locales/ro/teacher.json', 'utf8')) as Record<string, unknown>
  return {
    getServerLanguage: () => Promise.resolve('ro'),
    preloadNamespaces: () => Promise.resolve({}),
    getServerTranslation: (_lang: string, _namespace: string, key: string) => {
      const value = key.split('.').reduce<unknown>(
        (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
        resources,
      )
      return Promise.resolve(typeof value === 'string' ? value : key)
    },
  }
})

vi.mock('@/lib/i18n/I18nProvider', () => ({
  I18nProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

import ClassSettingsSectionPage from './page'

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

describe('/teacher/classes/[classId]/settings/[section]', () => {
  it('adds a teacher class settings section route constant', () => {
    expect(ROUTES.TEACHER.CLASS_SETTING_SECTION('class-1', 'class-info')).toBe(
      '/teacher/classes/class-1/settings/class-info',
    )
  })

  it('redirects unauthenticated teachers to login', async () => {
    getClassDetailDataMock.mockResolvedValue(null)

    await expect(
      ClassSettingsSectionPage({
        params: Promise.resolve({ classId: 'class-1', section: 'class-info' }),
      }),
    ).rejects.toThrowError(/NEXT_REDIRECT:\/login/)
    expect(redirectMock).toHaveBeenCalledWith('/login')
  })

  it('returns notFound when the section is unknown', async () => {
    getClassDetailDataMock.mockResolvedValue(classDetailData)

    await expect(
      ClassSettingsSectionPage({
        params: Promise.resolve({ classId: 'class-1', section: 'missing-section' }),
      }),
    ).rejects.toThrowError(/NEXT_NOT_FOUND/)
    expect(notFoundMock).toHaveBeenCalled()
  })

  it('renders student sign in mode like the EduPlay settings-student-sign-in-mode reference flow', async () => {
    getClassDetailDataMock.mockResolvedValue(classDetailData)

    render(
      await ClassSettingsSectionPage({
        params: Promise.resolve({ classId: 'class-1', section: 'student-sign-in-mode' }),
      }),
    )

    expect(screen.getAllByRole('heading', { name: 'Mod de conectare elevi' }).length).toBeGreaterThan(0)
    expect(screen.queryByText('Selectat')).not.toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    // Only the sign-in method that actually exists is described.
    expect(screen.getByText('Nume de utilizator și PIN')).toBeInTheDocument()
    expect(screen.getByText(/PIN-ul lor de 4 cifre/i)).toBeInTheDocument()
    expect(screen.queryByText(/cod QR|SSO|e-mail și parola/i)).not.toBeInTheDocument()
  })

  it('renders manage teachers like the EduPlay settings-manage-teachers reference flow', async () => {
    getClassDetailDataMock.mockResolvedValue(classDetailData)

    render(
      await ClassSettingsSectionPage({
        params: Promise.resolve({ classId: 'class-1', section: 'manage-teachers' }),
      }),
    )

    expect(screen.getAllByRole('heading', { name: 'Gestionează profesorii' }).length).toBeGreaterThan(0)
    expect(screen.getByText(/Adaugă profesori care fac deja parte din școala ta/i)).toBeInTheDocument()
    expect(screen.getByText('Invitarea profesorilor nu este disponibilă încă.')).toBeInTheDocument()
    expect(screen.getByText('Profesori actuali')).toBeInTheDocument()
  })

  it('renders manage students like the EduPlay settings-manage-students reference flow', async () => {
    getClassDetailDataMock.mockResolvedValue(classDetailData)

    render(
      await ClassSettingsSectionPage({
        params: Promise.resolve({ classId: 'class-1', section: 'manage-students' }),
      }),
    )

    expect(screen.getAllByRole('heading', { name: 'Gestionează elevii' }).length).toBeGreaterThan(0)
    expect(screen.getByText(/Elevii au un cont cu nume de utilizator/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /adaugă elev/i })).toHaveAttribute('href', ROUTES.TEACHER.CLASS_STUDENT_NEW('class-1'))
    expect(screen.queryByRole('button', { name: /caută elev/i })).not.toBeInTheDocument()
    expect(screen.getByText('Andrei Popescu')).toBeInTheDocument()
    expect(screen.queryByText('Elev demonstrativ')).not.toBeInTheDocument()
  })

  it.each([
    'manage-student-groups',
    'manage-folders',
    'home-learning-codes',
    'student-likes-comments',
    'item-editing',
    'show-add-folder-step',
  ])('returns notFound for the placeholder section %s', async (section) => {
    getClassDetailDataMock.mockResolvedValue(classDetailData)

    await expect(
      ClassSettingsSectionPage({ params: Promise.resolve({ classId: 'class-1', section }) }),
    ).rejects.toThrowError(/NEXT_NOT_FOUND/)
  })

  it('only lists sections backed by real data in the navigation', async () => {
    getClassDetailDataMock.mockResolvedValue(classDetailData)

    render(
      await ClassSettingsSectionPage({
        params: Promise.resolve({ classId: 'class-1', section: 'class-info' }),
      }),
    )

    const nav = screen.getByRole('navigation', { name: 'Secțiuni setări clasă' })
    expect(nav.querySelectorAll('a')).toHaveLength(4)
    expect(screen.queryByText('Gestionează dosarele')).not.toBeInTheDocument()
  })
})
