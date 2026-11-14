import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/shared/lib/constants'
import { ClassTabContent } from './ClassDetailContent'
import type { ClassDetailData } from '../server'

const componentSource = readFileSync(
  resolve(process.cwd(), 'src/features/teacher-dashboard/components/ClassDetailContent.tsx'),
  'utf8',
)

function expectActiveClassTab(name: RegExp) {
  const tabNav = screen.getByRole('navigation', { name: 'Filele clasei Bradiceni' })

  expect(within(tabNav).getByRole('link', { name })).toHaveAttribute('aria-current', 'page')

  return tabNav
}

const classDetailData: ClassDetailData = {
  profile: {
    id: 'teacher-1',
    full_name: 'Geani Pocroianu',
    email: 'geani@example.com',
    role: 'teacher',
    avatar_url: null,
  },
  classData: {
    id: 'class-1',
    name: 'Bradiceni',
    description: 'Clasa de dimineață',
    grade_level: 'Clasa I',
    school_year: '2025-2026',
    is_active: true,
  },
  stats: {
    totalStudents: 2,
    activeStudents: 1,
    lessonsInProgress: 1,
    awardsToday: 1,
  },
  studentRoster: [
    {
      id: 'student-1',
      fullName: 'Sample Student',
      username: 'sample.student',
      avatarUrl: null,
      status: 'online',
      recentGameTitle: 'Introduction - "Long a" Sound-Spelling Board',
      recentGameTime: '2026-05-22T18:45:00.000Z',
      lessonProgress: 50,
      totalScore: 80,
    },
    {
      id: 'student-2',
      fullName: 'Grasu',
      username: 'grasu',
      avatarUrl: null,
      status: 'needs_help',
      recentGameTitle: 'Practice - Feelings',
      recentGameTime: '2026-05-22T19:45:00.000Z',
      lessonProgress: 0,
      totalScore: 10,
    },
  ],
  leaderboard: [
    {
      id: 'student-1',
      fullName: 'Sample Student',
      avatarUrl: null,
      totalScore: 80,
    },
  ],
}

