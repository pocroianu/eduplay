import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ROUTES } from '@/shared/lib/constants/routes'

// Maps route prefixes to the role(s) allowed to access them.
// /games is accessible to any authenticated user.
//
// TODO(EDU-future): split the binary `admin` role into super-admin vs. admin
// when the privacy/audit/flags surfaces ship destructive operations. Today
// every `/admin/*` page is gated by a single role; the future split should
// keep the prefix but introduce role tiers (e.g. `admin`, `super_admin`)
// and per-subpath gates here.
const ROLE_ROUTE_MAP: Record<string, string[]> = {
  '/teacher': ['teacher'],
  '/student': ['student'],
  '/parent': ['parent'],
  '/admin': ['admin'],
}

const ROLE_DASHBOARD: Record<string, string> = {
  teacher: ROUTES.TEACHER.DASHBOARD,
  student: ROUTES.STUDENT.DASHBOARD,
  parent: ROUTES.PARENT.DASHBOARD,
  admin: ROUTES.ADMIN.DASHBOARD,
}

function getRoleDashboard(role: string): string {
  return ROLE_DASHBOARD[role] || ROUTES.HOME
}

export async function updateSession(
  request: NextRequest,
  extraRequestHeaders?: Record<string, string>
) {
  // Forward caller-supplied request headers (e.g. `x-pathname` consumed by the
  // dashboard layout) through to downstream RSCs. Server components read these
  // via `next/headers`, which surfaces request headers — not response headers
  // — so the headers must be injected into `NextResponse.next({ request })`.
  //
  // IMPORTANT: rebuild from the *current* request on every call. Supabase's
  // `setAll` mutates `request.cookies` to refresh auth tokens; if we reused a
  // pre-refresh Headers snapshot here, the forwarded Cookie header would still
  // carry the expired session and downstream RSCs would behave as logged-out.
  const buildResponse = (): NextResponse => {
    if (!extraRequestHeaders) {
      return NextResponse.next({ request })
    }
    const headers = new Headers(request.headers)
    for (const [name, value] of Object.entries(extraRequestHeaders)) {
      headers.set(name, value)
    }
    return NextResponse.next({ request: { headers } })
  }

  let supabaseResponse = buildResponse()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Rebuild after cookie refresh so the forwarded Cookie header
          // reflects the new tokens, not the pre-refresh snapshot.
          supabaseResponse = buildResponse()
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // All role-gated paths plus /games (any authenticated user)
  const protectedPaths = [...Object.keys(ROLE_ROUTE_MAP), '/games', '/play']
  const isProtectedPath = protectedPaths.some((path) =>
    pathname.startsWith(path)
  )

  // Redirect unauthenticated users away from protected routes
  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Enforce role-based access on dashboard routes
  if (user && isProtectedPath) {
    const matchedPrefix = Object.keys(ROLE_ROUTE_MAP).find((prefix) =>
      pathname.startsWith(prefix)
    )

    if (matchedPrefix) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const userRole = profile?.role
      const allowedRoles = ROLE_ROUTE_MAP[matchedPrefix]

      if (!userRole || !allowedRoles.includes(userRole)) {
        // Redirect to the user's own dashboard instead of showing forbidden content
        const url = request.nextUrl.clone()
        url.pathname = userRole ? getRoleDashboard(userRole) : '/login'
        return NextResponse.redirect(url)
      }
    }
  }

  // Redirect logged-in users away from auth pages
  const authPaths = ['/login', '/register']
  const isAuthPath = authPaths.some((path) =>
    pathname.startsWith(path)
  )

  if (isAuthPath && user) {
    const url = request.nextUrl.clone()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    url.pathname = getRoleDashboard(profile?.role ?? '')
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
