import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { render as testingLibraryRender, screen, within } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import type { ReactElement } from 'react'
import { eduPlayMantineTheme } from '@/shared/theme'
import { expectMantineSkeletonLoading } from '@/test-utils/source-file-guards'
import { QuestMap } from './QuestMap'
import type { QuestLesson, QuestUnit } from './types'

const baseProfile = {
  fullName: 'Matei Ionescu',
  firstName: 'Matei',
  avatarUrl: null,
  className: '3A',
  primarySubject: 'Matematică',
}

const baseStats = {
  lives: 5,
  weeklyXp: 920,
  streak: 7,
}

function makeUnits(): QuestUnit[] {
  return [
    {
      id: 'math',
      label: 'Matematică',
      state: 'done',
      tone: 'math',
      nodeColor: 'var(--color-blue)',
      href: '/student/games',
      progress: 4,
      total: 4,
    },
    {
      id: 'romanian',
      label: 'Română',
      state: 'active',
      tone: 'romana',
      nodeColor: 'var(--color-coral)',
      href: '/student/games',
      progress: 1,
      total: 3,
    },
    {
      id: 'science',
      label: 'Științe',
      state: 'upcoming',
      tone: 'stiinte',
      nodeColor: 'var(--color-primary)',
      href: '/student/games',
      progress: 0,
      total: 3,
    },
    {
      id: 'art',
      label: 'Arte',
      state: 'locked',
      tone: 'arte',
      nodeColor: 'var(--color-pink)',
      href: '/student/games',
      progress: 0,
      total: 3,
    },
    {
      id: 'english',
      label: 'Engleză',
      state: 'locked',
      tone: 'gold',
      nodeColor: 'var(--color-gold)',
      href: '/student/games',
      progress: 0,
      total: 3,
    },
  ]
}

const baseLessons: QuestLesson[] = [
  {
    id: 'l1',
    title: 'Scăderi simple',
    subjectTone: 'math',
    subjectLabel: 'Matematică',
    durationMinutes: 10,
    done: true,
    href: '/games/l1',
  },
  {
    id: 'l2',
    title: 'Citește „Broscuța"',
    subjectTone: 'romana',
    subjectLabel: 'Română',
    durationMinutes: 15,
    done: false,
    href: '/games/l2',
  },
  {
    id: 'l3',
    title: 'Plantele mele',
    subjectTone: 'stiinte',
    subjectLabel: 'Științe',
    durationMinutes: 8,
    done: false,
    href: '/games/l3',
  },
]

function render(element: ReactElement) {
  return testingLibraryRender(
    <MantineProvider theme={eduPlayMantineTheme}>
      {element}
    </MantineProvider>,
  )
}

