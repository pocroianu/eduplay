import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Root Next.js middleware. Composes two responsibilities:
 *
 * 1. `updateSession` (from `@/lib/supabase/middleware`):
 *    - Refreshes the Supabase auth cookie so SSR clients stay in sync.
 *    - Enforces the `ROLE_ROUTE_MAP` defense-in-depth role gate that
 *      `CLAUDE.md` § Route Protection mandates on top of RLS.
 *
 * 2. `x-pathname` request header injection:
 *    - Forwards the resolved request pathname to RSC layouts/pages so they
 *      can read it via `next/headers` (Next.js does not surface the URL to
 *      Server Components otherwise).
 *    - Consumed by `src/app/(dashboard)/layout.tsx` (EDU-195) to avoid
 *      rendering a duplicate `SideNavBar` on routes that already own a
 *      `DashboardShell`.
 *
 * `updateSession` may short-circuit with a redirect (unauthenticated on a
 * protected path, wrong role for the prefix, or already-authed on `/login`).
 * In those cases the response is returned as-is — there is no downstream
 * RSC render to read `x-pathname`, so layering it on top would be a no-op.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request, {
    'x-pathname': request.nextUrl.pathname,
  })
}

export const config = {
  // Run on every route except Next.js internals and static assets — auth
  // cookie refresh + role gating + `x-pathname` forwarding are cheap and
  // every dashboard surface needs them.
  matcher: ['/((?!_next/|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js|woff|woff2|ttf|map)$).*)'],
}
