/**
 * Guardrail tests for the Next.js root middleware (`src/middleware.ts`).
 *
 * EDU-310: a refactor (`e8cc02c`) and a follow-up (PR #97 / EDU-195) left
 * `src/middleware.ts` only injecting an `x-pathname` header — `updateSession`
 * (the function that refreshes the Supabase auth cookie AND enforces the
 * `ROLE_ROUTE_MAP` defense-in-depth role gate) was never invoked anywhere.
 *
 * RLS still gated the data, but the middleware-layer redirects that
 * `AGENTS.md` route-protection mandates were silently bypassed. These
 * tests pin the regression so a future refactor cannot drop the call again
 * without making noise in CI.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = join(__dirname, '..', '..', '..')
const ROOT_MIDDLEWARE = join(REPO_ROOT, 'src', 'middleware.ts')
const SUPABASE_MIDDLEWARE = join(REPO_ROOT, 'src', 'lib', 'supabase', 'middleware.ts')

describe('src/middleware.ts (root middleware composition)', () => {
  const source = readFileSync(ROOT_MIDDLEWARE, 'utf8')

  it('imports updateSession from the supabase middleware module', () => {
    expect(source).toMatch(
      /import\s*{[^}]*\bupdateSession\b[^}]*}\s*from\s*['"]@\/lib\/supabase\/middleware['"]/,
    )
  })

  it('invokes updateSession inside the exported middleware function', () => {
    // The exported `middleware` must call `updateSession` — otherwise the
    // role gate and Supabase cookie refresh are silently dropped.
    expect(source).toMatch(/export\s+(?:async\s+)?function\s+middleware\b/)
    expect(source).toMatch(/\bupdateSession\s*\(/)
  })

  it('forwards the resolved pathname via the x-pathname request header', () => {
    // EDU-195 contract: `(dashboard)/layout.tsx` reads `x-pathname` from
    // `next/headers` to decide whether to render its own SideNavBar.
    expect(source).toContain('x-pathname')
    expect(source).toMatch(/request\.nextUrl\.pathname/)
  })

  it('keeps the matcher excluding Next.js internals and static assets', () => {
    expect(source).toMatch(/matcher:\s*\[/)
    expect(source).toContain('_next/')
    expect(source).toContain('favicon')
  })
})

describe('src/lib/supabase/middleware.ts (updateSession)', () => {
  const source = readFileSync(SUPABASE_MIDDLEWARE, 'utf8')

  it('declares the ROLE_ROUTE_MAP defense-in-depth role gate', () => {
    expect(source).toContain('ROLE_ROUTE_MAP')
    expect(source).toMatch(/['"]\/teacher['"]/)
    expect(source).toMatch(/['"]\/student['"]/)
    expect(source).toMatch(/['"]\/parent['"]/)
    expect(source).toMatch(/['"]\/admin['"]/)
  })

  it('exports updateSession with an extraRequestHeaders parameter', () => {
    // The composition contract: `src/middleware.ts` passes `x-pathname` via
    // this parameter so it lands on the *request* (visible to RSCs via
    // `next/headers`), not just the response (which RSCs cannot read).
    expect(source).toMatch(/export\s+async\s+function\s+updateSession\s*\([^)]*extraRequestHeaders/)
  })

  it('redirects unauthenticated requests on protected paths to /login', () => {
    expect(source).toMatch(/!user/)
    expect(source).toMatch(/\/login/)
    expect(source).toMatch(/NextResponse\.redirect/)
  })

  it('redirects wrong-role users to their own dashboard', () => {
    expect(source).toContain('getRoleDashboard')
    expect(source).toMatch(/allowedRoles\.includes/)
  })

  it('rebuilds the forwarded request after Supabase refreshes auth cookies', () => {
    // Codex P1 on PR #138: if the Headers/`NextResponse.next()` options are
    // captured once before `setAll` runs, a session refresh mutates
    // `request.cookies` but the forwarded Cookie header stays stale, so RSCs
    // downstream see the expired session. Pin that the response is rebuilt
    // *inside* `setAll`, after `request.cookies.set(...)` mutates state.
    const setAllBlock = source.match(/setAll\s*\(cookiesToSet\)\s*{([\s\S]*?)\n\s{8}}/)
    expect(setAllBlock, 'setAll block not found in updateSession').toBeTruthy()
    const block = setAllBlock![1]
    expect(block).toMatch(/request\.cookies\.set/)
    // The response must be (re)assigned from a function call inside setAll —
    // not a top-level `nextOptions` snapshot reused after the cookie mutation.
    expect(block).toMatch(/supabaseResponse\s*=\s*\w+\s*\(/)
    expect(block).not.toMatch(/supabaseResponse\s*=\s*NextResponse\.next\s*\(\s*nextOptions\s*\)/)
  })
})