describe('QuestMap', () => {
  it('uses the Lexend body font instead of Baloo on the kid-mode root', () => {
    const { container } = render(
      <QuestMap
        profile={baseProfile}
        stats={baseStats}
        units={makeUnits()}
        lessons={baseLessons}
      />,
    )

    const root = container.querySelector('[data-mode="kid"]')
    expect(root).toHaveClass('font-body')
    expect(root).not.toHaveClass('font-baloo')
  })

  it('renders Romanian greeting + class subtitle with diacritics', () => {
    render(
      <QuestMap
        profile={baseProfile}
        stats={baseStats}
        units={makeUnits()}
        lessons={baseLessons}
      />,
    )

    expect(
      screen.getByRole('heading', { level: 1, name: /Bună, Matei!/ }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Clasa 3A · Matematică/)).toHaveClass('text-[18px]')
  })

  it('renders the three stat bubbles with localised plural labels', () => {
    render(
      <QuestMap
        profile={baseProfile}
        stats={baseStats}
        units={makeUnits()}
        lessons={baseLessons}
      />,
    )

    expect(screen.getByLabelText(/5 vieți/)).toBeInTheDocument()
    expect(screen.getByLabelText(/920 XP săpt\./)).toBeInTheDocument()
    expect(screen.getByLabelText(/7 zile/)).toBeInTheDocument()
  })

  it('renders one node per unit and surfaces locked / active state copy', () => {
    render(
      <QuestMap
        profile={baseProfile}
        stats={baseStats}
        units={makeUnits()}
        lessons={baseLessons}
      />,
    )

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(8)

    expect(screen.getByText('Joacă acum')).toBeInTheDocument()

    const lockedNode = screen.getByLabelText(/Engleză, Blocat/)
    expect(lockedNode.tagName).toBe('SPAN')

    const activeNode = screen.getByLabelText(/Română, În progres/i)
    expect(activeNode.tagName).toBe('A')
    expect(activeNode).toHaveAttribute('href', '/student/games')
  })

  it('renders kid-readable Vulpița and rail body copy at the 18px floor', () => {
    render(
      <QuestMap
        profile={baseProfile}
        stats={baseStats}
        units={makeUnits()}
        lessons={[]}
      />,
    )

    expect(screen.getByText(/Vulpița spune:/)).toHaveClass('text-[18px]')
    expect(screen.getByText(/Hai să alegem împreună o lecție/)).toHaveClass(
      'text-[18px]',
    )
    expect(screen.getByText(/Alege orice joc din lista/)).toHaveClass('text-[18px]')
  })

  it('renders completed quest nodes with the done fill color', () => {
    render(
      <QuestMap
        profile={baseProfile}
        stats={baseStats}
        units={makeUnits()}
        lessons={baseLessons}
      />,
    )

    const doneNode = screen.getByLabelText(/Matematică, Finalizat/)
    const nodeFace = doneNode.querySelector('span[style*="background-color"]')
    expect(nodeFace).toHaveStyle({ backgroundColor: 'var(--color-status-done)' })
    expect(nodeFace).toHaveStyle({ boxShadow: 'var(--shadow-soft-sm)' })
  })

  it('uses soft token shadows instead of hard offset shadows in quest map chrome', () => {
    const files = ['QuestMap.tsx', 'QuestNode.tsx']
    const offenders = files.flatMap((file) => {
      const content = readFileSync(join(__dirname, file), 'utf8')
      return content
        .split('\n')
        .map((line, index) => ({ file, line: index + 1, content: line.trim() }))
        .filter(({ content }) => /boxShadow:\s*[`'"]0\s+\d+px\s+0\s+0/.test(content))
    })

    expect(offenders).toEqual([])
  })

  it('uses Mantine skeletons instead of Tailwind pulse classes on student map loading', () => {
    expectMantineSkeletonLoading('src/app/(dashboard)/student/map/loading.tsx')
  })

  it('shows state guidance pills for done, upcoming, and locked nodes', () => {
    render(
      <QuestMap
        profile={baseProfile}
        stats={baseStats}
        units={makeUnits()}
        lessons={baseLessons}
      />,
    )

    expect(screen.getByText('Terminat')).toBeInTheDocument()
    expect(screen.getByText('Urmează')).toBeInTheDocument()
    expect(screen.getAllByText('Blocat — joacă lecția anterioară')).toHaveLength(2)
  })

  it("renders the today's lessons heading with pluralised count", () => {
    render(
      <QuestMap
        profile={baseProfile}
        stats={baseStats}
        units={makeUnits()}
        lessons={baseLessons}
      />,
    )

    expect(screen.getByRole('heading', { name: /Azi · 3 lecții/ })).toBeInTheDocument()
  })

  it('renders Today lesson metadata and subject pills at the 18px floor', () => {
    render(
      <QuestMap
        profile={baseProfile}
        stats={baseStats}
        units={makeUnits()}
        lessons={baseLessons}
      />,
    )

    const firstLesson = screen.getByRole('link', { name: /Scăderi simple/ })
    expect(within(firstLesson).getByText('Matematică')).toHaveClass('text-[18px]')
    expect(within(firstLesson).getByText('10 min')).toHaveClass('text-[18px]')
  })

  it('shows Vulpița in cheer mode while lessons remain', () => {
    render(
      <QuestMap
        profile={baseProfile}
        stats={baseStats}
        units={makeUnits()}
        lessons={baseLessons}
      />,
    )

    expect(screen.getByText(/Vulpița spune:/)).toBeInTheDocument()
    expect(screen.getByText(/Hai să continuăm!/)).toBeInTheDocument()
    expect(screen.getByText(/2 lecții ca să-ți ții streak-ul/)).toBeInTheDocument()
  })

  it('renders the student-home Vulpița panel at the design-specified 160px size', () => {
    render(
      <QuestMap
        profile={baseProfile}
        stats={baseStats}
        units={makeUnits()}
        lessons={baseLessons}
      />,
    )

    expect(screen.getByRole('img', { name: /Vulpița, vulpea EduPlay/ })).toHaveAttribute(
      'width',
      '160',
    )
  })

  it('switches Vulpița to happy mode when every unit is done', () => {
    const allDone: QuestUnit[] = makeUnits().map((unit) => ({ ...unit, state: 'done' }))

    render(
      <QuestMap
        profile={baseProfile}
        stats={baseStats}
        units={allDone}
        lessons={[]}
      />,
    )

    expect(screen.getByText(/Felicitări! Ai terminat tot pe azi/)).toBeInTheDocument()
  })

  it('renders the empty-state copy when no lessons are scheduled', () => {
    render(
      <QuestMap
        profile={baseProfile}
        stats={baseStats}
        units={makeUnits()}
        lessons={[]}
      />,
    )

    expect(screen.getByText(/Niciun joc programat încă/)).toBeInTheDocument()
    expect(screen.getByText(/Vezi toate jocurile/)).toBeInTheDocument()
  })

  it('shows the thinking prompt when Today is empty but units remain open', () => {
    render(
      <QuestMap
        profile={baseProfile}
        stats={baseStats}
        units={makeUnits()}
        lessons={[]}
      />,
    )

    expect(screen.getByText(/Hai să alegem împreună o lecție/)).toBeInTheDocument()
    expect(screen.queryByText(/Felicitări! Ai terminat tot pe azi/)).not.toBeInTheDocument()
  })

  it('keeps the empty-state CTA at the kid-mode 64px touch height', () => {
    render(
      <QuestMap
        profile={baseProfile}
        stats={baseStats}
        units={makeUnits()}
        lessons={[]}
      />,
    )

    expect(screen.getByRole('link', { name: /Vezi toate jocurile/ })).toHaveClass(
      'min-h-[64px]',
    )
  })

  it('falls back to the no-class subtitle when className is null', () => {
    render(
      <QuestMap
        profile={{ ...baseProfile, className: null, primarySubject: null }}
        stats={baseStats}
        units={makeUnits()}
        lessons={baseLessons}
      />,
    )

    expect(screen.getByText(/Astăzi învățăm împreună/)).toHaveClass('text-[18px]')
  })

  it('exposes the kid-mode scope as data-mode="kid" on the surface root', () => {
    const { container } = render(
      <QuestMap
        profile={baseProfile}
        stats={baseStats}
        units={makeUnits()}
        lessons={baseLessons}
      />,
    )

    const root = container.querySelector('[data-mode="kid"]')
    expect(root).not.toBeNull()
  })

  it('keeps interactive lesson cards at the kid-mode 64px touch height', () => {
    render(
      <QuestMap
        profile={baseProfile}
        stats={baseStats}
        units={makeUnits()}
        lessons={baseLessons}
      />,
    )

    const lessonsHeading = screen.getByRole('heading', { name: /Azi · 3 lecții/ })
    const list = lessonsHeading.parentElement?.querySelector('ul')
    expect(list).not.toBeNull()
    if (!list) return

    for (const card of within(list as HTMLElement).getAllByRole('link')) {
      const target = card.querySelector('div[class*="min-h"]') as HTMLElement | null
      expect(target?.className).toMatch(/min-h-\[64px\]/)
    }
  })
})
