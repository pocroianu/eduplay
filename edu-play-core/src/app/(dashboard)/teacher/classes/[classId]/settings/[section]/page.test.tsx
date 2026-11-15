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
  getServerLanguage: () => Promise.resolve('ro'),
  preloadNamespaces: () => Promise.resolve({}),
  getServerTranslation: (_lang: string, _namespace: string, key: string) =>
    Promise.resolve({
      'settingsSection.back': 'Înapoi la setări',
      'settingsSection.breadcrumbAria': 'Breadcrumb',
      'settingsSection.classActive': 'Clasă activă',
      'settingsSection.classArchived': 'Clasă arhivată',
      'settingsSection.close': 'Închide secțiunea de setări',
      'settingsSection.navTitle': 'Secțiuni de setări',
      'settingsSection.navDescription': 'Secțiuni detaliate pentru setările clasei.',
      'settingsSection.navAria': 'Secțiuni setări clasă',
    }[key] ?? key),
}))

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
    expect(ROUTES.TEACHER.CLASS_SETTING_SECTION('class-1', 'item-editing')).toBe(
      '/teacher/classes/class-1/settings/item-editing',
    )
  })

  it('redirects unauthenticated teachers to login', async () => {
    getClassDetailDataMock.mockResolvedValue(null)

    await expect(
      ClassSettingsSectionPage({
        params: Promise.resolve({ classId: 'class-1', section: 'item-editing' }),
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

  it('renders item editing like the EduPlay settings-item-editing reference flow', async () => {
    getClassDetailDataMock.mockResolvedValue(classDetailData)

    render(
      await ClassSettingsSectionPage({
        params: Promise.resolve({ classId: 'class-1', section: 'item-editing' }),
      }),
    )

    expect(screen.getByRole('link', { name: /înapoi la setări/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS_SETTINGS('class-1'),
    )
    expect(screen.getAllByRole('heading', { name: 'Editarea elementelor' }).length).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/Elevii pot edita postările în care sunt etichetați/i).length,
    ).toBeGreaterThan(0)
    expect(screen.getByText('Permite elevilor să editeze cine este etichetat în postări')).toBeInTheDocument()
    expect(screen.getAllByRole('switch')).toHaveLength(3)
  })

  it('renders home learning codes like the EduPlay settings-home-learning-codes reference flow', async () => {
    getClassDetailDataMock.mockResolvedValue(classDetailData)

    render(
      await ClassSettingsSectionPage({
        params: Promise.resolve({ classId: 'class-1', section: 'home-learning-codes' }),
      }),
    )

    expect(screen.getAllByRole('heading', { name: 'Coduri elevi pentru învățare acasă' }).length).toBeGreaterThan(0)
    expect(screen.getByText('Clasa Buburuzelor — învățare acasă')).toBeInTheDocument()
    expect(
      screen.getAllByText(/Când elevii se conectează cu un cod pentru învățare acasă/i).length,
    ).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /tipărește codurile/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /descarcă lista/i })).toBeDisabled()
    expect(screen.getByText('Întrebări și idei pentru învățarea acasă')).toBeInTheDocument()
    expect(screen.getByText('Andrei Popescu')).toBeInTheDocument()
  })

  it('renders manage folders like the EduPlay settings-manage-folders reference flow', async () => {
    getClassDetailDataMock.mockResolvedValue(classDetailData)

    render(
      await ClassSettingsSectionPage({
        params: Promise.resolve({ classId: 'class-1', section: 'manage-folders' }),
      }),
    )

    expect(screen.getAllByRole('heading', { name: 'Gestionează dosarele' }).length).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/Creează dosare pentru a organiza lucrările clasei după temă, disciplină sau proiect/i).length,
    ).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /creează dosar/i })).toBeDisabled()
    expect(screen.getByText(/Nu există dosare create încă/i)).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /afișează pasul „adaugă în dosar”/i })).toHaveAttribute('aria-checked', 'true')
  })

  it('renders student sign in mode like the EduPlay settings-student-sign-in-mode reference flow', async () => {
    getClassDetailDataMock.mockResolvedValue(classDetailData)

    render(
      await ClassSettingsSectionPage({
        params: Promise.resolve({ classId: 'class-1', section: 'student-sign-in-mode' }),
      }),
    )

    expect(screen.getAllByRole('heading', { name: 'Mod de conectare elevi' }).length).toBeGreaterThan(0)
    expect(screen.getByText('Cod de clasă — dispozitive partajate')).toBeInTheDocument()
    expect(screen.getByText('Cod de clasă — dispozitive 1:1')).toBeInTheDocument()
    expect(screen.getByText('E-mail sau SSO')).toBeInTheDocument()
    expect(
      screen.getByText(/Elevii intră cu un cod QR sau text al clasei/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Elevii intră cu adresa de e-mail și parola sau prin SSO/i),
    ).toBeInTheDocument()
  })

  it('renders show add to folder step like the EduPlay reference flow', async () => {
    getClassDetailDataMock.mockResolvedValue(classDetailData)

    render(
      await ClassSettingsSectionPage({
        params: Promise.resolve({ classId: 'class-1', section: 'show-add-folder-step' }),
      }),
    )

    expect(screen.getAllByRole('heading', { name: 'Afișează pasul „Adaugă în dosar”' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('switch', { name: /afișează pasul „adaugă în dosar”/i })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Cod de clasă — dispozitive partajate')).toBeInTheDocument()
    expect(screen.getAllByText('Coduri elevi pentru învățare acasă').length).toBeGreaterThan(0)
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
    expect(screen.getByText(/Introdu e-mailul profesorului pe care vrei să îl inviți/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /invită profesorul/i })).toBeDisabled()
    expect(screen.getByText(/generează un link de invitație pentru co-profesor/i)).toBeInTheDocument()
    expect(screen.getByText(/Toți profesorii au aceleași permisiuni/i)).toBeInTheDocument()
    expect(screen.getByText('Profesori actuali')).toBeInTheDocument()
  })

  it('renders student likes and comments like the EduPlay reference flow', async () => {
    getClassDetailDataMock.mockResolvedValue(classDetailData)

    render(
      await ClassSettingsSectionPage({
        params: Promise.resolve({ classId: 'class-1', section: 'student-likes-comments' }),
      }),
    )

    expect(screen.getAllByRole('heading', { name: 'Aprecieri și comentarii ale elevilor' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('switch', { name: /activează aprecierile elevilor/i })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: /activează comentariile elevilor/i })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: /comentariile noi necesită aprobare/i })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Elevii pot vedea lucrările colegilor')).toBeInTheDocument()
    expect(screen.getByText('Elevii pot publica pe blog')).toBeInTheDocument()
  })

  it('renders manage students like the EduPlay settings-manage-students reference flow', async () => {
    getClassDetailDataMock.mockResolvedValue(classDetailData)

    render(
      await ClassSettingsSectionPage({
        params: Promise.resolve({ classId: 'class-1', section: 'manage-students' }),
      }),
    )

    expect(screen.getAllByRole('heading', { name: 'Gestionează elevii' }).length).toBeGreaterThan(0)
    expect(screen.getByText(/Elevii se conectează la această clasă cu un cod de clasă/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /adaugă elev/i })).toHaveAttribute('href', ROUTES.TEACHER.CLASS_STUDENT_NEW('class-1'))
    expect(screen.getByRole('button', { name: /caută elev/i })).toBeDisabled()
    expect(screen.getByText('Andrei Popescu')).toBeInTheDocument()
    expect(screen.getByText('Adaugă elevi')).toBeInTheDocument()
  })

  it('renders manage student groups like the EduPlay settings-manage-student-groups reference flow', async () => {
    getClassDetailDataMock.mockResolvedValue(classDetailData)

    render(
      await ClassSettingsSectionPage({
        params: Promise.resolve({ classId: 'class-1', section: 'manage-student-groups' }),
      }),
    )

    expect(screen.getAllByRole('heading', { name: 'Gestionează grupurile de elevi' }).length).toBeGreaterThan(0)
    expect(screen.getByText(/Grupurile de elevi te ajută să atribui rapid activități/i)).toBeInTheDocument()
    expect(screen.getByText('Numele grupului:')).toBeInTheDocument()
    expect(screen.getByText('Alege elevii:')).toBeInTheDocument()
    expect(screen.getByText('Toți elevii din Clasa Buburuzelor')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /adaugă grup/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /șterge grupul/i })).toBeDisabled()
  })
})
