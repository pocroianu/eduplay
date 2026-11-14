# Whole-Frontend Seesaw + Mantine Design Audit - 2026-06-07

## Summary

This audit compared EduPlay's frontend against the live Seesaw app shell, the internal Seesaw reference bundle, `DESIGN.md`, `docs/ui-kit.md`, Mantine usage, and static route/component evidence. This was an audit pass only: no product code changes were made.

Current frontend health score: **18 / 32**.

| Dimension | Score | Notes |
| --- | ---: | --- |
| Seesaw alignment | 2 / 4 | The direction is recognizable, but primary palette, shell semantics, hover behavior, and student/play surfaces drift. |
| Mantine compliance | 2 / 4 | Mantine is present in major shell/home surfaces, but many filters, tabs, menus, and forms still use one-off Tailwind controls. |
| Accessibility | 2 / 4 | Browser checks found no `<main>` landmark on the teacher dashboard, small action targets, weak focus rings, and hand-built menu/tab keyboard risk. |
| Responsive layout | 3 / 4 | `/teacher` had no horizontal overflow at tested widths; role-protected student/parent/admin coverage remains blocked by auth/session constraints. |
| Theming and token use | 2 / 4 | CSS variables, Mantine theme, and the Seesaw reference bundle disagree on primary color and shadow vocabulary. |
| Motion and interaction | 2 / 4 | Reduced-motion guards exist in many places, but scale, chunky shadows, unguarded pulses, and large transform affordances remain. |
| Performance risk | 3 / 4 | No acute performance defect was found, but visual/e2e coverage is too skipped to prove route health. |
| Anti-patterns | 2 / 4 | Direct feature icon imports, emoji icons, native controls, backdrop blur, glassmorphism comments, and raw colors remain. |

Severity count: **P0: 0, P1: 6, P2: 8, P3: 3**.

## Sources And Evidence

- Live Seesaw shell inspected at <https://app.seesaw.me/> and public activity library at <https://app.seesaw.me/activities>.
- Live Seesaw traits observed: Lexend/Tajawal font stack, primary purple `#5F2FA8`, centered white auth canvas, 400px role/login controls, dense public activity grid, soft cards, restrained hover without scale.
- Internal reference bundle: `src/shared/components/ui/seesaw-design-system/project/README.md`, `SKILL.md`, and `colors_and_type.css`.
- Repo design sources: `DESIGN.md`, `docs/ui-kit.md`, `src/app/globals.css`, `src/shared/theme/mantine-theme.ts`.
- Web Interface Guidelines checked from <https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md>.
- Browser screenshots captured locally in `.tmp/design-audit-2026-06-07/`:
  - `home-mobile-390.png`
  - `home-desktop-1280.png`
  - `login-mobile-390.png`
  - `login-desktop-1280.png`
  - `student-login-mobile-390.png`
  - `teacher-protected-1280.png`
  - `student-protected-390.png`
  - `admin-protected-1280.png`

## Browser Matrix

Widths checked: **320, 390, 768, 1280, 1440** with normal and reduced-motion preferences.

The local browser session was authenticated as a teacher. Attempts to inspect `/`, `/login`, `/login/elev`, `/student`, and `/admin` all resolved to `/teacher`, so this run can claim browser-rendered route evidence for `/teacher` only. Student, parent, admin, auth, and play routes are covered by static scans and skipped-test evidence below, not by fresh visual proof.

Teacher dashboard browser results:

- No horizontal overflow at 320, 390, 768, 1280, or 1440.
- The rendered page reported `mainCount: 0`, so the dashboard content currently lacks a semantic `<main>` landmark in this route path.
- Small interactive targets were observed in the teacher shell: 32px icon actions, roughly 41px sidebar rows, 42px search input, and 25px text links.
- Default heading structure was present, with headings such as `Bun venit, Maria Popescu`, `Găsește activități gata de predat pentru Preșcolar`, `Clasele mele`, and `Resurse pentru profesori`.

