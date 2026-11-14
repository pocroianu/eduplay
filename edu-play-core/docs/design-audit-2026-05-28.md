# Frontend Design/UI/UX Audit - 2026-05-28

## Reconciliation Note

This is a reconciliation pass after the current unstaged UI-debt diff in the
repo. It does not re-audit every screen from scratch; it updates the original
2026-05-28 audit against the current working tree so resolved findings no
longer remain in the active backlog.

`DESIGN.md`, `docs/ui-kit.md`, `.impeccable.md`, the Lexend font stack, the
EduPlay purple token spine, soft classroom cards, route-specific density rules,
and the shared Mantine theme are canonical. Direct Mantine usage is allowed when
it is covered by the shared EduPlay theme; kit primitives remain the stable
compatibility layer for shared UI.

Audit sources for this reconciliation:
- `DESIGN.md`, `docs/ui-kit.md`, `.impeccable.md`
- Static searches over `src/app/**`, `src/features/**`,
  `src/shared/components/**`, `.storybook/**`, and `docs/**`
- Current unstaged changes in the local working tree
- Existing tests and stories added by the UI-debt workers

Excluded from active product scoring:
- `src/shared/components/ui/seesaw-design-system/**` reference assets
- tests, fixtures, mocks, and generated Tailwind internals in
  `src/app/globals.css`

## Executive Scorecard

| Area | Score | Current read |
| --- | ---: | --- |
| Accessibility | 3/4 | Repeated library action labels and raw parent route errors were addressed; remaining risk is mostly legacy route-nav semantics, student-shell verification, and older surfaces that still re-roll controls. |
| Performance / motion | 3/4 | Game and activity reduced-motion work is now materially improved. Remaining confirmed motion debt is narrower and should be verified on child-facing shells rather than treated as a broad game-system failure. |
| Responsive | 3/4 | Parent notifications and student immersive shell ownership were improved. Teacher library search/filter layout still needs responsive verification and possible form hardening. |
| Theming / tokens | 3/4 | The shared EduPlay Mantine theme is now wired through app root and Storybook. Remaining token debt is concentrated in legacy Tailwind/global surfaces and report/chart fallbacks. |
| Design consistency | 3/4 | The direction is now consistently purple and Mantine-backed. Remaining inconsistency is mostly in teacher library/forms, admin IA/search, and legacy surfaces not yet migrated. |
| **Total** | **15/20** | **Improved from the original audit. The active backlog is now smaller and more specific.** |

Severity totals after reconciliation:

| Severity | Count | Meaning |
| --- | ---: | --- |
| P0 | 0 | No task-blocking issue remains in this reconciliation pass. |
| P1 | 3 | Major confirmed UX/system issues still worth prioritizing. |
| P2 | 7 | Important debt or verification work that should be scheduled. |
| P3 | 3 | Lower-risk consistency and polish items. |

Audience UX read:

| Audience | Score | Read |
| --- | ---: | --- |
| Public/auth | 7/10 | Auth shell remains coherent; root role redirects were improved in the current diff. |
| Teacher | 6/10 | Teacher dashboard direction is clearer, but library/forms remain the highest active UI debt. |
| Student | 7/10 | Shell ownership and game reduced-motion work improved. Browser verification is still needed for child immersive routes. |
| Parent | 8/10 | Notifications, invite/link copy, formatter usage, and raw error handling were materially improved. |
| Admin | 7/10 | Duplicate admin nav was reduced and top-bar search is now explicitly unavailable, but admin IA/search still needs product decision and verification. |

## Resolved Or Downgraded Findings

### Resolved - Mantine Theme/Provider Was Missing

Evidence: `src/shared/theme/mantine-theme.ts` now exports
`eduPlayMantineTheme`, `src/app/layout.tsx` passes it to `MantineProvider`, and
`.storybook/preview.tsx` uses the same theme.

Status: Resolved for provider wiring. Keep future theme changes synchronized
with `src/app/globals.css`, `DESIGN.md`, and `docs/ui-kit.md`.

### Resolved - Storybook Could Not Support Migration