describe('<ClassTabContent />', () => {
  const renderClassTab = (activeTab: Parameters<typeof ClassTabContent>[0]['activeTab']) =>
    render(
      <MantineProvider>
        <ClassTabContent data={classDetailData} activeTab={activeTab} />
      </MantineProvider>,
    )

  it('renders shared Seesaw-style class workspace chrome', () => {
    renderClassTab('journal')

    expect(screen.getByTestId('class-workspace')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Navigare EduPlay', hidden: true })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Bradiceni' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Adaugă$/ })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS_JOURNAL_NEW('class-1'),
    )
    expect(screen.getByRole('link', { name: /Setările clasei/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS_SETTINGS('class-1'),
    )

    const tabNav = expectActiveClassTab(/jurnal/i)
    expect(within(tabNav).getByRole('link', { name: /activități/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS_ACTIVITIES('class-1'),
    )
    expect(within(tabNav).getByRole('link', { name: /catalog/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS_GRADEBOOK('class-1'),
    )
    expect(within(tabNav).getByRole('link', { name: /notificări/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS_NOTIFICATIONS('class-1'),
    )

    const rosterNav = screen.getByRole('navigation', { name: 'Elevi jurnal' })
    expect(within(rosterNav).getByText('Jurnalul clasei')).toBeInTheDocument()
    expect(within(rosterNav).getByText('2 postări')).toBeInTheDocument()
    expect(within(rosterNav).getByText('Sample Student')).toBeInTheDocument()
    expect(within(rosterNav).getByText('Grasu')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Adaugă elevi/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS_STUDENT_NEW('class-1'),
    )
    expect(screen.getByRole('link', { name: /Invită familii/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS_FAMILIES('class-1'),
    )
  })

  it('renders the class activities tab like the Seesaw class-activities reference flow', () => {
    renderClassTab('activities')

    expect(screen.getByRole('heading', { name: 'Bradiceni' })).toBeInTheDocument()
    expectActiveClassTab(/activități/i)
    expect(screen.getByRole('link', { name: /^Adaugă$/ })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS_JOURNAL_NEW('class-1'),
    )
    expect(screen.getByText('Trage pentru reîmprospătare')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /vezi asignările/i })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.ASSIGNMENTS,
    )
    expect(screen.getByRole('heading', { name: 'Activități active' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Introduction - "Long a" Sound-Spelling Board' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Practice - Feelings' })).toBeInTheDocument()
    expect(screen.queryByText('Vezi răspunsurile')).not.toBeInTheDocument()
    expect(screen.getByText('1 Finalizate')).toBeInTheDocument()
    expect(screen.getByText('1 Așteaptă revizuire')).toBeInTheDocument()
    expect(screen.getAllByText('Atribuită tuturor elevilor și grupurilor')).toHaveLength(2)
  })

  it('renders the class journal like the Seesaw class-journal reference flow', () => {
    renderClassTab('journal')

    expectActiveClassTab(/jurnal/i)
    expect(screen.getByText('Filtru flux elevi')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Jurnalul clasei' })).toBeInTheDocument()
    expect(screen.getAllByText('Sample Student').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Grasu').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /^Adaugă$/ })).toHaveAttribute(
      'href',
      ROUTES.TEACHER.CLASS_JOURNAL_NEW('class-1'),
    )
    expect(screen.getByRole('button', { name: 'Dată' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dosare' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Fluxul jurnalului clasei' })).toBeInTheDocument()
    expect(screen.getByText('Toată lumea')).toBeInTheDocument()
    expect(screen.getAllByText(/22 mai 2026/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Dosare etichetate').length).toBeGreaterThan(0)
    expect(screen.getAllByText('test').length).toBeGreaterThan(0)
    expect(screen.getByText(/Practice - Feelings/)).toBeInTheDocument()
    expect(screen.getByText(/Introduction - "Long a" Sound-Spelling Board/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apreciază' })).toHaveClass('mantine-Button-root')
    expect(screen.getByRole('button', { name: 'Comentează' })).toHaveClass('mantine-Button-root')
    expect(screen.getByRole('button', { name: /Arată mai multe/i })).toHaveClass('mantine-ActionIcon-root')
    expect(componentSource).not.toMatch(/<button\b/)
  })

  it('renders the gradebook upsell like the Seesaw class-gradebook reference flow', () => {
    renderClassTab('gradebook')

    expectActiveClassTab(/catalog/i)
    expect(screen.getByRole('heading', { name: 'Tablou de progres' })).toBeInTheDocument()
    expect(screen.getByText(/Vezi cine a finalizat activitățile/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /activează catalogul/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /află mai multe/i })).not.toBeInTheDocument()
    expect(screen.getByText(/fără persistență/i)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('renders notifications like the Seesaw class-notifications reference flow', () => {
    renderClassTab('notifications')

    expectActiveClassTab(/notificări/i)
    expect(screen.getByRole('heading', { name: 'Notificări' })).toBeInTheDocument()
    expect(screen.getByText('Se încarcă...')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reîmprospătează/i })).not.toBeInTheDocument()
    expect(screen.getByText('Apasă aici')).toBeInTheDocument()
    expect(screen.getByText(/0 elemente neaprobate în clasa ta/i)).toBeInTheDocument()
    expect(screen.getByText('vineri, 22 mai')).toBeInTheDocument()
    expect(screen.getByText(/Grasu vrea să adauge un comentariu la elementul lui Geani Pocroianu/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Grasu vrea să adauge un element/i)).toHaveLength(2)
    expect(screen.getByText('marți, 28 aprilie')).toBeInTheDocument()
    expect(screen.getByText('Săptămâna aceasta în Seesaw pentru Bradiceni')).toBeInTheDocument()
  })
})
