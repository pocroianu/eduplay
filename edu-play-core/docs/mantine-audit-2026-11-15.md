# Mantine adoption audit — 2026-11-15

EduPlay now uses Mantine as the foundation for reusable React DOM controls and
surfaces. Public kit APIs and EduPlay tokens remain the product-facing contract.
This sweep also retires the imported reference bundle as design authority:
EduPlay is developing its own identity.

## Scope and method

GPT-6.1 Terra audited the shared kit, navigation, overlays, tables, and migration
integration. GPT-6 Luna audited and migrated feature-level controls. The primary
agent integrated the results, migrated buttons and lesson/drawing controls,
consolidated themed provider fallbacks, and ran repository-wide checks.

The repeatable TypeScript AST audit scans production `.ts`/`.tsx` under `src`,
excluding tests, stories, declarations, test helpers, and archived prototypes.
It follows named exports through local barrels to distinguish direct Mantine
imports from indirect dependencies. Indirect adoption means a file depends on
Mantine-backed code; it does not mean every element it renders uses Mantine.
These are source dependency measurements, not bundle-size measurements or a
WCAG certification.

```powershell
npm run audit:mantine
npm run audit:mantine -- --check
```

The second command exits unsuccessfully if a visible native control or a custom
semantic widget is found. It also inspects ARIA roles on native elements, so
a dialog or progress indicator cannot pass just because its file imports Mantine.
Native hidden form inputs are exempt. The snapshot is
[`mantine-audit-2026-11-15.json`](./mantine-audit-2026-11-15.json).

## Adoption results

| Measure | Before | After |
| --- | ---: | ---: |
| Production TSX files | 390 | 391 |
| Direct Mantine imports | 69 (17.7%) | 115 (29.4%) |
| Shared kit TSX files with direct Mantine imports | 11 / 48 | 39 / 49 |

The new file is `MantineBoundary`, which supplies the EduPlay theme when a
component is mounted outside the app provider. It reuses an existing provider
instead of nesting or replacing its theme.

After the sweep, 176 additional TSX files depend on Mantine through local
components: 291 of 391 files have a direct or indirect dependency. The other
100 files include static layouts, routing/server composition, context helpers,
and artwork. Adding a redundant import to these files would not improve UI.

**Visible native control and custom semantic widget findings after migration: zero.**

## Migrated component families

| Family | Mantine foundation | Preserved behavior |
| --- | --- | --- |
| Button, ChunkyButton, action cards and interactive surfaces | Button, UnstyledButton, Card | Link routing, disabled/loading states, icons, tokens, child target sizes |
| Card, DuoCard, stat/hero/insight surfaces, auth panels | Card, Paper, Container | Public variants, semantic root tags, content slots and density |
| Badge, Pill, PillBadge, SubjectPill, avatars | Badge, Avatar | Tone tokens, initials, selection, labels and size contracts |
| Text, search, selection and authoring controls | Input, TextInput, Textarea, Checkbox, Radio, Switch | Native form values, refs, helper/error associations, controlled state |
| Progress and rings | Progress, RingProgress | Clamping, accessible values, percentage display, reduced motion |
| Popup and student/upload/reward dialogs | Modal, Drawer | Escape, focus trap/return, accessible naming, non-dismissible reward backdrop |
| Tooltip and toast | Tooltip, Notification | Hover/focus trigger behavior, live regions, dismissal and timer cleanup |
| Tables and segmented choices | Table, UnstyledButton | Responsive mobile cards, sort behavior, row semantics, existing pressed-button semantics |
| Drawing toolbar and lesson controls | Radio.Card, UnstyledButton, TextInput | Canvas behavior, answer validation, 64px child targets, arrow-key radio selection |

The final semantic sweep also migrated LessonDrawer, PathAssignmentDialog,
settings switches, password strength, report bars, system health, student XP,
and teacher/student progress indicators.

Teacher/admin forms, reports, learning-path builders and progress matrices,
family selection, student preferences, language selection, and upload controls
were included in the feature sweep. Hidden fields and drawing canvases remain
native.

## Findings and resolutions