Evidence: `.storybook/preview.tsx` wraps stories in `MantineProvider` and renders
the story content. Core stories now exist for `Button`, `Card`, `FormControls`,
`LibraryActivityCard`, and `SegmentedTabs`.

Status: Resolved for core migration safety. Additional feature-surface stories
are still useful but no longer a P1 blocker.

### Resolved - Removed Teacher AI/Messages Routes Still Appeared In Navigation

Evidence: teacher AI/messages route files are deleted in the current diff, and
`src/config/navigation.test.ts` covers keeping removed teacher AI and messages
routes out of desktop and bottom navigation.

Status: Resolved for navigation cleanup.

### Resolved - Parent Notification Dropdown Was Not Mobile-Safe Enough

Evidence: the fixed `w-[380px]` panel is no longer present in
`src/features/parent-portal/components/notification-dropdown.tsx`, and a new
`notification-dropdown.test.tsx` exists.

Status: Resolved for the confirmed fixed-width overflow issue. Keep responsive
browser coverage as part of normal parent-shell QA.

### Resolved - Raw Parent Link Error Text Reached Users

Evidence: `src/app/(dashboard)/parent/link-child/error.tsx` no longer renders
`error.message`; it shows stable Romanian fallback copy.

Status: Resolved.

### Resolved - Formatter And Parent Copy Cleanup

Evidence: parent activity feed, invite-code, child detail, learning map, and
teacher student detail code now use centralized formatters for the previously
flagged date/time/number cases. Formatter tests were added under
`src/lib/i18n/formatters.test.ts`.

Status: Resolved for the original confirmed formatter/report-token cleanup
items. Remaining direct `toLocale*` calls inside `src/lib/i18n/formatters.ts`
are expected because that module is the formatter boundary.

### Downgraded - Game Reduced-Motion Coverage

Evidence: game components now import `useReducedMotion` broadly, shared helpers
exist in `src/features/games/components/reduced-motion.ts`, and activity player
motion also uses `useReducedMotion`.

Status: Downgraded from broad P2 to targeted verification. `InteractiveLesson`
has a `motion-reduce:animate-none` branch for the previously visible pulse
case; remaining motion review should focus on browser behavior rather than
static import counts.

### Downgraded - Student Map/Play Duplicate Chrome

Evidence: `path-owns-shell.ts` now marks `ROUTES.STUDENT.MAP` and
`/student/activities/:instanceId/play` as shell-owning, with tests covering the
activity play route and existing shell-owning groups.

Status: Downgraded from confirmed/likely P1 to visual verification candidate.
Auth-backed browser checks should confirm the route chrome is correct before
closing completely.

### Downgraded - Admin Duplicate Navigation And Inert Search

Evidence: admin config now shows one activity/CMS destination, and
`AdminSearchInput` explicitly communicates that global search is unavailable
instead of pretending to be functional.

Status: Downgraded. The remaining issue is product/IA: decide whether admin
needs global search, page-local search only, or no top-bar search affordance.

### Resolved - Docs Direction Drift

Evidence: `DESIGN.md`, `docs/ui-kit.md`, and `.impeccable.md` now point at
EduPlay purple, Lexend, the shared Mantine theme, and direct Mantine usage where
theme coverage exists.

Status: Resolved for current direction. Keep compatibility names documented as
legacy API names, not design direction.

## Stabilization Evidence - 2026-05-29

Compile and component verification are now green for the audit stabilization
scope:

- `npm run typecheck` passes after restoring the game artifact schema/type
  contract and hidden Listen Tap compile interfaces.
- Focused portfolio, navigation, game embed, teacher library/forms, and shared
  kit unit suites pass.
- `npm run build-storybook` passes with only existing non-fatal warnings for
  missing MDX stories, large chunks, and plugin timing.

Browser smoke was attempted against `http://localhost:3000` with reduced motion
enabled. The app responded, but seeded teacher and student test credentials were
not accepted (`Email sau parolă incorectă.` and `Nume de utilizator sau PIN
greșit`), so protected teacher/student/admin routes redirected to `/login`.
Treat visual QA for authenticated teacher, student, and admin routes as
unverified until local seed/auth is refreshed.

## Remaining Confirmed Findings

