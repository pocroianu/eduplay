# ARCHITECTURE.md — EduPlay System Design

> This document describes the architecture of the EduPlay platform across both project directories. It is the reference for understanding how components fit together, how data flows, and where to make changes for a given concern.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Repository Map](#repository-map)
3. [edu-play-core (Web Platform)](#edu-play-core-web-platform)
4. [phaser-projects (Game Engine)](#phaser-projects-game-engine)
5. [Game Integration Protocol](#game-integration-protocol)
6. [Database Design](#database-design)
7. [Authentication Architecture](#authentication-architecture)
8. [API Layer](#api-layer)
9. [Feature Flags](#feature-flags)
10. [Data Flow Diagrams](#data-flow-diagrams)
11. [Infrastructure & Deployment](#infrastructure--deployment)
12. [Decision Log](#decision-log)

---

## System Overview

EduPlay is an educational gaming platform for Romanian children (ages 3–12). The platform has two concerns that are separated into adjacent project directories in this repository:

| Concern | Repository | Technology |
|---------|-----------|-----------|
| Web platform (shell, auth, management, progress) | `edu-play-core` | Next.js 16 + Supabase |
| Educational games | `phaser-projects` | Phaser 4 + TypeScript + Vite |

Games are built through the shared Activity host in `phaser-projects`, deployed to Supabase Storage, and served through the platform renderer proxy. `public/games/` retains legacy same-origin hosting support. The web platform embeds games in iframes and communicates with them via the **postMessage protocol** (see [Game Integration Protocol](#game-integration-protocol)).

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Student)                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              edu-play-core (Next.js)                  │   │
│  │                                                       │   │
│  │  Auth ─── Dashboard ─── Game Player Shell            │   │
│  │                              │                        │   │
│  │                         postMessage                   │   │
│  │                              │                        │   │
│  │                    ┌─────────────────┐                │   │
│  │                    │  Game iframe    │                │   │
│  │                    │  (Phaser 4)     │                │   │
│  │                    │  /games/...     │                │   │
│  │                    └─────────────────┘                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
   Supabase API                  Supabase Auth
   (Postgres + RLS)              (JWT sessions)
```

---

## Repository Map

```text
eduplay/
├── edu-play-core/          # Web platform
│   ├── src/                # Routes, feature modules, shared UI and utilities
│   ├── packages/activity-protocol/
│   ├── supabase/           # Database migrations and local configuration
│   └── public/games/       # Legacy hosting and mock game
└── phaser-projects/        # Game workspace
    ├── packages/           # game-core, game-editor, phaser-ui, validation, ai-content
    ├── renderers/          # Package-less renderer plugins and metadata
    ├── activities/         # Versioned activity manifests and content
    └── tools/config-editor/
```

---

## edu-play-core (Web Platform)

### Application Layers

```
HTTP Request
     │
     ▼
Next.js Middleware (src/lib/supabase/middleware.ts)
     │  Role-gated route enforcement
     ▼
App Router (src/app/)
     │  Route segments — pages, layouts, loading, error
     ▼
Feature Module (src/features/{feature}/)
     │  Components, Hooks, Actions, Queries, Schemas
     ▼
Supabase Client (src/shared/lib/supabase/)
     │  Server or Browser client, RLS enforced
     ▼
PostgreSQL (Supabase)
```

### Feature Module Structure

Each domain is encapsulated in `src/features/{name}/`:

```
features/auth/
├── components/     # UI components (client-safe)
├── hooks/          # React hooks
├── actions/        # Server Actions (mutations)
├── queries/        # Data fetching (server-only)
├── schemas/        # Zod validation schemas
├── types/          # TypeScript types
├── index.ts        # Public API (client-safe exports)
└── server.ts       # Server-only entry point (queries)
```

**Import discipline:**
- Client code imports from `@/features/{name}` (barrel export)
- Server code imports from `@/features/{name}/server`
- Never deep-import across feature boundaries

### Route Architecture

```
src/app/
├── (auth)/                     # Public: /login, /register, /reset-password
│   └── login/page.tsx
├── (dashboard)/                # Protected — role middleware applied
│   ├── teacher/                # /teacher/...
│   │   ├── classes/
│   │   ├── students/
│   │   └── assignments/
│   ├── student/                # /student/...
│   │   └── dashboard/
│   ├── parent/                 # /parent/...
│   │   └── dashboard/
│   └── admin/                  # /admin/...
│       └── games/
├── play/[activityId]/          # Canonical Activity player (iframe host)
└── games/[gameId]/             # Legacy Game player (compatibility only)
```

Role routing is enforced in `src/lib/supabase/middleware.ts` via `ROLE_ROUTE_MAP`. Every new role-gated prefix must be registered there.

### Active Feature Modules

This table reflects what actually lives in `src/features/` today. `classes`,
`students`, and `assignments` are **not** standalone modules — their UI and
server code is owned by `teacher-dashboard`, and their validation schemas
live under `features/api/schemas/`. Route handlers for those resources live
in `src/app/api/v1/{classes,students,assignments}/`. Treat this table as
authoritative when adding new code — do not create a `features/classes` or
`features/students` directory; extend `teacher-dashboard` instead.

| Module | Responsibility | Notable contents |
|--------|---------------|------------------|
| `auth` | Login, registration, password reset, student PIN auth | teacher/student/parent auth actions, rate limiter |
| `games` | Legacy game catalog plus the shared iframe host used by Activity and legacy launches during migration | `GameEmbed`, `GamePageContent`, category themes |
| `teacher-dashboard` | Teacher home view, class management, student management | `ClassesPageContent`, `ClassDetailContent`, `StudentsPageContent`, `StudentDetailContent`, `StudentRosterTable`, `StudentStatusBadge`, dashboard stats, roster queries |
| `student-dashboard` | Student home view (activities, progress, rewards) | student landing panels, progress tiles |
| `parent-portal` | Parent progress monitoring and child linking | children list, child detail, invite-code link flow |
| `teacher-management` | Admin management of teachers | teacher CRUD schemas and admin UI |
| `admin` | Platform administration | currently `/admin/games` only; expansion pending |
| `reports` | Progress dashboards and export | per-student report, cross-class views (partial) |
| `lessons` | Lesson/activity scheduling (evolving) | lesson scaffolding; not yet feature-complete |
| `learning-map` | Visual progress map (evolving) | map UI for student journey |
| `activities` | F9 creative activity types and the universal in-shell player | `ActivityPlayer`, code-side `registerActivityType`/`getActivityType` registry, `getActivityInstance` query against `activity_instances` |
| `api` | Shared API utilities (`requireAuth`, `parseBody`, etc.) and Zod schemas for `classes`, `students`, `assignments`, `games` under `features/api/schemas/` | used by every `src/app/api/v1/*` route |

Migration note: do not add new Activity-domain behavior to `features/games`.
That module may keep the legacy catalog/routes and generic iframe host until a
future `features/player` extraction. New Activity behavior belongs in
`features/activities`.

**Not feature modules (intentionally):**

- `classes` — lives in `teacher-dashboard/components/Class*.tsx` + `teacher-dashboard/queries/get-teacher-classes.ts`; route handlers in `src/app/api/v1/classes/`; schema in `features/api/schemas/class.schema.ts`.
- `students` — lives in `teacher-dashboard/components/Student*.tsx` + `teacher-dashboard/queries/get-class-students.ts`; route handlers in `src/app/api/v1/students/`; schema in `features/api/schemas/student.schema.ts`.
- `assignments` — route handlers in `src/app/api/v1/assignments/`; schema in `features/api/schemas/assignment.schema.ts`. Teacher-facing UI is still a gap (tracked in the roadmap).

---

## phaser-projects (Game Engine)

### Monorepo Structure

`phaser-projects` uses npm workspaces. Shared libraries and tools are npm workspaces; renderers under `renderers/` are package-less plugins discovered by the single Activity host.

### Shared Packages

| Package | Purpose |
|---------|---------|
| `packages/game-core` | Singleton managers: `GameManager`, `AudioManager`, `AccessibilityManager`, `ConfigLoader` |
| `packages/validation` | Zod-based config schema validation |
| `packages/game-editor` | Phaser Editor v4 integration utilities |
| `packages/ai-content` | AI-assisted game content generation tooling |

### Game Template Architecture

Every game template follows this scene flow and manager pattern:

```
Boot → Preload → Level → Results
                  ↑         │
                  └── Play Again ─┘

Managers (singletons, accessed via getInstance()):
├── GameManager      — state, scoring, question progression, events
├── AudioManager     — SFX, music, volume, persistence
├── AccessibilityManager — keyboard nav, screen reader, focus
└── ConfigLoader     — async config + i18n loading, caching
```

### Configuration-Driven Content

Playable content is versioned under `activities/`:

```text
activities/fruits-01/
├── activity.json          # Activity identity and renderer/version requirement
└── versions/1/
    ├── config.json        # Content and gameplay settings
    ├── strings/           # Localized content
    └── assets/            # Activity assets where applicable
```

The shared host discovers `activities/*/activity.json` and
`renderers/*/renderer.json`. Start it with `npm run start:activities`, then open
`/activities/fruits-01` or a renderer preview under `/templates/<renderer>/`.

### Adding Activity Content

1. Add an Activity manifest and versioned configuration matching its renderer.
2. Validate with `npm run validate:all-configs` in `phaser-projects`.
3. Preview through the shared Activity host.
4. Import local demo content and renderer assets through the platform seed flow.
   Production publication must preserve Activity/version/assignment identity.

---

## Game Integration Protocol

This is a **formal API boundary** between `phaser-projects` and `edu-play-core`. Changes must coordinate the shell and game workspace in the same PR.

### Executable Contract

`edu-play-core` owns the framework-free `@edu-play/activity-protocol` package
under `packages/activity-protocol/`. The package contains the wire-message
schemas, TypeScript types, parser helpers, trusted-origin helpers, and canonical
fixtures used by the web shell and consumed by Phaser renderers through a pinned
package version or Git tag. It must not import React, Next.js, Supabase, Phaser,
or persistence code.

### Flow

```
edu-play-core (shell)              phaser-projects (game iframe)
       │                                      │
       │  <iframe src="/api/v1/game-proxy/...">│
       │──────────────────────────────────►  │
       │                                      │  Boot, Preload
       │                                      │  Config loaded
       │  ◄──────── ACTIVITY_READY ──────────│
       │  (dismiss loading spinner)           │
       │                                      │  User plays
       │  ◄──────── PROGRESS_UPDATE ─────────│
       │  (update progress bar)               │
       │                                      │  Game ends
       │  ◄──────── GAME_COMPLETE ───────────│
       │  (record score, show results)        │
       │                                      │
       │  ──────── postMessage API ──────────►│
       │  (optional config injection)         │
```

### Messages: Game → Shell

| Message type | When sent | Key fields |
|---|---|---|
| `ACTIVITY_READY` | Game loaded and interactive | `gameId` |
| `PROGRESS_UPDATE` | During gameplay | `currentSet`, `totalSets`, `progress` (0–1) |
| `GAME_COMPLETE` | Game session ends | `score`, `totalSets`, `timeSpent`, `starRating?`, `screenshotDataUrl?` (PNG dataURL) |

### Activity Launch Identity

Learner/domain identity is carried by `activityId`, `versionId`, and
`assignmentId`. The `configUrl` iframe query parameter is only a boot-time
renderer concern: it is an exact same-origin JSON document URL used by the
Renderer Template preload path. `ACTIVITY_INIT` may carry runtime context, but
must not carry `configUrl`. Renderers must not infer learner progress identity
from the `game` query parameter or from `configUrl`.

### Security Rule

The shell (`GameEmbed.tsx`) **always validates `event.origin`** before trusting postMessage data. Use `getTrustedOrigin()`. Never send postMessage to `'*'` from the shell.

Game-reported scores are **not authoritative for high-stakes scenarios** — the server must validate them independently.

### Building and Syncing Renderer Assets

The supported single-host build lives in `phaser-projects`:

```bash
npm run build:host --workspace=@edu-play/game-core
```

For local demo setup, `npm run seed` in `edu-play-core` imports Activities and
builds/uploads the host through `scripts/seed/renderer-sync.ts`. That flow uses
the renderer-proxy base path required when hosting under the platform. It writes
demo data and is not a production deployment command.

The old per-template `deploy:games` commands were removed: they referenced the
deleted template registry/build scripts and the retired `games` storage bucket.
A standalone production publication command is still required.

---

## Database Design

### Platform: Supabase (Postgres 15)

Local dev runs via Supabase CLI. Migrations live in `supabase/migrations/`.

### Core Tables

```
profiles              — User accounts (extends supabase.auth.users)
├── id (uuid, FK auth.users)
├── role (teacher | student | parent | admin)
├── full_name
└── avatar_url

classes               — Teacher's class groups
├── id
├── teacher_id (FK profiles)
├── name
└── grade_level (preschool | kindergarten | grade-1 | grade-2)

students              — Student accounts (username + PIN, no email)
├── id
├── class_id (FK classes)
├── username
├── pin_hash
└── display_name

parent_children       — Parent ↔ student relationships
├── parent_id (FK profiles)
└── student_id (FK students)

activities            — Canonical authored content and renderer selection
├── id, template       — template references an activity_types definition
├── title, description, thumbnail_url
├── config_data, config_schema_version
├── status, visibility_scope, is_published
└── created_by

activity_versions     — Immutable published/ready snapshots
├── id, activity_id, version_number
└── config_data and renderer/config metadata

child_artifacts       — Student-uploaded content (drawings, photos, audio, video)
├── id
├── student_id (FK students)
├── class_id (FK classes)
├── artifact_type (drawing | photo | audio | video | other)
├── storage_path
├── visibility (visibility_status enum: draft | internal_teacher_only
│               | family_visible | archived)
├── reviewed_by (FK profiles)
└── reviewed_at
    Visibility lifecycle: draft → teacher review → internal_teacher_only
    or family_visible → archived. Teacher review is required before any
    artifact becomes family_visible (PRIVACY.md §7.1).

audit_log             — Append-only log for child-artifact state changes
├── id
├── actor_id (FK profiles)
├── actor_role
├── action (publish | delete | visibility_change | create)
├── artifact_id
├── artifact_table (default: child_artifacts)
├── previous_state (JSONB)
├── new_state (JSONB)
└── created_at
    Populated by database triggers on child_artifacts INSERT/UPDATE/DELETE.
    Queryable by admins (full) and teachers (scoped to their classes).

assignments           — Teacher-created Activity obligations
├── id, teacher_id, student_id / class_id
├── activity_id        — required canonical Activity target
├── version_id         — required immutable version pin
└── due_date, status

activity_progress     — Canonical learner progress per Activity
├── id, student_id, activity_id
├── last_version_id    — most recently played version; not progress identity
└── score, attempts, status, time_spent, last_played_at
```

The Activity-only cutover migration (`20260518000000_activity_only_cutover.sql`)
dropped `games`, `game_progress`, legacy game pointers, and the games storage
bucket. It requires assignments to pin both Activity and Activity Version.
Learning paths target Activity templates. Historical migrations describe earlier
states; use the full migration chain and generated database types for the current
schema. Some presentation types still use Game-shaped names for Activity data.

### Row Level Security (RLS)

All tables have RLS enabled. Key policy patterns:

- Teachers see only their own classes and students.
- Students see only their own progress and assigned games.
- Parents see only their linked children's progress.
- Admins have full access via service role.

Helper functions (`get_teacher_class_ids`, `get_parent_student_ids`) use `SECURITY DEFINER` to break circular dependency loops. See migrations for details.

**Never use blanket `column IS NULL` visibility in SELECT policies** — this was a prior security incident.

### Schema Changes

Database and migration discipline is recorded in
`docs/adr/0003-database-migration-discipline.md`. In short: raw SQL migrations
are the schema source of truth, migrations are forward-only with unique
timestamp prefixes, new tables need RLS/policies in the same migration, and
risky changes should use expand/backfill/contract.

1. Write a migration in `supabase/migrations/`.
2. Run `npx supabase db reset` locally to apply.
3. Regenerate TypeScript types: `npm run generate:types`.
4. Verify type drift: `npm run check:types-drift`.
5. Commit both the migration and the updated `src/shared/types/database.ts`.

---

## Authentication Architecture

### Adult Users (Teacher, Parent, Admin)

Standard Supabase Auth: email + password, JWT sessions.

```
Login form → Supabase Auth API → JWT → middleware session cookie
                                          │
                                    ROLE_ROUTE_MAP enforcement
```

Password reset is rate-limited: 3 requests per hour per email, tracked in `password_reset_requests` table.

### Student Auth

Students use **username + 4-digit PIN** (no email). This is a custom flow:

```
Student enters username + PIN
        │
        ▼
Teacher-scoped Supabase RPC
        │  Validates PIN hash against class
        ▼
Custom session token → browser storage
```

Rate limit: **5 attempts per 15 minutes per identifier** (in-memory). Critical: 10,000 possible PIN values — brute-force protection is essential.

### Session Clients

```typescript
// Server Components and Actions
import { createServerClient } from '@/shared/lib/supabase/server';

// Client Components
import { createBrowserClient } from '@/shared/lib/supabase/client';
```

Never instantiate Supabase clients directly outside these two entry points.

---

## API Layer

### Namespace

All REST API routes: `/api/v1/`. Legacy `/api/` routes are deprecated.

### Route Structure

```
src/app/api/v1/
├── account/               # Account management
│   └── deletion-request/  # GDPR Art.17 erasure: POST request, GET status, DELETE cancel
├── activities/            # Authoring layer: list/create activities (admin,teacher),
│                            view published by id. Feeds /play/[activityId]. See
│                            "activities vs games" under Core Tables.
├── admin/                 # Platform administration (admin role only — see EDU-67)
│   ├── users/             # GET list (cursor), GET/PATCH detail, POST reset-credentials,
│   │                        POST initiate-deletion
│   ├── feature-flags/     # GET list, POST create, GET/PATCH/DELETE by name
│   └── audit/             # GET cursor list of audit_logs; GET export.csv (10k cap)
├── assignments/           # Assignment management
├── classes/               # Teacher class management
│                            (incl. /classes/[id]/students nested route)
├── audit-log/             # Audit log query (admin + teacher, RLS-scoped)
├── data-export/           # GDPR Art.15/20 data-subject access rights
│   ├── class/[classId]/   # Class-level export (teacher only)
│   └── me/                # Per-user personal data export (any role)
├── game-proxy/            # Activity launch proxy (fetches Phaser template static assets)
├── games/                 # Legacy game catalog: GET list, POST create, GET/PATCH/DELETE by ID
├── health/                # Liveness probe
├── progress/              # Progress recording and retrieval
└── students/              # Student management
```

### Admin backend (EDU-67)

The `/api/v1/admin/*` slice is the data plane that backs `/admin/users`,
`/admin/flags`, and `/admin/audit` UIs. Every route is gated by
`requireRole('admin')` and every mutation writes a row to `audit_logs`
through `recordAdminAction()` in `src/lib/admin/audit.ts`.

Three pieces support it:

- **`feature_flags` + `feature_flag_events`** (migration
  `20260426150000_admin_feature_flags.sql`) — flag catalog with a
  per-event audit trail (one row per `enabled/disabled/targeting_changed/
  description_changed/created/deleted`). Both tables are admin-only via
  RLS.
- **`audit_logs` extension** — added `action`, `visibility`, and
  `resource_id_text` columns and relaxed `record_id` to nullable so
  admin-driven mutations targeting TEXT-keyed resources (e.g.
  `feature_flags.name`) can be recorded alongside the existing
  trigger-driven INSERT/UPDATE/DELETE rows. The `operation` `CHECK`
  now allows `NULL`; new constraint `audit_logs_admin_row_has_action`
  guarantees every row has either `operation` or `action`.
- **`profiles.status`** — TEXT column (`'active' | 'suspended'`) backing
  `PATCH /admin/users/:id`. The PATCH handler updates `profiles.status`
  and mirrors the change to `auth.users.banned_until` via the admin
  client so suspended users actually cannot log in (RLS alone would not
  block `signInWithPassword`).

Cursor pagination on `/admin/users` and `/admin/audit` uses the
`encodeCursor`/`decodeCursor` codec in `src/lib/api/cursor.ts`, which
base64url-encodes a `(created_at, id)` tuple — preferred over offset
pagination because the audit table is append-only and grows quickly.

### activities vs games (content model)

The current learning model is Activity-based:

- **`activities` + `activity_versions`** own authoring, configuration, renderer
  selection, and published content. New launches use `/play/[activityId]` and
  the shared iframe host through the renderer proxy.
- **`assignments` + `activity_progress`** own Activity assignment and
  learner progress. Teacher dashboard queries and summaries read Activity
  progress; new code should use the canonical Activity model.
- **Legacy Game names** remain in some presentation types and compatibility
  routes. The `games` and `game_progress` tables were dropped by the Activity-only
  cutover; `/api/v1/games` returns HTTP 410 and points callers at Activities.

Renderer metadata lives in `renderers/*/renderer.json` and playable activity
metadata in `activities/*/activity.json` in the game workspace. Do not restore
per-template `static/configs` discovery or separate Webpack servers. Remaining
legacy integration boundaries are documented in the database migration section.

### Pattern: Every Route Handler

```typescript
import { handleRoute, requireRole, parseBody, ApiError } from '@/lib/api';

export const POST = handleRoute(async (req) => {
  const { user, supabase } = await requireRole('teacher');
  const body = await parseBody(req, mySchema);
  // ... do work ...
  return { data: result };
});
```

Never use raw `NextResponse.json()` with error objects. Always throw `ApiError`. Always validate with `parseBody`/`parseQuery`.

### Response Envelope

```typescript
// Success
{ data: T, error: null, meta?: PaginationMeta }

// Error
{ data: null, error: { code: string, message: string } }
```

---

## Feature Flags

EduPlay uses a small, env-var-backed feature-flag layer for gating student-facing rendering of in-progress features. This is the v1 design and lives in `src/lib/feature-flags/`.

### Why env-var (and not a database table) for v1

We deliberately picked env vars over a `feature_flags` table for v1 because:

- We needed to ship one flag (`listen_tap_audio`) on a tight schedule and a runtime-mutable table demands schema design, RLS, an admin UI, and an audit log to be useful.
- Build-time inlining means a single `process.env.NEXT_PUBLIC_*` lookup works identically on server and client without a hydration boundary.
- Static analysis: every flag's reference is grep-able.

When we exceed three flags or need runtime flips (rollouts, kill switches), promote this to the database-backed admin flag system tracked under EDU-67. The two layers are intentionally separate — `src/lib/feature-flags/` is the static, code-defined surface; `src/lib/flags.ts` (added by EDU-67) evaluates DB-backed admin flags with targeting rules.

### Module surface

| Symbol | Layer | Purpose |
|--------|-------|---------|
| `FEATURE_FLAGS` | server + client | Tuple of declared flag names (source of truth). |
| `FeatureFlag` | types | Union of `FEATURE_FLAGS[number]`. |
| `getFlag(name)` | server + client | Returns the boolean value for a single flag. |
| `getFlagSnapshot()` | server + client | Returns a `Record<FeatureFlag, boolean>` of every declared flag. |
| `useFlag(name)` | client | `'use client'` hook wrapper around `getFlag`. |
| `isGameVisibleToStudents(game)` | server + client | Pure helper: should this game appear in the student catalog given current flags? |
| `filterStudentVisibleGames(games)` | server + client | Filters a list using `isGameVisibleToStudents`. |

### Wire-up

- Each declared flag has a static `process.env.NEXT_PUBLIC_*` accessor inside `flags.ts`. The `switch (name)` form (rather than `process.env[varName]`) is required so Next.js can inline the value at build time on the client.
- Truthy values: `1`, `true`, `on` (case-insensitive, whitespace-trimmed). Anything else is OFF. Default is OFF.
- Student-facing query functions (`getGamesWithProgress`, `getAssignedGames`, `getChildrenGamesProgress`, `getStudentVisibleGames`) apply `filterStudentVisibleGames` so flag-gated games disappear from student catalogs and parent views automatically.
- Teacher- and admin-facing queries (`getPublishedGames`, `getAllGames`) are intentionally unfiltered. Authoring UIs are never gated by these flags.

### Catalog gating convention

To avoid a schema migration on the `games` table, the v1 catalog gate identifies template kind by URL pattern. Listen-tap games have `/listen-tap/` in their iframe URL; `getRequiredFlag` matches that segment and returns `'listen_tap_audio'`. Add new gated templates either by:

1. Following the same URL convention and extending `game-gate.ts`, or
2. Promoting gating to a column on `games` once we have more than one template behind a flag.

### Declared flags (v1)

| Flag | Env var | Default | Owner | Notes |
|------|---------|---------|-------|-------|
| `listen_tap_audio` | `NEXT_PUBLIC_FEATURE_LISTEN_TAP_AUDIO` | OFF | Engineer | Hides listen-and-tap from student/parent catalogs until EDU-62 voice talent ships. |

### Adding a new flag

1. Append the name to `FEATURE_FLAGS` in `flags.ts`.
2. Add a static `case` to `readRawValue` reading `process.env.NEXT_PUBLIC_FEATURE_*`.
3. Document the new env var in `env.example` with default and sunset criterion.
4. Add the flag to the table in this section.
5. If the flag gates a catalog entry, extend `game-gate.ts`.
6. Add unit tests covering the new flag's parsing and any gating logic.

---

## Data Flow Diagrams

### Student Plays a Game

```
1. Student navigates to /student/dashboard
2. Next.js Server Component fetches assigned games via Supabase
3. Student selects a game → /games/[gameId]
4. Game Player page renders <GameEmbed> (Client Component)
5. GameEmbed renders <iframe src="/games/{config-path}">
6. Phaser game boots, loads config JSON, sends ACTIVITY_READY
7. Student plays → game sends PROGRESS_UPDATE messages
8. Game ends → game sends GAME_COMPLETE {score, totalSets, timeSpent}
9. GameEmbed calls Server Action: recordProgress(gameId, score, ...)
10. Server Action inserts into game_progress table
11. GameEmbed redirects to results or back to dashboard
```

### Teacher Assigns a Game

```
1. Teacher navigates to /teacher/classes/{classId}/assignments
2. Server Component fetches class students + available games
3. Teacher submits assignment form
4. Server Action validates input with Zod
5. Server Action inserts into assignments table
6. revalidatePath triggers re-fetch of assignments list
7. Students see the new assignment on their dashboard next login
```

---

## Infrastructure & Deployment

### Local Development

```bash
# edu-play-core
npm run dev:full     # Starts: Supabase (Docker) + Next.js dev server
                     # Auto-writes .env.local with Supabase keys

# phaser-projects
npm run start:activities       # Shared Vite Activity host on port 5173
```

### Docker

`docker-compose.yml` — full stack (app + Supabase)
`docker-compose.app-only.yml` — app only (use when Supabase runs via CLI)

### Environment Variables

The dev script auto-populates `.env.local` when using `npm run dev:full`. For manual overrides, copy `env.example` to `.env.local`.

Key variables:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_GAME_BASE_URL     # Base URL for game iframe src
```

### Supabase Services (Local)

| Service | Port |
|---------|------|
| Next.js app | 3000 |
| Supabase API | 54421 |
| Supabase Studio | 54423 |
| Postgres | 54422 |
| Directus Data Studio | 8055 |

### Directus CMS (Phase 1)

Self-hosted Directus runs alongside Supabase as the admin authoring surface
(replacement target for in-app `/admin/cms/*` pages).

- **Topology:** introspection-only. Directus connects to the same Supabase
  Postgres. Its own system tables live in the `directus` schema; app tables
  remain in `public`.
- **Role:** dedicated Postgres role `directus_admin` with `BYPASSRLS`, DML on
  `public` tables, **no DDL**. Supabase migrations remain the single source of
  truth for app schema. See `supabase/migrations/20260528000000_directus_role_and_schema.sql`.
- **Sensitive tables revoked:** `audit_logs`, `password_reset_requests`,
  `activity_preview_sessions`, `child_artifacts`, `parent_invite_codes`,
  `deletion_requests`. These remain Next.js-only surfaces.
- **Bootstrap:** the migration creates the role `NOLOGIN`. An operator must
  explicitly set a password (`ALTER ROLE directus_admin WITH LOGIN PASSWORD '…'`)
  before Directus can connect, preventing accidental enablement in any
  environment where this migration runs. Locally, `npm run directus:up`
  (`scripts/directus.mjs` + `docker-compose.directus.yml`) does this with a
  generated password from the gitignored `.env.directus`, attaches Directus to
  the Supabase CLI Docker network, and waits for `/server/health`.
- **RLS interaction:** Directus bypasses RLS by design (admin context). The
  Next.js runtime continues to authenticate as Supabase Auth users and is
  fully governed by RLS — Directus' bypass does not leak there.

---

## Decision Log

| Decision | Rationale | Date |
|----------|-----------|------|
| Next.js App Router (not Pages) | Server Components reduce client bundle; co-located API routes; better loading/error boundaries | Jan 2026 |
| Supabase over custom backend | Auth + Postgres + Storage + local dev parity in one service; avoids maintaining a separate API service | Jan 2026 |
| Phaser 3 in iframes over embedded React | Strict isolation between game runtime and web platform; games can be built/deployed independently; no Phaser globals polluting React tree | Jan 2026 |
| postMessage over shared state | Games are sandboxed; postMessage is the only safe cross-origin channel; forces explicit contract | Jan 2026 |
| Trunk-based development | Short-lived branches keep merge conflicts small; aligns with CI/CD best practices | Jan 2026 |
| Student PIN auth (no email) | Children ages 3–12 do not have email; PIN is parent/teacher managed; trade-off: limited PIN space (10,000 values) mitigated by rate limiting | Jan 2026 |
| Feature modules with barrel exports | Prevents spaghetti imports; each feature is a small, testable vertical slice | Jan 2026 |
| `/api/v1/` namespace | Clean versioning; allows legacy route deprecation without breaking clients | Feb 2026 |
| F9 activity-type registry is code-side | Each activity type ships as a `ActivityTypeDefinition` registered at module-load time. Avoids a DB-driven type catalog that would need a CMS before any type can ship; F11 will add a form-driven editor over each type's `configSchema` later. In-shell activities skip the postMessage iframe boundary and call the type's `resultCollector` directly because there is no third-party game runtime to sandbox. | May 2026 |
| Directus as admin CMS (introspection-only) | Replace hand-rolled `/admin/cms/*` pages with Directus Data Studio pointed at the existing Supabase Postgres. Same DB (not a separate one) so the admin edits the rows the runtime reads — no sync. Dedicated `directus_admin` role with `BYPASSRLS` + DML only, no DDL: schema migrations remain the source of truth. Phased rollout — start with low-risk tables (`games`, `classes`, `activity_types`); leave the activities publish/version workflow in Next.js until/unless custom Directus extensions are built. | May 2026 |
