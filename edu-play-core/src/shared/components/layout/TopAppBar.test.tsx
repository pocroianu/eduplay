import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MantineProvider } from '@mantine/core'
import type { ReactNode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TopAppBar } from './TopAppBar'

let pathname = '/teacher'
let searchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useSearchParams: () => searchParams,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

function renderTopAppBar(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>)
}

const topbarCss = () => readFileSync(join(process.cwd(), 'src/shared/components/layout/TopAppBar.module.css'), 'utf8')
const topbarSource = () => readFileSync(join(process.cwd(), 'src/shared/components/layout/TopAppBar.tsx'), 'utf8')

const cssRule = (selector: string) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`${escapedSelector}\\s*\\{(?<body>[^}]*)\\}`).exec(topbarCss())
  return match?.groups?.body ?? ''
}

describe('TopAppBar', () => {
  beforeEach(() => {
    pathname = '/teacher'
    searchParams = new URLSearchParams()
  })

  it('renders the shared 72px page header without duplicating sidebar profile controls', () => {
    renderTopAppBar(<TopAppBar title="Bun venit" mode="standard" badge={{ label: 'Panou profesor' }} />)

    expect(screen.getByRole('banner')).toHaveClass('h-[72px]')
    expect(screen.getByRole('heading', { name: 'Bun venit' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /deschide meniul contului/i })).not.toBeInTheDocument()
  })

  it('opens the teacher mobile account modal with the shared account rows', async () => {
    pathname = '/teacher/classes'

    renderTopAppBar(
      <TopAppBar
        mode="standard"
        role="teacher"
        profile={{ full_name: 'Ana Ionescu', subtitle: 'ana.ionescu@example.test' }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /deschide meniul contului/i }))

    const menu = await screen.findByRole('dialog', { name: /meniu cont/i })
    expect(screen.getByRole('button', { name: /deschide meniul contului/i })).toHaveClass('mantine-ActionIcon-root')
    expect(within(menu).getByText('Ana Ionescu')).toBeInTheDocument()
    expect(within(menu).getByText('Profesor')).toBeInTheDocument()
    expect(within(menu).queryByText('ana.ionescu@example.test')).not.toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: /setări cont/i })).toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: /școala mea/i })).toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: /informații dispozitiv/i })).toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: /selectează limba/i })).toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: /deconectare/i })).toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: /adaugă cont/i })).toBeInTheDocument()
  })

  it('renders mobile create and account shell controls with Mantine components', async () => {
    pathname = '/teacher/classes'

    renderTopAppBar(
      <TopAppBar
        mode="standard"
        role="teacher"
        profile={{ full_name: 'Ana Ionescu', subtitle: 'ana.ionescu@example.test' }}
      />,
    )

    const createMenuButton = screen.getByRole('button', { name: /deschide meniul de creare/i })
    const accountMenuButton = screen.getByRole('button', { name: /deschide meniul contului/i })

    expect(createMenuButton).toHaveClass('mantine-ActionIcon-root')
    expect(accountMenuButton).toHaveClass('mantine-ActionIcon-root')

    fireEvent.click(createMenuButton)

    const createDialog = await screen.findByRole('dialog', { name: /creează/i })
    expect(within(createDialog).getByRole('button', { name: /deconectare/i })).toHaveClass('mantine-Button-root')
    expect(topbarSource()).not.toMatch(/<button\b/)
  })

  it('centers the teacher home title in the EduPlay top chrome', () => {
    renderTopAppBar(<TopAppBar mode="standard" role="teacher" profile={{ full_name: 'Ana Popescu' }} />)

    const banner = screen.getByRole('banner')
    expect(banner).toHaveClass('h-[68px]')
    expect(banner).toHaveClass('justify-center')
    expect(screen.getByRole('heading', { name: /ana popescu/i })).toHaveClass('text-center')
    expect(screen.queryByText(/^EduPlay/)).not.toBeInTheDocument()
  })

  it('renders the teacher library top chrome with Mantine styling and a create action', () => {
    pathname = '/teacher/library'

    renderTopAppBar(<TopAppBar mode="standard" role="teacher" profile={{ full_name: 'Ana Popescu' }} />)

    const banner = screen.getByRole('banner')
    expect(banner).toHaveStyle({ height: 'calc(4.25rem * var(--mantine-scale))' })
    expect(banner.className).not.toContain('ep-library-topbar')
    expect(screen.getByRole('heading', { name: 'Biblioteca mea' })).toHaveClass('mantine-Text-root')
    expect(screen.getByRole('link', { name: /creează activitate/i })).toHaveClass('mantine-Button-root')
    expect(screen.getByRole('link', { name: /creează activitate/i })).toHaveAttribute(
      'href',
      '/teacher/activities/create',
    )
  })

  it('renders the teacher libraries top chrome like the reference panel', () => {
    pathname = '/teacher/libraries/explore'
    searchParams = new URLSearchParams('source=community')

    renderTopAppBar(<TopAppBar mode="standard" role="teacher" profile={{ full_name: 'Ana Popescu' }} />)

    const banner = screen.getByRole('banner')
    expect(banner).toHaveStyle({ height: 'calc(6.125rem * var(--mantine-scale))' })
    expect(banner.className).not.toContain('ep-library-topbar')
    expect(screen.getByRole('heading', { name: 'Biblioteci' })).toHaveClass('mantine-Text-root')
    expect(screen.getByTestId('libraries-explore-title-icon')).toBeInTheDocument()

    const sourceNav = screen.getByRole('navigation', { name: /surse bibliotecă/i })
    expect(sourceNav.className).not.toContain('ep-library-topbar__explore-tabs')
    expect(screen.getByTestId('libraries-ep-tab-icon')).toBeInTheDocument()
    expect(screen.getByTestId('libraries-community-tab-icon')).toBeInTheDocument()
    expect(screen.queryByRole('tablist', { name: /surse bibliotecă/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Biblioteca EduPlay' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Biblioteca comunității' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Biblioteca comunității' })).toHaveClass('mantine-Button-root')
    expect(screen.getByRole('link', { name: 'Biblioteca comunității' })).not.toHaveClass('ep-interactive')

    const createLink = screen.getByRole('link', { name: /creează activitate/i })
    expect(createLink).toHaveClass('mantine-Button-root')
    expect(createLink).not.toHaveClass('ep-interactive')
    expect(screen.getByTestId('libraries-create-action-icon')).toBeInTheDocument()

    expect(cssRule('.libraryExploreTopbarContent')).toContain('position: relative;')
    expect(cssRule('.libraryExploreTitle')).toContain('position: absolute;')
    expect(cssRule('.libraryExploreTitle')).toContain('top: 6px;')
    expect(cssRule('.libraryExploreTabs')).toContain('position: absolute;')
    expect(cssRule('.libraryExploreTabs')).toContain('bottom: 0;')
    expect(cssRule('.libraryExploreTabs')).toContain('border-bottom: 1px solid var(--color-outline);')
    expect(cssRule('.libraryExploreTabs')).not.toContain('border-radius: 999px;')
    expect(cssRule('.libraryExploreAction')).toContain('min-height: 44px;')
  })

  it('keeps kid mode profile chrome for student surfaces', () => {
    renderTopAppBar(<TopAppBar title="Acasă" profile={{ full_name: 'Ana Ionescu' }} />)

    expect(screen.getByRole('heading', { name: 'Acasă' })).toBeInTheDocument()
    expect(screen.getByText('AI')).toBeInTheDocument()
  })
})
