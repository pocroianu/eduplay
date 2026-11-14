import { ROUTES } from '@/shared/lib/constants'

// Routes whose page (or a nested layout) wraps content in DashboardShell, which
// already renders its own SideNavBar + BottomNavBar, or renders an immersive
// full-screen student surface. The (dashboard) layout must NOT render a second
// nav rail on these paths or the chrome duplicates (EDU-195).
const SHELL_OWNING_PREFIXES = [ROUTES.ADMIN.DASHBOARD] as const
const SHELL_OWNING_EXACT = new Set<string>([
  ROUTES.STUDENT.DASHBOARD,
  ROUTES.STUDENT.ACTIVITIES,
  ROUTES.STUDENT.PROGRESS,
  ROUTES.STUDENT.REWARDS,
  ROUTES.STUDENT.PROFILE,
  ROUTES.STUDENT.MAP,
])
const SHELL_OWNING_PATTERNS = [
  /^\/student\/activities\/[^/]+\/play$/,
  /^\/teacher\/classes\/[^/]+(?:\/(?:journal|activities|gradebook|notifications))?$/,
] as const

export function pathOwnsShell(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  if (SHELL_OWNING_EXACT.has(pathname)) return true
  if (SHELL_OWNING_PATTERNS.some((pattern) => pattern.test(pathname))) return true
  return SHELL_OWNING_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}