## P1 Findings

### P1-01 - Primary palette and design-source drift

Evidence:

- Live Seesaw and the internal README define the Seesaw-like primary as `#5F2FA8`: `src/shared/components/ui/seesaw-design-system/project/README.md:86`, `src/shared/components/ui/seesaw-design-system/project/README.md:169`.
- Current app globals use `#8B5CF6`: `src/app/globals.css:82`, `src/app/globals.css:112`.
- Mantine theme also starts the purple ramp at `#8B5CF6`: `src/shared/theme/mantine-theme.ts:12`.
- The internal CSS reference bundle currently maps `--ss-purple-600` to teal `#0E7C8C`: `src/shared/components/ui/seesaw-design-system/project/colors_and_type.css:19`.

Score impact: Seesaw alignment -2, theming/token use -2, Mantine compliance -1.

Recommended fix: Choose one approved EduPlay primary palette, then update the Mantine theme, global CSS variables, and internal Seesaw reference bundle in the same slice. If `#5F2FA8` remains the target, make it the Mantine `primaryColor` source and derive hover/active/focus colors from the theme instead of feature-level literals.

Mantine remediation path: **theme**.

### P1-02 - Role-based visual audit coverage is blocked

Evidence:

- Browser attempts for auth, student, and admin routes resolved to `/teacher` in the current local session.
- Authenticated and visual e2e suites are heavily skipped:
  - `tests/e2e/specs/teacher/dashboard.spec.ts:16`, `tests/e2e/specs/teacher/dashboard.spec.ts:91`, `tests/e2e/specs/teacher/dashboard.spec.ts:116`
  - `tests/e2e/specs/student/dashboard.spec.ts:21`, `tests/e2e/specs/student/dashboard.spec.ts:71`, `tests/e2e/specs/student/dashboard.spec.ts:125`, `tests/e2e/specs/student/dashboard.spec.ts:177`
  - `tests/e2e/specs/admin/overview.spec.ts:41`, `tests/e2e/specs/admin/overview.spec.ts:95`, `tests/e2e/specs/admin/overview.spec.ts:112`
  - `tests/e2e/specs/auth/teacher-login.spec.ts:94`, `tests/e2e/specs/auth/student-login.spec.ts:149`

Score impact: Responsive layout -2, accessibility -1, performance risk -1.

Recommended fix: Add seeded role sessions or isolated Playwright storage states for teacher, student, parent, and admin, then restore route-matrix screenshots for 320, 390, 768, 1280, and 1440. Keep this as a visual QA harness; it should not change product UI.

Mantine remediation path: **layout-only**.

### P1-03 - Teacher shell misses a main landmark and has undersized action targets

Evidence:

- `/teacher` page returns only the provider and dashboard content: `src/app/(dashboard)/teacher/page.tsx:18`.
- Dashboard content root is a generic Mantine `Box`, not `main`: `src/features/teacher-dashboard/components/TeacherDashboardContent.tsx:540`.
- Sidebar collapse control is `ActionIcon size={32}`: `src/shared/components/ui/kit/SidebarRail.tsx:308`, `src/shared/components/ui/kit/SidebarRail.tsx:312`.
- Teacher home search action is also `ActionIcon size={32}`: `src/features/teacher-dashboard/components/TeacherDashboardContent.tsx:568`, `src/features/teacher-dashboard/components/TeacherDashboardContent.tsx:572`.
- Browser accessibility evidence on `/teacher`: `mainCount: 0`; target-size checks found 32px actions and roughly 41px nav rows.

Score impact: Accessibility -2, Seesaw alignment -1, Mantine compliance -1.

Recommended fix: Move the dashboard content under a shared Mantine-backed shell primitive that renders `Box component="main"` with a stable content label. Raise desktop interactive controls to at least 44px and keep student/kid-mode controls at the documented 64px minimum. Do this in the shared kit so teacher, parent, admin, and student shells inherit the same landmark and target-size behavior.

