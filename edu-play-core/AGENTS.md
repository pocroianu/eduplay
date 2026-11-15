# Agent Instructions

This is the canonical guide for every coding agent working in this repo:
Codex, Claude, local Paperclip agents, and future tools. Keep tool-specific
notes out of durable project rules unless the tool behavior materially changes
the workflow.

## Source Of Truth

Use the active GitHub issue, PR description, and linked docs as the workflow
source of truth. If local docs drift from the active issue or PR, update the
docs or call out the drift in the PR.

| Need | Source |
| --- | --- |
| Architecture, feature ownership, data flow | `ARCHITECTURE.md` |
| Design system, tokens, UI implementation rules | `DESIGN.md` |
| Branches, commits, reviews, merge process | `CONTRIBUTING.md` |
| Product requirements | Available feature PRDs in `docs/prd/` |
| API request/response details | `docs/api.md` |
| Game iframe protocol | `public/games/README.md` |
| Privacy, DPIA, data processors | Documentation missing; restore before production readiness claims |
| CI implementation | `Jenkinsfile` and `.github/workflows/README.md` |

`CLAUDE.md` is a compatibility shim that points here. Do not add new canonical
rules there.

## Quick Reference

```bash
npm run dev:full              # Supabase + Next.js local stack
npm run lint                  # Required after code changes
npm run typecheck             # TypeScript check
npm run test:unit             # Vitest unit/component tests
npm run test:e2e:smoke        # Focused Chromium E2E smoke suite
npm run check:agent-guardrails
npm run verify:agent          # Default local agent gate
```

`npm run verify:agent` runs lint, typecheck, unit tests, changed-file
agent guardrails, and Supabase type drift only when migrations changed. Full
Playwright remains a heavier gate: `npm run test:e2e`.

## Agent Guardrail Harness

- For any code change under `src/**`, `supabase/**`, `scripts/**`, or tests,
  run `npm run check:agent-guardrails` before handoff, even if you also run
  `npm run verify:agent`.
- Prefer running `npm run check:agent-guardrails` early after edits as a fast
  first gate, then run `npm run verify:agent` as the final local gate.
- If guardrails fail because of pre-existing or unrelated changed files, report
  the exact violations and ask whether to fix or leave them; do not claim the
  task is verified.

## Working Rules

- Keep issue, PR, and documentation links up to date rather than relying on
  ad-hoc notes.
- Always run `npm run lint` after code changes and fix errors before commit.
- Always run `npm run check:agent-guardrails` after code changes and fix or
  explicitly report violations before handoff.
- Run the relevant quality gates before landing code. Use `npm run
  verify:agent` as the default local gate unless the PR needs full E2E.
- Document important follow-up work in the relevant GitHub issue or PR before
  ending the session.
- Do not use `--no-verify`.
- Do not revert changes you did not make unless explicitly asked.

## Simplification Pass

Opportunistically use the globally installed `simplify` skill when a task
introduces or exposes unnecessary complexity. Treat this as a cross-cutting
final pass, not as permission to over-refactor.

Use it when:

- code becomes harder to read than before
- logic is duplicated
- abstractions feel heavier than the problem
- control flow is awkward or deeply nested
- a refactor, cleanup, or maintainability task is requested
- the final diff feels larger or more complex than necessary

Do not use it when:

- the task is a tiny targeted fix
- simplification risks changing behavior without tests
- public APIs or contracts could change unexpectedly
- the user explicitly asks for minimal or no refactoring

Default workflow:

1. Implement the requested change.
2. If complexity increased or obvious simplification is available, apply the
   `simplify` skill.
3. Preserve behavior and public interfaces unless the user asked otherwise.
4. Run relevant tests/checks.
5. Mention any simplification performed in the final summary.

## Architecture Rules

- Next.js App Router routes live in `src/app/`; feature logic lives in
  `src/features/{feature}/`.
- Server Components are the default. Add `'use client'` only for hooks,
  event handlers, browser APIs, or client-only libraries.
- Client code imports from `@/features/{name}`. Server code imports from
  `@/features/{name}/server`. Avoid deep imports across feature boundaries.
- Use `ROUTES` from `@/shared/lib/constants/routes`; do not hardcode internal
  route strings in app code.
- API v1 handlers live under `src/app/api/v1/**`, validate with Zod via
  `parseBody` / `parseQuery`, throw `ApiError`, and use `handleRoute()`.
