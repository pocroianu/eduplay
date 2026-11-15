# EduPlay project audit — 14 November 2026

## Assessment

EduPlay has a substantial implementation and a sensible architecture, but the checked-in authorization model has release-blocking flaws. Treat it as a feature-rich product that needs a security and release-confidence stabilization phase before expanding use with real children's data.

The stack itself is suitable. The largest risks are database authorization, incomplete critical-path verification, dependency maintenance, and drift between documented guarantees and executable configuration. A framework rewrite would not address these problems.

This audit inspected both project directories, migration history, authentication, API helpers, game integration, package manifests/lockfiles, CI, deployment files, representative frontend/data code, and existing tests. Three parallel exploratory agents covered platform security, platform quality, and games. Findings were checked against source. No application fixes, dependency installs, database resets, or production operations were performed. This report is the only intentional source addition; checks may update ignored build/test caches.

Scope limits: no deployed database grants/policies, production accounts, firewall, hosting configuration, backups/restores, browser accessibility, or load behavior were verified. Security findings describe the checked-in migration chain; production exposure depends on what is actually deployed. This is not a certification or an exhaustive penetration test.

## Current state and stack

| Area | Implementation | Assessment |
|---|---|---|
| Platform | Next.js 16.2.4 App Router, React 19.2.5, TypeScript 5, React Compiler | Suitable architecture; framework patching is overdue according to current advisories |
| UI | Tailwind 4, Mantine 9.2.2, shared UI kit, Framer Motion, Phosphor icons | Useful central primitives; large feature components and overlapping libraries add maintenance cost |
| Forms/localization/charts | React Hook Form, Zod 4, i18next/react-i18next/next-i18next, Recharts | Appropriate capabilities; review unused/duplicated abstractions before adding more |
| Backend | Supabase Auth, PostgreSQL 15, Storage, SQL migrations, server actions and REST v1 routes | Good managed-service fit; application guards do not compensate for unsafe direct Data API policies |
| Games | Phaser 4.1 peer dependency, single Vite host, renderer/activity manifests | Strong direction away from duplicated template infrastructure |
| Shared game packages | game-core, phaser-ui, game-editor, validation | Good ownership boundaries; protocol definitions still duplicated across projects |
| AI authoring tooling | TypeScript CLI, ComfyUI, Ollama, Piper, Redis, Sharp, optional training tools | Operationally separate from student runtime; vulnerable dependencies and unsafe network defaults need attention |
| Testing/delivery | Vitest, Testing Library, Playwright, Storybook, Jenkins, npm lockfiles | Extensive tests exist; important user journeys are skipped and some suites are absent from CI |
| Deployment | Vercel Frankfurt configuration, Docker alternatives | Vercel region is explicit; production Docker recipe is inconsistent with current application requirements |

Snapshot counts: 997 platform TS/TSX files, 296 game/package/tool TS/TSX files, 60 SQL migrations, 11 renderer directories, and 26 activity directories. File counts include tests and are not a measure of completion. The outer workspace Git repository currently has no commits and stages the imported project trees; release history and branch protections cannot be established from this checkout.

Implemented surfaces include teacher class/student management, activities and assignments, student play/progress, parent linking/notifications/portfolios, and admin/CMS APIs. Route presence and successful compilation do not prove all workflows are complete. Some admin components explicitly document placeholder behavior.

## Verification actually performed

