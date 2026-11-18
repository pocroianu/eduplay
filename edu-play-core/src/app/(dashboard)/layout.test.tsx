import { render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import DashboardLayout from './layout'

const pathname = vi.hoisted(() => ({ value: '/teacher' }))
vi.mock('next/headers', () => ({ headers: async () => ({ get: () => pathname.value }) }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'teacher' } } }) },
    from: (table: string) => table === 'profiles'
      ? { select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'teacher', full_name: 'Ana', email: '', role: 'teacher', avatar_url: null }, error: null }) }) }) }
      : { select: () => ({ eq: () => ({ order: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }) }) }) },
  }),
}))
vi.mock('@/shared/components/ui/kit/Toast', () => ({ ToastProvider: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/shared/components/layout/SideNavBar', () => ({ SideNavBar: () => <nav>Navigation</nav> }))
vi.mock('@/shared/components/layout/TopAppBar', () => ({ TopAppBar: () => <header>Header</header> }))
vi.mock('@/features/parent-portal/components/notification-bell', () => ({ NotificationBell: () => null }))
vi.mock('@/features/parent-portal/server', () => ({ getNotifications: vi.fn(), getUnreadNotificationCount: vi.fn() }))

describe('dashboard content landmark', () => {
  it.each(['/teacher', '/admin'])('provides a skip target on %s', async (path) => {
    pathname.value = path
    render(await DashboardLayout({ children: <p>Conținut</p> }))
    const link = screen.getByRole('link', { name: 'Sari la conținut' })
    const main = screen.getByRole('main')
    expect(link).toHaveAttribute('href', '#main-content')
    expect(main).toHaveAttribute('id', 'main-content')
    expect(main).toHaveAttribute('tabindex', '-1')
    expect(within(main).getByText('Conținut')).toBeInTheDocument()
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })
})
