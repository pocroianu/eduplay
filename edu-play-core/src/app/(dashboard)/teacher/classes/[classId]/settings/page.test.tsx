import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { MantineProvider } from '@mantine/core'
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
      'settingsHome.back': 'Back to class',
      'settingsHome.heading': 'Class Settings',
      'settingsHome.settingsMenu': 'Settings Menu',
      'settingsHome.sectionClassSettings': 'Class Settings',
      'settingsHome.sectionStudents': 'Students',
      'settingsHome.addStudents': 'Add Students',
      'settingsHome.inviteFamilies': 'Invite Families',
      'settingsHome.students': 'Students',
      'settingsHome.manageStudents': 'Manage Students',
      'settingsHome.sharedDevices': 'Class Code - Shared Devices',
      'settingsHome.likesComments': 'Student Likes and Comments',
      'settingsHome.itemEditing': 'Item Editing',
      'settingsHome.sectionFamilies': 'Families',
      'settingsHome.enableFamilyAccess': 'Enable Family Access',
      'settingsHome.inviteFamiliesLabel': 'Invite Families',
      'settingsHome.familyMessaging': 'Family Messaging',
      'settingsHome.studentSignInMode': 'Student Sign-in Mode',
      'settingsHome.studentGroups': 'Student Groups',
      'settingsHome.studentGroupsDescription': 'Organize students into groups',
      'settingsHome.homeLearningCodes': 'Home Learning Codes',
      'settingsHome.homeLearningCodesDescription': 'Individual codes for students',
      'settingsHome.studentLikesCommentsDescription': 'Likes, comments, and visibility',
      'settingsHome.itemEditingDescription': 'Editing rules for posts',
      'settingsHome.organization': 'Organization',
      'settingsHome.folders': 'Folders',
      'settingsHome.foldersDescription': 'Organize class work',
      'settingsHome.addFolderStep': 'Add to Folder Step',
      'settingsHome.addFolderStepDescription': 'Show during publishing',
      'settingsHome.teachers': 'Teachers',
      'settingsHome.teachersDescription': 'Invite and review access',
      'settingsHome.navAria': 'Class settings sections',
      'settingsHome.classActive': 'Active',
      'settingsHome.classArchived': 'Archived',
      'settingsHome.classSummary': 'students',
      'settingsHome.classSummaryActive': 'recently active',
    }[key] ?? key),
}))

vi.mock('@/lib/i18n/I18nProvider', () => ({
  I18nProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

import ClassSettingsPage from './page'

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

describe('/teacher/classes/[classId]/settings', () => {
  it('adds a teacher class settings route constant', () => {
    expect(ROUTES.TEACHER.CLASS_SETTINGS('class-1')).toBe('/teacher/classes/class-1/settings')
  })

  it('redirects unauthenticated teachers to login', async () => {
    getClassDetailDataMock.mockResolvedValue(null)

    await expect(
      ClassSettingsPage({ params: Promise.resolve({ classId: 'class-1' }) }),
    ).rejects.toThrowError(/NEXT_REDIRECT:\/login/)
    expect(redirectMock).toHaveBeenCalledWith('/login')
  })

  it('returns notFound when the class is missing', async () => {
    getClassDetailDataMock.mockResolvedValue('not-found')

    await expect(
      ClassSettingsPage({ params: Promise.resolve({ classId: 'missing' }) }),
    ).rejects.toThrowError(/NEXT_NOT_FOUND/)
    expect(notFoundMock).toHaveBeenCalled()
  })

  it('renders the Seesaw class settings home with i18n copy', async () => {
    getClassDetailDataMock.mockResolvedValue(classDetailData)

    render(
      <MantineProvider>
        {await ClassSettingsPage({ params: Promise.resolve({ classId: 'class-1' }) })}
      </MantineProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Class Settings', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Back to class/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS('class-1'),
    )
    expect(screen.getByText('Settings Menu')).toBeInTheDocument()
    expect(screen.getByText('Add Students')).toBeInTheDocument()
    expect(screen.getAllByText('Invite Families').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('heading', { name: 'Students' })).toBeInTheDocument()
    expect(screen.getByText('Manage Students')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Families' })).toBeInTheDocument()
    expect(screen.getByText('Enable Family Access')).toBeInTheDocument()
    expect(screen.getAllByText('Invite Families').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('Family Messaging')).not.toBeInTheDocument()
    expect(screen.getAllByText('Class Settings')[2].closest('a')).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS_SETTING_SECTION('class-1', 'class-info'),
    )
    expect(screen.getByText('Student Sign-in Mode')).toBeInTheDocument()
    expect(screen.getByText('Student Groups')).toBeInTheDocument()
    expect(screen.getByText('Home Learning Codes')).toBeInTheDocument()
    expect(screen.getByText('Organization')).toBeInTheDocument()
    expect(screen.getByText('Folders')).toBeInTheDocument()
    expect(screen.getByText('Add to Folder Step')).toBeInTheDocument()
    expect(screen.getByText('Teachers')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Invite FamiliesInvite Families/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS_FAMILIES('class-1'),
    )
    expect(screen.getAllByText('Class Code - Shared Devices').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Student Likes and Comments')).toBeInTheDocument()
    expect(screen.getByText('Item Editing')).toBeInTheDocument()
  })
})