| Severity | Finding | Resolution and evidence |
| --- | --- | --- |
| P1 | Inline pseudo-selectors in `mantine-theme.ts` did not implement browser hover/focus styling | Moved selectors into `mantine-theme.module.css`, with reduced-motion gating; regression checks reject selector keys in inline style objects |
| P1 | Clickable table rows lost native row semantics and could activate when a nested action was clicked | Kept `Table.Tr` semantics, guarded nested actions and keyboard targets, gave mobile cards a separate row action; interaction regression tests added |
| P1 | Disabled kid-mode link buttons lacked robust activation protection | Added tab exclusion, click cancellation, pending state and attribute forwarding; pointer/keyboard regressions covered |
| P1 | Custom dialogs duplicated overlay/focus lifecycle; initial integration retained fixed descendants inside transformed Mantine content | Replaced viewport wrappers with compound Modal content; integration review verified the containing-block problem and the fix removed those wrappers |
| P2 | Shared primitives and feature controls duplicated Mantine capabilities | Migrated controls and surfaces to the appropriate Mantine implementations; AST audit reports zero visible native controls |
| P2 | Standalone fallback providers used the default theme and repeated context checks | Added and reused `MantineBoundary`; tests verify standalone EduPlay colors and preservation of an existing custom provider |
| P2 | PopupRow accepted `href` without rendering navigation | Uses a polymorphic Mantine control with Next Link; navigation regression test added |
| P1 | Login could swallow a Next.js redirect signal and render `NEXT_REDIRECT` as a form error | Preserved framework control-flow exceptions with `unstable_rethrow`; regression verifies the signal reaches the framework boundary instead of the error alert, following the [Next.js API guidance](https://nextjs.org/docs/app/api-reference/functions/unstable_rethrow) |
| P2 | Parent browser checks used obsolete or ambiguous headings, and the notifications page lacked a main landmark | Updated page objects to current content headings and restored the page's semantic main landmark; parent notification browser suite passes |

No P0 issue was established. No speculative P3 redesign work is included.

## Technical quality assessment

These scores describe static implementation evidence and component checks, not
visual certification across all screens.

| Dimension | Provisional score | Evidence and remaining limit |
| --- | ---: | --- |
| Accessibility | 3 / 4 | Library-managed dialogs, keyboard radio selection, explicit labels, row semantics and disabled-link regressions; full assistive-technology audit remains separate |
| Performance | 3 / 4 | Shared provider reuse, stable imports, preserved server-component defaults where possible; no measured before/after bundle or timing comparison |
| Responsive design | 3 / 4 | Existing responsive table cards and route layouts retained; child targets retained; exhaustive viewport/text-zoom review not performed |
| Theming | 3 / 4 | Shared tokens, themed fallback and supported CSS selectors; no dark-mode redesign is claimed |
| Anti-patterns | 3 / 4 | Removed parallel native controls and retired imitation as a design target; existing visual compositions were preserved, not redesigned |
| Total | **15 / 20** | **Good, with the runtime/visual limits above** |

## Intentional exceptions

Seven kit files do not depend on Mantine: `BackgroundGlyph`, `RewardGlyph`,
`Vulpita` (SVG artwork), `PinDotRow` (bespoke PIN status visualization), and
`EmptyState`, `PageHeader`, `SectionHeader` (static semantic composition).
These have no custom native form or action controls to replace.

Phaser canvas objects remain Phaser-native. Mantine does not render into the
canvas. The standalone config editor uses plain TypeScript/DOM rather than
React, so migrating it would be a separate framework conversion. Neither is
included in the React adoption percentages.

`@mantine/core`, `@mantine/form`, and `@mantine/hooks` remain installed at the
existing pinned version. Form-state libraries and domain logic were preserved.

## Validation

`npm run verify:agent` passes: 306 test files and 1,940 tests, TypeScript,
lint with one existing image warning, and agent guardrails. The production
build passes. Focused regression checks cover controls, provider inheritance,
drawing radio keyboard selection, lesson submission, popup navigation, table
cell actions, and modal/backdrop behavior.

The initial browser smoke run returned 18 passes, 25 skips, and 12 failures.
The failing paths were investigated and corrected or verified in dedicated
reruns: student login passed all nine active tests with two existing skips;
parent notifications passed all nine tests, including assignment creation and
read persistence; both active admin redirect checks passed with five existing
authenticated-admin skips. Student checks include mobile, keyboard entry, and
64px targets. The full smoke command was not rerun as one batch after these
fixes; the dedicated suites above provide the final browser evidence. Existing
skipped authenticated/visual scenarios remain a coverage limit.

For a future visual pass, use `/audit` on the affected routes and `/polish` after
any resulting fixes; do not turn source adoption percentages into a visual
quality target.