Mantine remediation path: **kit primitive**.

### P1-04 - Hand-built menus and tabs carry keyboard behavior risk

Evidence:

- Admin row actions implement menu roles manually: `src/features/admin/components/RowActionMenu.tsx:88`, `src/features/admin/components/RowActionMenu.tsx:101`.
- Teacher activity cards implement menu roles manually: `src/features/teacher-activities/components/ActivityCardMenu.tsx:48`, `src/features/teacher-activities/components/ActivityCardMenu.tsx:60`.
- Filter/tab groups are hand-built:
  - `src/features/admin/components/FilterBar.tsx:85`, `src/features/admin/components/FilterBar.tsx:95`
  - `src/features/teacher-dashboard/components/TeacherLibraryDiscoveryContent.tsx:82`, `src/features/teacher-dashboard/components/TeacherLibraryDiscoveryContent.tsx:87`
  - `src/features/teacher-dashboard/components/ClassesPageContent.tsx:105`, `src/features/teacher-dashboard/components/ClassesPageContent.tsx:112`
  - `src/features/teacher-activities/components/CreateActivityWizard.tsx:298`, `src/features/teacher-activities/components/CreateActivityWizard.tsx:301`, `src/features/teacher-activities/components/CreateActivityWizard.tsx:319`

Score impact: Accessibility -2, Mantine compliance -2, Seesaw alignment -1.

Recommended fix: Replace manual ARIA tabs/menus with shared Mantine-backed kit components. Use Mantine `Menu` for row/card actions and Mantine `Tabs` or a kit segmented control for filter tabs. Where the control is a select/filter hybrid, use the Mantine Combobox path instead of custom popover/list state.

Mantine remediation path: **custom component**.

### P1-05 - Forms and filters have inconsistent focus-visible treatment

Evidence:

- Teacher review queue textareas use `focus:border-primary focus:outline-none` without a visible ring: `src/features/teacher-activities/components/TeacherReviewQueue.tsx:75`, `src/features/teacher-activities/components/TeacherReviewQueue.tsx:99`.
- Admin filter input uses border-only focus: `src/features/admin/components/FilterBar.tsx:78`.
- Admin table filters/selects repeat border-only focus:
  - `src/features/admin/components/AdminUsersTable.tsx:357`
  - `src/features/admin/components/AdminGamesTable.tsx:270`
  - `src/features/admin/components/AdminAuditTable.tsx:345`, `src/features/admin/components/AdminAuditTable.tsx:354`, `src/features/admin/components/AdminAuditTable.tsx:362`, `src/features/admin/components/AdminAuditTable.tsx:379`
- Path assignment dialog fields use border-only focus: `src/features/learning-paths/components/PathAssignmentDialog.tsx:205`, `src/features/learning-paths/components/PathAssignmentDialog.tsx:233`, `src/features/learning-paths/components/PathAssignmentDialog.tsx:256`.
- Portfolio upload/filter fields repeat the same pattern: `src/features/portfolio/components/TeacherUploadModal.tsx:44`, `src/features/portfolio/components/TeacherPortfolioFilters.tsx:16`.

Score impact: Accessibility -2, Mantine compliance -2, theming/token use -1.

Recommended fix: Convert these surfaces to Mantine `TextInput`, `Textarea`, `Select`, and validation components wired through `@mantine/form` where stateful validation exists. Centralize focus rings in Mantine theme/component styles, then use `classNames`, `styles`, or CSS modules rather than feature-level border-only Tailwind strings.

Mantine remediation path: **form**.

### P1-06 - Student/play surfaces still use chunkier game styling than the Seesaw language

Evidence:

- Student map uses Baloo instead of the Seesaw/EduPlay Lexend spine: `src/features/student-dashboard/components/quest-map/QuestMap.tsx:59`.
- Quest nodes and game chrome use hard 3D offset shadows:
  - `src/features/student-dashboard/components/quest-map/QuestNode.tsx:69`
  - `src/features/games/components/PreGameCover.tsx:81`
  - `src/features/games/components/OfflineNotice.tsx:55`
  - `src/features/games/components/ActionStrip.tsx:37`, `src/features/games/components/ActionStrip.tsx:110`, `src/features/games/components/ActionStrip.tsx:126`, `src/features/games/components/ActionStrip.tsx:139`
- Student report actions scale on press: `src/features/reports/components/StudentReport.tsx:678`, `src/features/reports/components/StudentReport.tsx:686`.
- Game library hero uses backdrop blur: `src/features/games/components/GameLibraryHero.tsx:40`.

Score impact: Seesaw alignment -2, motion/interaction -2, anti-patterns -1.

Recommended fix: Keep student touch sizing and playful hierarchy, but move the surfaces back to Lexend, soft cards, quiet canvas, token shadows, and non-scale hover/press states. Build any kid-mode variants as Mantine-backed kit primitives so `/student`, `/student/map`, `/play/[activityId]`, and `/games` share the same interaction rules.

Mantine remediation path: **kit primitive**.

## P2 Findings

### P2-01 - Feature code bypasses the shared icon wrapper

Evidence:

- `src/features/teacher-dashboard/components/TeacherDashboardContent.tsx:19`
- `src/features/teacher-dashboard/components/TeacherDashboardContent.tsx:29`
- Approved wrapper locations still exist in `src/shared/components/ui/Icon.tsx:4` and `src/shared/components/ui/Icon.registry.ts:135`.
- Emoji icon in production UI: `src/features/teacher-dashboard/components/RewardsLeaderboardPanel.tsx:24`.

Score impact: Mantine compliance -1, anti-patterns -1.

Recommended fix: Route feature icons through `@/shared/components/ui/Icon` and replace emoji glyphs with registered icons or a Mantine-themed reward glyph component.

Mantine remediation path: **kit primitive**.

### P2-02 - Raw colors and literal shadows remain in feature code

Evidence:

- Report subject palette uses raw hex colors: `src/app/(dashboard)/teacher/students/[studentId]/report/page.tsx:50`, `src/app/(dashboard)/teacher/students/[studentId]/report/page.tsx:51`, `src/app/(dashboard)/teacher/students/[studentId]/report/page.tsx:52`, `src/app/(dashboard)/teacher/students/[studentId]/report/page.tsx:53`.
- Stats card uses a literal rgba shadow: `src/components/dashboard/StatsCard.tsx:41`.
- Seesaw compatibility helper contains raw `rgb(...)` rules: `src/shared/components/ui/kit/seesawInteraction.ts:13`, `src/shared/components/ui/kit/seesawInteraction.ts:15`, `src/shared/components/ui/kit/seesawInteraction.ts:17`, `src/shared/components/ui/kit/seesawInteraction.ts:18`.

Score impact: Theming/token use -2, Mantine compliance -1.

Recommended fix: Promote report/chart colors and shadows into Mantine theme tokens or kit-level CSS variables. Keep compatibility rules only if they are explicitly documented as legacy shims and not copied into new UI.

Mantine remediation path: **theme**.

### P2-03 - Native selects and filter controls should use Mantine Combobox patterns

Evidence:

- `src/features/games/components/GameLibraryFilters.tsx:72`
- `src/features/games/components/ParentGamesPageContent.tsx:91`
- Related hand-built filter groups appear in `src/features/admin/components/FilterBar.tsx:85`, `src/features/teacher-dashboard/components/TeacherLibraryDiscoveryContent.tsx:82`, and `src/features/teacher-activities/components/TeacherActivitiesHub.tsx:404`.

Score impact: Mantine compliance -2, accessibility -1.

Recommended fix: Use Mantine Combobox-backed selects for games, parent filters, admin status filters, and library chips. Keep option rendering, active state, keyboard navigation, empty state, and mobile popover behavior centralized.

Mantine remediation path: **combobox**.

