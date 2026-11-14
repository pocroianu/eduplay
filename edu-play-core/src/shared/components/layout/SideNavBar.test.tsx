import { MantineProvider } from '@mantine/core'
import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SideNavBar } from './SideNavBar'

const supabaseAuth = vi.hoisted(() => ({
  signOut: vi.fn(),
}))

const navigation = vi.hoisted(() => ({
  pathname: '/',
  push: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: supabaseAuth.signOut,
    },
  }),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({
    push: navigation.push,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: navigation.refresh,
  }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect: vi.fn(),
}))

function renderSideNav(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>)
}


describe('SideNavBar', () => {
  beforeEach(() => {
    navigation.pathname = '/'
    navigation.push.mockClear()
    navigation.refresh.mockClear()
    supabaseAuth.signOut.mockReset()
    supabaseAuth.signOut.mockResolvedValue(undefined)
  })

  it('keeps a parent section active while the user is on a nested route', () => {
    navigation.pathname = '/teacher/activities/create'

    renderSideNav(
      <SideNavBar
        variant="teacher"
        items={[
          { icon: 'SquaresFour', label: 'Panou', href: '/teacher' },
          { icon: 'BookOpen', label: 'Activități', href: '/teacher/activities' },
        ]}
      />,
    )

    const primaryNav = screen.getByRole('navigation', { name: /navigare principală/i })
    expect(within(primaryNav).getByRole('link', { name: /activități/i })).toHaveAttribute('aria-current', 'page')
    expect(within(primaryNav).getByRole('link', { name: /panou/i })).not.toHaveAttribute('aria-current')
  })

  it('renders the standard sidebar with SidebarRail anatomy and labelled navigation', () => {
    renderSideNav(
      <SideNavBar
        variant="teacher"
        items={[
          { icon: 'SquaresFour', label: 'Panou', href: '/teacher' },
          { icon: 'Storefront', label: 'Biblioteci', href: '/teacher/libraries/explore', filled: true },
        ]}
      />,
    )

    expect(screen.getByRole('complementary')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /navigare principală/i })).toBeInTheDocument()
    expect(within(screen.getByTestId('sidebar')).getByRole('navigation', { name: /navigare rapidă/i })).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: /navigare principală/i })).getByRole('link', { name: /biblioteci/i })).toBeInTheDocument()
    expect(screen.queryByText(/Duo/i)).not.toBeInTheDocument()
  })

  it('renders the teacher profile cluster at the top of the sidebar', () => {
    renderSideNav(
      <SideNavBar
        variant="teacher"
        items={[{ icon: 'SquaresFour', label: 'Panou', href: '/teacher' }]}
        profile={{ full_name: 'Ana Ionescu' }}
        role="teacher"
      />,
    )

    const sidebar = screen.getByTestId('sidebar')
    const accountButton = within(sidebar).getByRole('button', { name: /deschide meniul contului/i })
    expect(accountButton).toBeInTheDocument()
    expect(within(accountButton).getByText('AI')).toBeInTheDocument()
    expect(within(accountButton).getByText('Ana Ionescu')).toBeInTheDocument()
  })

  it('collapses the standard sidebar to icon-only links without losing names or active state', () => {
    navigation.pathname = '/teacher/activities/create'

    renderSideNav(
      <SideNavBar
        variant="teacher"
        items={[
          { icon: 'SquaresFour', label: 'Panou', href: '/teacher' },
          { icon: 'BookOpen', label: 'Activități', href: '/teacher/activities' },
        ]}
        profile={{ full_name: 'Ana Ionescu' }}
        role="teacher"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /restrânge navigarea/i }))

    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-collapsed', 'true')
    const sidebarQueries = within(screen.getByTestId('sidebar'))
    expect(sidebarQueries.getByRole('link', { name: /activități/i })).toHaveAttribute('aria-current', 'page')
    expect(sidebarQueries.getByRole('link', { name: /panou/i })).not.toHaveAttribute('aria-current')
  })

  it('opens a teacher account menu with account links and sign out', async () => {
    renderSideNav(
      <SideNavBar
        variant="teacher"
        items={[{ icon: 'SquaresFour', label: 'Panou', href: '/teacher' }]}
        profile={{ full_name: 'Ana Ionescu' }}
        role="teacher"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /deschide meniul contului/i }))

    const menu = await screen.findByRole('dialog', { name: /meniu cont/i })
    expect(within(menu).getByText('Ana Ionescu')).toBeInTheDocument()
    expect(within(menu).getByText('Profesor')).toBeInTheDocument()
    const accountSettingsButton = within(menu).getByRole('button', { name: /setări cont/i })
    expect(accountSettingsButton).toBeInTheDocument()
    expect(accountSettingsButton).not.toHaveAttribute('data-autofocus')
    expect(within(menu).getByRole('button', { name: /școala mea/i })).toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: /informații dispozitiv/i })).toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: /selectează limba/i })).toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: /deconectare/i })).toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: /adaugă cont/i })).toBeInTheDocument()
    expect(menu.querySelectorAll('[data-account-menu-row]')).toHaveLength(6)
  })

  it.each([
    ['account settings', /setări cont/i, '/teacher/account/settings'],
    ['my school', /școala mea/i, '/teacher/account/school'],
    ['device information', /informații dispozitiv/i, '/teacher/account/device'],
    ['language settings', /selectează limba/i, '/teacher/language'],
  ])('routes the teacher account menu %s row to its page', async (_label, rowName, href) => {
    renderSideNav(
      <SideNavBar
        variant="teacher"
        items={[{ icon: 'SquaresFour', label: 'Panou', href: '/teacher' }]}
        profile={{ full_name: 'Ana Ionescu' }}
        role="teacher"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /deschide meniul contului/i }))
    const menu = await screen.findByRole('dialog', { name: /meniu cont/i })

    fireEvent.click(within(menu).getByRole('button', { name: rowName }))

    expect(navigation.push).toHaveBeenCalledWith(href)
  })

  it.each([
    ['sign out', /deconectare/i],
    ['add account', /adaugă cont/i],
  ])('signs out and sends the teacher to login from %s', async (_label, rowName) => {
    renderSideNav(
      <SideNavBar
        variant="teacher"
        items={[{ icon: 'SquaresFour', label: 'Panou', href: '/teacher' }]}
        profile={{ full_name: 'Ana Ionescu' }}
        role="teacher"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /deschide meniul contului/i }))
    const menu = await screen.findByRole('dialog', { name: /meniu cont/i })

    fireEvent.click(within(menu).getByRole('button', { name: rowName }))

    await waitFor(() => expect(supabaseAuth.signOut).toHaveBeenCalledTimes(1))
    expect(navigation.push).toHaveBeenCalledWith('/login')
    expect(navigation.refresh).toHaveBeenCalledTimes(1)
  })

  it('keeps student settings in the desktop side nav and out of the default bottom nav', () => {
    renderSideNav(
      <SideNavBar
        variant="student"
        items={[
          { icon: 'House', label: 'Acasă', href: '/student' },
          { icon: 'GameController', label: 'Jocuri', href: '/student/activities' },
          { icon: 'ChartLineUp', label: 'Progres', href: '/student/progress' },
          { icon: 'Medal', label: 'Premii', href: '/student/rewards' },
          { icon: 'SlidersHorizontal', label: 'Setări', href: '/student/profile' },
        ]}
      />,
    )

    expect(within(screen.getByTestId('side-nav')).getByRole('link', { name: /setări/i })).toBeInTheDocument()
    expect(
      within(screen.getByRole('navigation', { name: /navigare rapidă/i })).queryByRole('link', {
        name: /setări/i,
      }),
    ).not.toBeInTheDocument()
  })

  it('does not add the collapse control to the student nav', () => {
    renderSideNav(
      <SideNavBar variant="student" items={[{ icon: 'House', label: 'Acasă', href: '/student' }]} />,
    )

    expect(screen.queryByRole('button', { name: /restrânge navigarea/i })).not.toBeInTheDocument()
    expect(within(screen.getByTestId('side-nav')).getByRole('link', { name: /acasă/i })).toBeInTheDocument()
  })
})