| Check | Result | Qualification |
|---|---|---|
| Platform lint | Pass, 0 errors / 35 warnings | Warnings remain debt |
| Platform TypeScript | Pass | Existing local dependency installation |
| Platform unit tests | Pass: 301 files, 1,928 tests | Mocks do not validate real database RLS |
| Platform production build | Pass | Next.js reports deprecated middleware convention; no Docker image was built |
| Game validation tests | Pass: 3 suites, 62 tests | Good config-validation baseline |
| Game-core tests | 39 passed; 2 suites failed at import | Blocked by stale local workspace junctions; not attributed to source defects |
| Game workspace build | Failed module resolution | Same stale-link limitation |
| Platform full dependency audit | 77 package findings: 5 critical, 27 high, 37 moderate, 8 low | Includes dev tooling and propagated dependency findings |
| Platform audit excluding dev | 10 package findings: 2 critical, 7 high, 1 moderate | These are package findings, not ten demonstrated application exploits |
| Games audit excluding dev | 7 package findings: 1 critical, 4 high, 2 moderate | Largely AI tooling; not evidence all are shipped to browsers |
| Live RLS / full E2E / browser a11y / load tests | Not run | No services were started for this audit |

The local `node_modules/@edu-play/*` junctions point into an older `personal/clones` checkout. In games, validation/game-core targets are missing or unsuitable. The platform protocol also has a stale junction, although TypeScript and Vitest explicitly alias its current source. Reproduce from clean lockfile installs before treating these results as release acceptance. Do not interpret the game import failures as confirmed repository bugs.

## Prioritized findings

P0 means an immediate release blocker; P1 means address before a broader release; P2 means planned remediation. Severity reflects impact and confidence, rather than simply copying scanner ratings.

### F01 — P0: Ordinary users can become administrators

[Initial schema:27](C:/Users/pocro/development/personal/eduplay/edu-play-core/supabase/migrations/20260107000000_initial_schema.sql:27) allows users to update their own profile without protecting the `role` column. The same file's [signup trigger:35](C:/Users/pocro/development/personal/eduplay/edu-play-core/supabase/migrations/20260107000000_initial_schema.sql:35) copies caller-controlled signup metadata into that role, whose allowed values include `admin`. No later migration was found that closes either path.

[API authorization:40](C:/Users/pocro/development/personal/eduplay/edu-play-core/src/lib/api/auth.ts:40) and [middleware:117](C:/Users/pocro/development/personal/eduplay/edu-play-core/src/lib/supabase/middleware.ts:117) then trust the resulting database role. Direct signup requires signup to be enabled; profile modification requires normal authenticated UPDATE privileges. Both are consistent with the checked-in setup, but deployed grants were not queried.

Remediation: make signup roles server-controlled; prevent ordinary callers from updating authorization fields; replace the permissive policy with column-safe permissions or an explicitly constrained mutation; inspect existing elevated accounts if this schema was deployed. Acceptance: real anon/authenticated-client tests cannot sign up as admin or change their role, while privileged admin workflows still work.

### F02 — P1: Parent-child links can be forged without an invitation

[Parent relationship policy:43](C:/Users/pocro/development/personal/eduplay/edu-play-core/supabase/migrations/20260107000003_parent_children.sql:43) checks only that `parent_id` equals the caller. It does not validate the caller's role or an invitation. The UPDATE policy at line 48 also leaves `student_id` mutable. A caller with a known student UUID and ordinary table grants can forge/repoint a link, after which other policies grant child-data access.

Remove direct client relationship creation and sensitive updates. Redeem invitations through one role-checked transaction that validates expiry/usage, consumes the code, and creates the link. Test cross-family denial directly through the Data API, independently of server actions.

### F03 — P1: New-parent invitation redemption appears blocked by its own RLS

[Link action:65](C:/Users/pocro/development/personal/eduplay/edu-play-core/src/features/parent-portal/actions/link-child.ts:65) reads an unused invite through the ordinary user client. [Invite policies:32](C:/Users/pocro/development/personal/eduplay/edu-play-core/supabase/migrations/20260107000004_parent_invite_codes.sql:32) only let teachers or the parent who already used a code read it. The action also reads the student before creating the relationship. This is a strong static finding, not a reproduced database test.

The transactional redemption operation from F02 should fix this flow too. Do not resolve it by exposing all unused invite records. Include successful first redemption, expired/used codes, concurrent redemption, and foreign-family attempts in database-backed tests.