### P1 - Teacher Library/Form Surfaces Still Need Responsive Hardening

Locations:
- `src/features/teacher-dashboard/components/TeacherLibrariesExploreContent.tsx:130`
- `src/features/teacher-dashboard/components/TeacherLibrariesExploreContent.tsx:514`
- `src/shared/components/layout/TopAppBar.tsx:432`

Impact: teacher library work improved, including contextual assign labels and
more Mantine usage, but the search/filter area still uses a width-capped layout
that needs verification at 390px, 768px, and 1280px. Teacher library chrome also
still contains visible external product language that should be either removed,
reframed as licensed reference material, or explicitly accepted by product.
The 2026-05-29 browser smoke reached the app but was blocked by failed seeded
teacher login, so this visual verification remains open.

Recommendation: finish the library/forms slice first: verify responsive layout,
remove stale external-product chrome if not intentional, and keep teacher forms
on themed Mantine or kit primitives.

Suggested command: `/adapt`

### P1 - Shared And Feature UI Still Have Legacy Tailwind Surfaces

Locations:
- `src/shared/components/ui/kit/Button.tsx`
- `src/shared/components/ui/kit/Card.tsx`
- `src/features/games/components/TeacherGameCard.tsx`
- `src/features/teacher-dashboard/components/TeacherActivityComposer.tsx`
- `src/features/reports/components/StudentReport.tsx`

Impact: the provider/theme direction is fixed, but several shared and feature
surfaces still hand-roll cards, buttons, form controls, chart colors, and action
states. This keeps visual drift alive even though the canonical direction is now
clear.

Recommendation: migrate by surface, not by blanket rewrite. Prioritize
teacher-facing library/activity/report flows, then retire global legacy classes
once their call sites are gone.

Suggested command: `/extract`

### P1 - Admin IA/Search Needs A Product Decision

Locations:
- `src/features/admin/components/AdminSearchInput.tsx`
- `src/features/admin/config.ts`
- `src/shared/lib/constants/routes.ts`

Impact: the duplicate nav target issue is reduced, and global search is no
longer deceptively active. The admin shell still needs a clear IA decision:
whether global search becomes real, remains an explicit unavailable placeholder,
or is removed until the workflow exists. The 2026-05-29 unauthenticated smoke
confirmed `/admin`, `/admin/cms/activities`, and `/admin/users` redirect to
`/login`; authenticated admin visual QA remains blocked until an admin seed is
available.

Recommendation: treat this as an IA/product backlog item before adding more
admin surfaces. Keep page-local table filters distinct from global search.

Suggested command: `/distill`

### P2 - Student Shell Verification Is Still Required

Locations:
- `src/app/(dashboard)/path-owns-shell.ts`
- `src/features/learning-map/components/LearningMap.tsx`
- `src/features/activities/components/ActivityPlayer.tsx`

Impact: static route ownership has been updated, but the original audit did not
complete seeded-auth browser screenshots. Child-facing map/play routes should be
verified visually for duplicate chrome, available play area, focus order, and
reduced-motion behavior. The 2026-05-29 smoke could not authenticate the seeded
student account, so `/student/map` and `/student/activities/[instanceId]/play`
still need authenticated visual verification.

Recommendation: run authenticated browser checks for `/student/map` and one
`/student/activities/[instanceId]/play` route before closing this audit thread.

Suggested command: `/arrange`

## Remaining Candidates And Lower-Risk Backlog

### P2 Candidate - Route Navigation Tab Semantics

Location: `src/shared/components/layout/TopAppBar.tsx`

Current read: route navigation still appears to use tab-like semantics in some
places. Confirm in rendered markup; if it is route navigation, prefer links with
`aria-current="page"` unless a full tab pattern exists.

### P2 Candidate - Child Touch Target Verification

Locations:
- `src/features/activities/components/FreeResponsePlayContent.tsx`
- `src/features/auth/components/student-pin-pad.tsx`

Current read: earlier static/browser checks found some child-adjacent controls
below the 64px kid-mode target. Recheck after current shell/activity changes
before filing new implementation work.

### P2 Candidate - Teacher Activity Filters