- Supabase query helpers should accept a client parameter, avoid N+1 loops, and
  validate DB rows at boundaries where schemas exist.
- Schema changes require a migration, local reset, generated database types,
  and type drift verification. Follow
  `docs/adr/0003-database-migration-discipline.md` for database/migration
  decisions.
- Games are iframe-hosted and communicate through the formal postMessage
  protocol in `public/games/README.md`. Validate `event.origin` before trusting
  game messages and never target `'*'` from the shell.

## UI And Copy Rules

- `DESIGN.md` is the design authority. EduPlay uses the EduPlay design system.
- Student routes keep 64px minimum primary touch targets, 18px minimum body
  text, larger spacing, and reduced-motion-aware animation while using the same
  EduPlay visual language.
- Teacher, parent, and admin routes use denser layouts, sidebar-led navigation
  where established, and calmer motion.
- Use primitives from `@/shared/components/ui/kit` and icons through
  `@/shared/components/ui/Icon`.
- Use Mantine as the implementation foundation for reusable DOM UI. Extend
  Mantine-backed kit components instead of creating parallel native controls.
  Preserve native layout semantics, hidden form inputs, SVG artwork, and canvas
  rendering where appropriate. `npm run audit:mantine` reports adoption and gaps.
- Use token-based Tailwind classes from `src/app/globals.css`; avoid raw hex,
  arbitrary shadows, and arbitrary radii in production UI.
- User-facing copy is Romanian, informal where appropriate, and uses correct
  comma-below diacritics.
- Use centralized i18n/date/number formatters; do not call locale formatters
  directly in UI code when a project formatter exists.

## Database And Migrations

- Raw SQL migrations in `supabase/migrations/` are the database schema source
  of truth; do not introduce Prisma or Drizzle as a schema/migration authority.
- New migrations use one unique `YYYYMMDDHHMMSS_descriptive_name.sql` prefix
  and are forward-only once shared/applied.
- Prefer vertical domain-slice migrations that include schema, constraints,
  indexes, RLS, grants/RPCs, triggers, comments, and required schema-coupled
  backfills together.
- New tables are incomplete until RLS is enabled and explicit policies are
  defined in the same migration. Avoid broad `USING (true)` policies and never
  use blanket `IS NULL` visibility shortcuts.
- `SECURITY DEFINER` helpers/RPCs must set `search_path = public`, use explicit
  least-privilege grants, and validate caller role/ownership for mutating RPCs.
- Use expand → compatible read/write or dual-write → backfill → tighten →
  contract for risky schema changes.
- Required DB correctness belongs in migrations; demo/local baseline data and
  external renderer/catalog imports belong in TypeScript seed/import scripts.
- For schema changes, run `npx supabase db reset`, `npm run generate:types`,
  `npm run check:types-drift`, and `npm run test:unit` before handoff unless
  explicitly blocked and reported.

## Security And Privacy Gates

- Every dashboard prefix must be role-gated in
  `src/lib/supabase/middleware.ts`.
- Student PIN auth and password reset flows must keep their rate limiting.
  Rate limiters fail open if the limiter itself errors.
- RLS SELECT policies must not grant blanket visibility through `IS NULL`
  predicates. Cross-table policies should use `SECURITY DEFINER` helpers where
  needed to avoid recursion.
- Third-party analytics are banned in child-accessible routes:
  `/student/**`, `/play/**`, `/games/**`, and feature modules rendered there.
- Never expose raw framework, Supabase, or secret-bearing errors to users.
- New subprocessors or data-processing services must update the privacy docs
  and confirm an EU data path before production use.

## Testing And Review

- Unit/component tests use Vitest and should be colocated when practical.
- E2E tests use Playwright page objects under `tests/e2e/pages` and specs under
  `tests/e2e/specs`.
- Update tests when changing DOM structure, labels, text, routes, validation,
  or user-visible behavior.
- Use focused tests for narrow changes and broader E2E/manual verification for
  auth, RLS, privacy, route protection, game iframe, and critical workflows.
- The changed-file guardrail checker blocks new high-risk patterns without
  requiring historical cleanup in the same PR.

## Hold-Posture Merge Process (Retired)

> Retired on 2026-04-28 after EDU-104 shipped green self-hosted CI. The
> historical policy remains at `docs/process/hold-posture-merge-policy.md`.

Do not follow the hold-posture process for new PRs. Standard CI checks plus
normal review/approval are the merge gate again. `--no-verify` remains banned.
