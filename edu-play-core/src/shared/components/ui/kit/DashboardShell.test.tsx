import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import type { ReactNode } from 'react'
import { DashboardShell } from './DashboardShell'

vi.mock('next/navigation', () => ({
  usePathname: () => '/teacher',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

function renderDashboard(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>)
}

describe('DashboardShell', () => {
  it('renders children inside a main element', () => {
    renderDashboard(
      <DashboardShell variant="student">
        <div data-testid="content">Hello</div>
      </DashboardShell>,
    )
    const main = screen.getByTestId('dashboard-shell-content')
    expect(main).toBeInTheDocument()
    expect(main).toHaveClass('bg-surface')
    expect(screen.getByTestId('content')).toBeInTheDocument()
  })

  it('renders TopAppBar slot when topBar is provided', () => {
    renderDashboard(
      <DashboardShell variant="student" topBar={{ title: 'Acasa' }}>
        <div>body</div>
      </DashboardShell>,
    )
    expect(screen.getByText('Acasa')).toBeInTheDocument()
  })

  it('omits TopAppBar when topBar is undefined', () => {
    renderDashboard(
      <DashboardShell variant="teacher">
        <div>body</div>
      </DashboardShell>,
    )
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
  })

  it('renders SideNavBar when navItems are provided', () => {
    renderDashboard(
      <DashboardShell
        variant="student"
        navItems={[
          { icon: 'House', label: 'Acasa', href: '/student' },
          { icon: 'GameController', label: 'Jocuri', href: '/student/games' },
        ]}
      >
        <div>body</div>
      </DashboardShell>,
    )
    expect(screen.getAllByRole('link', { name: /acasa/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /jocuri/i }).length).toBeGreaterThan(0)
  })

  it('skips SideNavBar when navItems is omitted so parent layouts can own chrome', () => {
    renderDashboard(
      <DashboardShell variant="student">
        <div>body</div>
      </DashboardShell>,
    )
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('applies a custom content width class when provided', () => {
    renderDashboard(
      <DashboardShell variant="teacher" contentClassName="max-w-4xl custom-width">
        <div>body</div>
      </DashboardShell>,
    )
    expect(screen.getByTestId('dashboard-shell-content')).toHaveClass('max-w-4xl')
    expect(screen.getByTestId('dashboard-shell-content')).toHaveClass('custom-width')
  })

  it('falls back to max-w-6xl when no content width is provided', () => {
    renderDashboard(
      <DashboardShell variant="student">
        <div>body</div>
      </DashboardShell>,
    )
    expect(screen.getByTestId('dashboard-shell-content')).toHaveClass('max-w-6xl')
  })

  it('routes the admin variant through the standard-mode side-nav and top-bar', () => {
    renderDashboard(
      <DashboardShell
        variant="admin"
        navItems={[{ icon: 'SquaresFour', label: 'Panou', href: '/admin' }]}
        topBar={{ title: 'Panou administrativ' }}
      >
        <div>admin body</div>
      </DashboardShell>,
    )
    expect(document.querySelector('[data-nav-variant="admin"]')).toBeTruthy()
    expect(document.querySelector('[data-shell-variant="admin"]')).toBeTruthy()
    expect(screen.getByText('Panou administrativ')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /panou/i }).length).toBeGreaterThan(0)
  })

  it('renders EduPlay shell anatomy for the teacher dashboard', () => {
    renderDashboard(
      <DashboardShell
        variant="teacher"
        navItems={[{ icon: 'SquaresFour', label: 'Panou', href: '/teacher' }]}
        topBar={{ title: 'Bun venit', badge: { label: 'Panou profesor' } }}
      >
        <div>teacher body</div>
      </DashboardShell>,
    )

    expect(screen.getByRole('complementary')).toHaveStyle({
      background: 'var(--color-surface-container-lowest)',
    })
    expect(screen.getByRole('banner', { name: /panou profesor/i })).toHaveClass('h-[72px]')
    expect(screen.getByTestId('dashboard-shell-content')).toHaveClass('bg-surface')
    expect(within(screen.getByRole('navigation', { name: /navigare principală/i })).getByRole('link', { name: /panou/i })).toHaveAttribute('aria-current', 'page')
  })
})