### P2-04 - Reduced-motion gaps remain in loading and transform states

Evidence:

- Unguarded pulse loading states:
  - `src/app/(dashboard)/student/map/loading.tsx:3`
  - `src/app/(dashboard)/admin/cms/activities/[id]/loading.tsx:3`
- Student PIN helper uses transform hover: `src/features/auth/components/student-pin-pad.tsx:241`.
- Several kit and feature controls use broad `transition-all`: `src/shared/components/ui/kit/SubjectPill.tsx:96`, `src/features/lessons/components/InteractiveLesson.tsx:380`, `src/features/lessons/components/InteractiveLesson.tsx:800`, `src/features/lessons/components/InteractiveLesson.tsx:883`, `src/features/lessons/components/InteractiveLesson.tsx:914`.

Score impact: Motion/interaction -2, accessibility -1.

Recommended fix: Define Mantine theme transition tokens and kit interaction classes that always include reduced-motion behavior. Replace `transition-all` with property-scoped transitions and avoid transform/scale except where motion is essential and guarded.

Mantine remediation path: **custom component**.

### P2-05 - Responsive hotspots need visual proof after role seeding

Evidence:

- Known overflow-prone surfaces from static review:
  - `src/features/student-dashboard/components/quest-map/QuestMap.tsx:59`
  - `src/features/lessons/components/InteractiveLesson.tsx:800`
  - `src/features/lessons/components/InteractiveLesson.tsx:914`
  - `src/features/teacher-activities/components/CreateActivityWizard.tsx:298`
- Browser route coverage for student, play, parent, and admin was not available in this session because the local browser stayed in teacher auth.

Score impact: Responsive layout -1, accessibility -1.

Recommended fix: After seeded role sessions exist, capture mobile/desktop screenshots for `/student`, `/student/map`, `/play/[activityId]`, `/parent`, `/parent/children/[id]`, `/admin/users`, `/admin/audit`, and CMS/editor routes. Verify long Romanian strings, open menus/dialogs, bottom nav, and reduced motion.

Mantine remediation path: **layout-only**.

### P2-06 - Raw clickable cards and role-button patterns should move into kit primitives

Evidence:

- Parent child summary card uses a non-native button pattern: `src/features/parent-portal/components/child-summary-card.tsx:104`.
- Several teacher/game surfaces use custom card/button strings instead of the shared kit or Mantine primitives, including `src/features/teacher-activities/components/TeacherActivitiesHub.tsx:482` and `src/features/games/components/TeacherGamesPageContent.tsx:196`.

Score impact: Mantine compliance -1, accessibility -1.

Recommended fix: Use Mantine `UnstyledButton`, `Card`, or a shared clickable-card kit primitive with consistent role, focus, disabled, hover, and target-size behavior. Avoid feature-level `role="button"` unless there is no native alternative.

Mantine remediation path: **custom component**.

### P2-07 - Global legacy utilities still enable non-Seesaw styling

Evidence:

- `src/app/globals.css:3260`, `src/app/globals.css:3264`, `src/app/globals.css:3268`, `src/app/globals.css:3272`, `src/app/globals.css:3276`
- `src/app/globals.css:3396`, `src/app/globals.css:3401`
- `src/app/globals.css:6516`, `src/app/globals.css:6520`, `src/app/globals.css:6524`, `src/app/globals.css:6528`

Score impact: Anti-patterns -1, theming/token use -1.

Recommended fix: Do not delete generated utilities blindly. First remove or migrate live call sites, then retire the chunky shadow, blur, and hard-coded `.bg-seesaw-*` helpers from the generated/global styling surface.

Mantine remediation path: **theme**.

### P2-08 - Class shell ownership remains brittle around route prefixes

Evidence:

- Prior exploratory route inventory flagged shell ownership drift around `path-owns-shell`, teacher class subroutes, and `/student/map`.
- The current audit could not fully browser-verify `/teacher/classes/[classId]/*` or `/student/map` due the active teacher session and route data requirements.