Location: `src/features/teacher-activities/components/TeacherActivitiesHub.tsx`

Current read: disabled filters may still look active. Confirm in browser and
either make the filters functional or visually disclose the disabled state.

### P2 Candidate - Listen Tap And Admin Romanian Copy

Locations:
- `src/features/teacher-dashboard/listen-tap/components/WordListsPageContent.tsx`
- `src/features/teacher-dashboard/listen-tap/components/WordListEditorContent.tsx`
- `src/features/admin/components/**`

Current read: broad copy cleanup happened elsewhere, but Listen Tap/admin copy
should still be swept for English fallbacks, ARIA labels, and Romanian
diacritics.

### P2 Candidate - Report And Chart Token Coverage

Location: `src/features/reports/components/StudentReport.tsx`

Current read: report cleanup was partially addressed, including tests. Verify
that chart colors and status tokens now map to canonical tokens before closing
the original report-token finding completely.

### P3 - Ellipsis And Retry Tone Consistency

Locations:
- `src/features/admin/components/FilterBar.tsx`
- `src/features/learning-paths/components/PathAssignmentDialog.tsx`
- `public/locales/ro/common.json`

Current read: low-risk copy polish. Standardize visible loading/placeholder copy
and adult retry tone when these files are next touched.

### P3 - Legacy Compatibility Names Remain

Locations:
- `src/shared/components/ui/kit/**`
- `docs/ui-kit.md`
- `DESIGN.md`

Current read: compatibility names such as `DuoCard` remain by design. This is
acceptable only while docs keep saying they are API compatibility names, not
current visual direction.

### P3 - Reference Asset Styling Is Not Product Debt

Location: `src/shared/components/ui/seesaw-design-system/**`

Current read: old reference files can contain non-current styling language and
raw colors. Do not count those as product UI debt unless they are imported into
shipping routes.

## Confirmed Non-Issues

- Mantine provider/theme wiring is no longer an active audit finding.
- Storybook preview/core stories are no longer an active audit finding.
- Removed teacher AI/messages navigation is no longer an active audit finding.
- Parent notification fixed-width overflow is no longer an active audit finding.
- Parent raw route error rendering is no longer an active audit finding.
- The broad formatter cleanup finding is no longer active for the originally
  cited UI components.
- The TypeScript blockers from the hidden Listen Tap compile surface and legacy
  game artifact action are no longer active.
- Product direction is now purple-first and documented consistently across the
  current design docs.

## Remaining Findings Backlog

1. **Teacher library/forms** - Finish responsive verification, remove or justify
   external-product library chrome, and keep forms on themed Mantine/kit
   primitives.
2. **Student shell verification** - Browser-check authenticated student map and
   activity play routes for duplicate chrome, focus order, play area, and
   reduced-motion behavior.
3. **Admin IA/search** - Decide whether global admin search is real, explicitly
   unavailable, or absent; keep page-local search/filter behavior separate.
4. **Legacy Tailwind surfaces** - Migrate remaining shared/feature UI surfaces
   in vertical slices, especially teacher activity/report/game cards and any
   global legacy classes still imported by product code.

## Suggested Command Order

1. **[P1] `/adapt`** - Teacher library/forms responsive pass and student-shell
   browser verification.
2. **[P1] `/extract`** - Vertical migration of remaining legacy Tailwind
   surfaces to themed Mantine or stable kit primitives.
3. **[P1] `/distill`** - Admin IA/search decision and top-bar affordance cleanup.
4. **[P2] `/harden`** - Route-navigation semantics, child touch targets, and
   remaining copy/ARIA verification.
5. **[P3] `/polish`** - Ellipsis, retry tone, and final microcopy consistency.

## Acceptance Criteria For Closing The Reconciled Audit

- Teacher library explore works without clipping at 390px, 768px, and 1280px.
- Student map/play shell ownership is verified in browser with seeded auth.
- Admin global search has a deliberate product state and no duplicate activity
  IA.
- Remaining legacy Tailwind surfaces are either migrated, tracked by issue, or
  explicitly accepted as transitional.
- Current docs continue to identify EduPlay purple plus the shared Mantine theme
  as the canonical design direction.