### F04 — P1: Child drafts are not isolated between accounts on shared devices

[Draft key:213](C:/Users/pocro/development/personal/eduplay/edu-play-core/src/features/activities/components/FreeResponsePlayContent.tsx:213) includes assignment/activity/version IDs but no student identity. [Hydration:818](C:/Users/pocro/development/personal/eduplay/edu-play-core/src/features/activities/components/FreeResponsePlayContent.tsx:818) restores text and drawing from that key. The draft persists until successful submission; [logout:7](C:/Users/pocro/development/personal/eduplay/edu-play-core/src/features/auth/actions/logout.ts:7) does not clear it.

Two students using the same browser and class assignment can inherit unfinished work. Scope local drafts to the authenticated student, clear or partition on account changes, and add expiry. Verify with a two-account shared-device test. No live browser reproduction was performed.

### F05 — P1: Dependency security backlog includes the deployed framework

The current production dependency audit flags Next.js and i18next-fs-backend as critical packages, plus Zod and several transitive runtime packages as high. Next.js 16.2.4 falls within published affected ranges for [App Router middleware bypass](https://github.com/advisories/GHSA-26hh-7cqf-hhc6) and [image-optimization RCE](https://github.com/advisories/GHSA-2464-fhr4-w9xw). Individual exploitability depends on enabled features and deployment. The scan suggests Next.js 16.4.6; recheck advisories when implementing the upgrade.

The filesystem translation backend has a [prototype-pollution advisory](https://github.com/advisories/GHSA-2933-q333-qg83), but a vulnerable installed dependency is not proof that its affected API is used here. [Zod's oversized-collection advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) is relevant to validation hardening; enforce request-size limits before parsing too.

Games production dependencies include critical mongoose and high sharp/underscore/ws/zod findings, mainly in AI tooling. Prioritize the child-facing framework and reachable request-processing dependencies, then isolate/upgrade authoring tooling. Remove unused dependencies where established. Avoid an unreviewed `npm audit fix --force`; some changes cross major versions. Jenkins currently skips installation-time audits and has no explicit security-audit gate.

### F06 — P1: CI does not establish confidence in critical journeys or production artifacts

Successful [teacher login:27](C:/Users/pocro/development/personal/eduplay/edu-play-core/tests/e2e/specs/auth/teacher-login.spec.ts:27), [student login:30](C:/Users/pocro/development/personal/eduplay/edu-play-core/tests/e2e/specs/auth/student-login.spec.ts:30), [authenticated role redirects:60](C:/Users/pocro/development/personal/eduplay/edu-play-core/tests/e2e/specs/auth/role-gating.spec.ts:60), and [assignment lifecycle:259](C:/Users/pocro/development/personal/eduplay/edu-play-core/tests/e2e/specs/assignments/create-assign-launch.spec.ts:259) are skipped. Other assignment groups also unconditionally skip for missing seed data.

[Platform CI:82](C:/Users/pocro/development/personal/eduplay/edu-play-core/Jenkinsfile:82) runs useful checks but no production build; [Playwright:125](C:/Users/pocro/development/personal/eduplay/edu-play-core/playwright.config.ts:125) starts the development server. [Game CI:66](C:/Users/pocro/development/personal/eduplay/phaser-projects/Jenkinsfile:66) omits game-core, AI-content and editor unit suites and dedicated built-host E2E. [Game root lint:27](C:/Users/pocro/development/personal/eduplay/phaser-projects/package.json:27) is an echo placeholder.

Create deterministic minimal fixtures, enable the critical flows, run real role/ownership denial tests against Supabase, build production artifacts, and smoke-test those artifacts. Wire existing game unit suites and real lint into CI. Green CI should fail if any essential journey is disabled.

### F07 — P1: The advertised production Docker path is internally inconsistent

[Dockerfile:8](C:/Users/pocro/development/personal/eduplay/edu-play-core/Dockerfile:8) uses Node 20, while the package requires exactly Node 24.12.0 and engine-strict is enabled. Its install stage omits the local workspace package manifest/source and development dependencies needed for building. The runner copies `.next/standalone`, but [Next configuration:5](C:/Users/pocro/development/personal/eduplay/edu-play-core/next.config.ts:5) never enables standalone output. Its health check calls `/api/health`; the implemented route is `/api/v1/health`.

These are confirmed configuration contradictions; no image build was attempted. Repair the multi-stage install/build/output contract and add an image build/start/health smoke test. Choose one supported local Supabase path and deprecate obsolete Compose instructions clearly.

### F08 — P1 conditional: AI production services are published without an access boundary

[AI production Compose:8](C:/Users/pocro/development/personal/eduplay/phaser-projects/packages/ai-content/docker/docker-compose.prod.yml:8) publishes ComfyUI, Ollama, Piper, and Redis on host ports without loopback bindings. Redis has no declared authentication. A reachable deployment can expose workloads/cache to network clients; public Internet exposure was not verified.

Keep these services internal or bind to loopback and require authenticated access through a controlled gateway. Review host firewall rules before deployment. Pin image digests and upstream repository commits; current `latest` tags and mutable ComfyUI/custom-node clones also prevent reproducible builds.

### F09 — P2: Privileged helper functions disclose other users' relationships

[Classmate RPC:68](C:/Users/pocro/development/personal/eduplay/edu-play-core/supabase/migrations/20260419232837_profile_preferences.sql:68) is SECURITY DEFINER and accepts arbitrary student IDs without verifying the caller. [Older relationship helpers:16](C:/Users/pocro/development/personal/eduplay/edu-play-core/supabase/migrations/20260327000001_fix_rls_infinite_recursion.sql:16) similarly accept arbitrary teacher/parent identities without explicit execution revocation.

Bind identities to `auth.uid()`, check authorized delegation, and keep internal helpers outside the exposed API schema where feasible. Test function EXECUTE permissions and cross-account input. Returned identifiers also make F02 easier to exploit.

### F10 — P2: Notification INSERT policy does not enforce its stated service-only intent

[Notification policy:40](C:/Users/pocro/development/personal/eduplay/edu-play-core/supabase/migrations/20260107000005_parent_notifications.sql:40) is named for the service role but has no `TO service_role` restriction and uses `WITH CHECK (true)`. With ordinary INSERT grants, clients can forge notification content for known users. Remove normal-client insertion; service-role operations already bypass RLS. Add negative database tests.

### F11 — P2: Student PIN throttling can be bypassed through direct Auth requests

[PIN conversion:1](C:/Users/pocro/development/personal/eduplay/edu-play-core/src/features/auth/utils/student-auth-password.ts:1) deterministically converts the four-digit PIN into the Supabase password. [Student login:34](C:/Users/pocro/development/personal/eduplay/edu-play-core/src/features/auth/actions/student-login.ts:34) limits attempts only before calling public Supabase Auth. A direct Auth client skips this custom limit. Actual brute-force resistance therefore depends on deployed Auth limits and network controls.

Verify per-account backend enforcement, concurrent attempts, and failure behavior. The application limiter deliberately fails open under current project instructions; changing that posture should be explicit. Do not count the UI/server-action limit as the sole protection for low-entropy credentials.

### F12 — P2: Explicit internal API errors leak database details

[Response serialization:75](C:/Users/pocro/development/personal/eduplay/edu-play-core/src/lib/api/response.ts:75) sends `ApiError.message` verbatim, while callers such as [assignments:50](C:/Users/pocro/development/personal/eduplay/edu-play-core/src/app/api/v1/assignments/route.ts:50) put raw Supabase errors into that message. Sanitize internal errors centrally and log details server-side with request identifiers. Preserve useful validation messages without exposing constraint/schema internals.

### F13 — P2: Class statistics silently truncate as usage grows

[Class query:44](C:/Users/pocro/development/personal/eduplay/edu-play-core/src/features/teacher-dashboard/queries/get-class-students.ts:44) fetches all matching activity progress without pagination or server aggregation. [API configuration:11](C:/Users/pocro/development/personal/eduplay/edu-play-core/supabase/config.toml:11) caps results at 1,000 rows. A class reaching that cap gets incomplete statistics; query errors are also turned into empty collections.

Move dashboard aggregates into scoped database queries/RPCs, paginate detail lists, and propagate errors. Test a class with more than 1,000 progress rows and confirm totals match SQL aggregates.

### F14 — P2: Shared game contracts and lifecycle migration remain unfinished

[Game bridge types:1](C:/Users/pocro/development/personal/eduplay/phaser-projects/packages/game-core/src/bridge/types.ts:1) remain separate from the [platform protocol](C:/Users/pocro/development/personal/eduplay/edu-play-core/packages/activity-protocol/src/messages.ts:1). [Bridge validation:193](C:/Users/pocro/development/personal/eduplay/phaser-projects/packages/game-core/src/bridge/PostMessageBridge.ts:193) checks origin/type then casts payloads. Its ACTIVITY_INIT path logs rather than applying all initialization state, despite the shell sending initial settings.

Use one versioned runtime contract and shared schema validation on both sides. Test initialization, mute/language settings, progress/completion, teardown, and malformed messages through real iframe integration. Retire legacy question-event/global-context paths only after this coverage exists.

### F15 — P2: Game editor keyboard entry is missing

[Dropdown trigger:33](C:/Users/pocro/development/personal/eduplay/phaser-projects/packages/game-editor/src/customDropdown.ts:33) and [toolbar actions:80](C:/Users/pocro/development/personal/eduplay/phaser-projects/packages/game-editor/src/createGameEditor.ts:80) use `tabIndex=-1` without a complete roving-focus entry mechanism. Existing arrow-key handling does not make controls reachable by Tab. Restore normal tab stops or implement the complete toolbar pattern; test keyboard-only entry, operation, and focus return. Broader WCAG conformance was not measured.

### F16 — P2: Coverage configuration overstates how much release confidence the suite provides

[Coverage configuration:49](C:/Users/pocro/development/personal/eduplay/edu-play-core/vitest.config.ts:49) excludes `src/app` from measured sources, including API handlers. Thresholds at line 83 are only 10% lines/statements, 15% functions, and 5% branches, with stale implementation-progress comments. This is a gate weakness, not a claim that actual coverage is only 10%.

Include route sources and establish measured current baselines. Raise requirements first for authorization, invitation redemption, progress, consent and submissions. Restore selected mobile/WebKit coverage: those projects are commented out while package scripts still advertise them.

### F17 — P2: Privacy and operational assurances lack evidence in the checkout

[Agent guidance:22](C:/Users/pocro/development/personal/eduplay/edu-play-core/AGENTS.md:22) names `docs/privacy/` as authoritative, but that directory is absent. [Next configuration:3](C:/Users/pocro/development/personal/eduplay/edu-play-core/next.config.ts:3) references a missing PRIVACY document. Frankfurt function configuration alone does not establish all storage, Auth, AI, logging, support, and subprocessors' data paths.

Restore a concrete data inventory, retention/deletion policy, processor/location record, consent flows, operational access controls, and backup/restore evidence before production assurance. This audit makes no legal compliance determination. [Health route:3](C:/Users/pocro/development/personal/eduplay/edu-play-core/src/app/api/v1/health/route.ts:3) returns static process liveness rather than dependency readiness; document the distinction and add an authenticated operational readiness signal.

### F18 — P2: Same-origin games and broadly privileged CMS enlarge the trust boundary

[Game iframe:474](C:/Users/pocro/development/personal/eduplay/edu-play-core/src/features/games/components/GameEmbed.tsx:474) has no sandbox, and [renderer proxy:90](C:/Users/pocro/development/personal/eduplay/edu-play-core/src/app/api/v1/renderer-proxy/[...path]/route.ts:90) re-serves executable storage content on the shell origin. Treat renderer publication/storage write privileges as application-code deployment privileges. No untrusted upload-to-XSS chain was demonstrated. Restrict proxy buckets/paths and consider a separate renderer origin with validated protocol messages.

[Directus migration:25](C:/Users/pocro/development/personal/eduplay/edu-play-core/supabase/migrations/20260528000000_directus_role_and_schema.sql:25) grants BYPASSRLS and broad current/future public-table DML, with a denylist. Starting NOLOGIN is a good safeguard; before enabling it, replace the broad grant with an allowlist matching actual CMS needs. Jenkins also mounts the host Docker socket: verify untrusted PRs cannot execute in that trust context. Neither item proves a deployed compromise.

## Maintainability and performance direction

Preserve the feature-based platform structure, server/client entry points, SQL migration authority, single game host, manifest discovery, and shared UI kit. These are good foundations. Preserve verified `getUser()` checks, server-only service clients, private artifact storage, short-lived signed URLs, origin checks, and explicit service-role checks in newer mutating RPCs.

Concentrate refactoring where state ownership is complex: FreeResponsePlayContent is 1,086 lines; InteractiveLesson 939; TopAppBar 890; student/class detail components exceed 800. Line count alone is not a defect, but these are useful review targets. Extract draft persistence, recording/drawing lifecycles, and data aggregation behind narrow tested interfaces. Avoid repository-wide churn while authorization fixes are pending.

Reduce compatibility debt deliberately: question-centric versus activity-centric progress, duplicated bridge contracts, global service/context lookup, legacy Docker setups, and README references to Phaser 3 despite Phaser 4 in current manifests. Update missing requirements/privacy links and remove obsolete commands. Inventory overlapping form/UI/i18n layers before standardizing; do not delete dependencies solely because they appear redundant.

No actual bundle budget, Core Web Vitals, query latency, concurrency ceiling, or production memory baseline was established. The passing build is evidence of buildability, not performance. Measure student launch time, renderer payload size/cache behavior, dashboard SQL volume, and submission upload memory under representative devices and data volumes before claiming scale readiness.

## Recommended execution order

1. **Security stabilization:** fix F01/F02/F04; implement atomic invitation redemption for F03; patch the reachable dependency graph. Audit deployed role and family-link data if these policies were used.
2. **Prove the boundaries:** add real anon/authenticated database tests for role changes, relationships, helper execution, notifications, and cross-family reads. Verify direct Auth PIN limits. Keep these required in CI.
3. **Make release gates meaningful:** enable seeded successful login/assignment flows, production build/start smoke tests, game unit tests and real lint; repair production Docker and clean-install verification.
4. **Operational readiness:** restrict AI network access and CMS grants, pin upstream builds, establish privacy/data-path records, readiness/monitoring and restore evidence.
5. **Targeted debt reduction:** aggregate dashboard queries, unify protocol/schema validation, isolate local drafts/media state, fix editor keyboard access, then raise coverage and restore mobile/browser checks.

A reasonable next milestone is a security-and-release-readiness release with explicit acceptance tests, rather than more feature breadth. Keep product expansion moving only where it does not increase the unresolved authorization surface.

## External references

Authorization recommendations follow [Supabase's RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security): user-editable metadata is not an authorization authority, and exposed data must be protected at the database boundary. The Docker output contradiction is grounded in [Next.js standalone-output documentation](https://nextjs.org/docs/app/api-reference/config/next-config-js/output). Dependency advisories linked above were checked on the audit date; scan counts are time-sensitive and must be refreshed during remediation.