Score impact: Seesaw alignment -1, responsive layout -1.

Recommended fix: Keep a single Mantine-backed dashboard shell owner per route family, especially for teacher class workspace, student map, parent child detail, admin CMS/editor, and play/activity routes. Confirm class context bars use the documented fixed rail, white page header, quiet canvas, and 88px class context bar pattern.

Mantine remediation path: **layout-only**.

## P3 Findings

### P3-01 - Uppercase/tracking-heavy labels are still used in some compact controls

Evidence:

- `src/features/teacher-dashboard/components/RewardsLeaderboardPanel.tsx:109`
- `src/shared/components/ui/kit/SegmentedTabs.tsx:61`

Score impact: Seesaw alignment -1.

Recommended fix: Prefer sentence/title case and normal letter spacing for Romanian UI labels unless the design system explicitly reserves uppercase for metadata.

Mantine remediation path: **theme**.

### P3-02 - Generated font utilities keep Baloo available globally

Evidence:

- `src/app/fonts.ts:4`
- `src/app/globals.css:2733`, `src/app/globals.css:2734`, `src/app/globals.css:5764`

Score impact: Theming/token use -1.

Recommended fix: If Baloo remains only for temporary game branding, scope it to that component family. The Seesaw-like UI spine should stay Lexend across shells, cards, forms, and navigation.

Mantine remediation path: **theme**.

### P3-03 - Open menu/dialog/error/empty states need screenshot baselines

Evidence:

- Open-state screenshots were not captured for role-protected menus/dialogs in this run.
- Dialog-heavy surfaces include `src/features/learning-paths/components/PathAssignmentDialog.tsx:205`, `src/features/admin/components/AdminUsersTable.tsx:443`, and student profile flows covered by skipped e2e tests.

Score impact: Accessibility -1, responsive layout -1.

Recommended fix: Add visual baselines for default, hover, keyboard focus, open menu/dialog, loading, empty, error, long Romanian text, and mobile bottom-nav states after seeded role sessions are available.

Mantine remediation path: **layout-only**.

## Prioritized Remediation Order

1. **Token convergence**: settle the primary purple and sync Mantine theme, globals, Seesaw bundle, and docs.
2. **Visual QA harness**: seed role-specific browser states and unskip route-matrix screenshots.
3. **Shell/landmarks/targets**: centralize dashboard shell ownership and raise target sizes through shared Mantine kit primitives.
4. **Controls migration**: replace hand-built menus, tabs, filters, and selects with Mantine-backed kit primitives and Combobox patterns.
5. **Form migration**: move border-only focus fields into Mantine Form/Input patterns.
6. **Student/play polish**: normalize kid-mode surfaces to Lexend, quiet canvas, soft cards, token shadows, and reduced-motion-aware hover states.

## Static Scan Commands Used

```bash
rg -n "#[0-9A-Fa-f]{3,8}|rgb\(|rgba\(|boxShadow|box-shadow" src/app src/components src/features src/shared/components src/shared/theme --glob "*.tsx" --glob "*.ts" --glob "*.css"
rg -n "hover:scale|active:scale|transition-all|shadow-chunk|shadow-card|font-baloo|@phosphor-icons/react|backdrop-blur|role=\"button\"" src/app src/components src/features src/shared/components --glob "*.tsx" --glob "*.ts"
rg -n "focus:outline-none|outline-none|tablist|role=\"tab\"|role=\"menu\"|aria-haspopup" src/app src/components src/features src/shared/components --glob "*.tsx" --glob "*.ts"
rg -n "describe\.skip|test\.skip|it\.skip|skip" tests/e2e/specs --glob "*.ts"
```

## Audit Boundary

No production UI files were intentionally changed in this pass. The only intended repository artifact is this audit report. The local `.tmp/design-audit-2026-06-07/` screenshots are evidence artifacts for this audit session and can be regenerated by the future visual QA harness.
