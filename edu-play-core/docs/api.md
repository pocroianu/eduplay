# EduPlay API reference

Canonical reference for the `/api/v1/*` HTTP surface. The high-level
endpoint map lives in `ARCHITECTURE.md`; this document captures full
request and response shapes for slices that need them.

> **Conventions** — every endpoint accepts and returns camelCase JSON
> wrapped in `{ data, error, meta }` per `src/lib/api/response.ts`,
> validated with Zod via `parseBody` / `parseQuery`, and authenticated
> through `requireRole(...)`.

## Admin (`/api/v1/admin/*`) — EDU-67

All routes require `profiles.role = 'admin'`. Every mutation writes an
`audit_logs` row via `recordAdminAction()` and never returns secret
material (PINs, password hashes, tokens) to the caller.

### Users

#### `GET /api/v1/admin/users`

List user profiles with cursor pagination.

```
?q={search}&role={teacher|parent|student|admin}&status={active|suspended}
&cursor={base64url}&limit={1..100,default=25}
```

Response:

```json
{
  "data": [
    {
      "id": "uuid",
      "email": "ana@school.ro",
      "fullName": "Ana Popescu",
      "role": "teacher",
      "status": "active",
      "createdAt": "2026-04-01T10:00:00.000Z"
    }
  ],
  "error": null,
  "meta": { "nextCursor": "eyJj..." }
}
```

`q` matches `full_name` or `email` case-insensitively. The cursor is the
opaque base64url-encoded `(createdAt, id)` tuple of the last row in the
previous page.

#### `GET /api/v1/admin/users/:id`

Profile detail with linked records:

- `classes` — teachers only; rows from `classes.teacher_id = :id`.
- `children` — parents only; rows from `students.parent_id = :id`.
- `lastSignInAt` and `bannedUntil` projected from `auth.users`.
- `auditHead` — five most recent audit rows where the user is the actor.

Returns `404` when the profile is missing.

#### `PATCH /api/v1/admin/users/:id`

Body: `{ "status": "active" | "suspended" }`. Request `422` on any other
shape. Suspending mirrors into `auth.users.banned_until` (`876000h`,
≈100 years); reactivating clears it. Admins cannot suspend themselves
(`422` with explicit message). Writes audit action
`user_suspended` / `user_reactivated`.

#### `POST /api/v1/admin/users/:id/reset-credentials`

Branches on `profile.role`:

- **Teacher / parent** — triggers `auth.resetPasswordForEmail(...)` and
  records `password_reset_requested`. Response:

  ```json
  { "channel": "email", "emailSentTo": "ana@school.ro" }
  ```

- **Student** — generates a fresh 4-digit PIN with
  `crypto.getRandomValues`, rotates `auth.users.password` via
  `auth.admin.updateUserById(...)`, and records `student_pin_reset`.
  The PIN is returned **once**:

  ```json
  { "channel": "pin", "pin": "0427" }
  ```

  The audit row never contains the PIN value. The admin must hand the
  PIN to the teacher / student through an out-of-band channel.

#### `POST /api/v1/admin/users/:id/initiate-deletion`

Inserts a `deletion_requests` row on the user's behalf via the service
client (RLS otherwise restricts inserts to `auth.uid()`). Rejects with
`422` if `:id == actor.id`; rejects with `409` if the user already has
a `pending` request. Returns the new row (`201`) and writes audit
action `user_deletion_initiated`.

### Feature flags

`feature_flags` has a TEXT primary key (`name`, snake_case `[a-z][a-z0-9_]*`).

#### `GET /api/v1/admin/feature-flags`

List all flags ordered by name. No pagination — the catalog is small.

#### `GET /api/v1/admin/feature-flags/:name`

Detail plus the most recent **50** `feature_flag_events` rows ordered
by `created_at DESC`.

#### `POST /api/v1/admin/feature-flags`

Body:

```json
{
  "name": "game_builder_beta",
  "description": "...",
  "enabled": false,
  "targeting": { "roles": ["admin"], "allow": ["uuid"], "deny": [] }
}
```

Returns `201` with the created row. `409 CONFLICT` if `name` already
exists. Writes a `created` event and audit action `flag_created`.

#### `PATCH /api/v1/admin/feature-flags/:name`

Partial update — at least one of `description`, `enabled`, `targeting`
must be present. Each semantic delta produces a dedicated event row
(`enabled` / `disabled` / `targeting_changed` / `description_changed`),
plus a single audit action `flag_updated` covering the whole patch.

#### `DELETE /api/v1/admin/feature-flags/:name`

Hard delete (MVP scope; soft-delete is out of scope per
[EDU-67](/EDU/issues/EDU-67)). Records a `deleted` event before the
delete and emits audit action `flag_deleted`. Responds `204`.

### Targeting evaluation

`src/lib/flags.ts` exports `evaluateFlag(flag, profile)` for callers
that need to gate behaviour on a flag. Precedence: `deny` → `allow` →
`roles` → `enabled`. Tests in `src/lib/__tests__/flags.test.ts`.

### Audit log

#### `GET /api/v1/admin/audit`

Cursor-paginated read of `audit_logs` ordered `(changed_at, id) DESC`.

```
?from=ISO8601&to=ISO8601&actor=UUID&action=text&resourceType=text
&cursor=base64url&limit={1..200,default=50}
```

Each entry projects:

```json
{
  "id": "...",
  "actorId": "uuid|null",
  "action": "flag_enabled",
  "resourceType": "feature_flags",
  "resourceId": "game_builder_beta",
  "before": {...},
  "after": {...},
  "visibility": "platform",
  "createdAt": "2026-04-26T..."
}
```

`resourceId` reads `resource_id_text` first and falls back to
`record_id` so both UUID and TEXT-keyed resources surface uniformly.

#### `GET /api/v1/admin/audit/export.csv`

Streams CSV with the same filters as `GET /admin/audit`. Hard cap:
**10,000 rows**. Overflow returns `413` with raw body
`{ "error": "limit_exceeded", "limit": 10000 }` (not the standard
`ApiResponse` envelope).

Recursive `scrubSecrets()` redacts well-known secret keys (`pin`,
`pin_hash`, `password`, `password_hash`, `token`, `access_token`,
`refresh_token`, `session_token`) from `before`/`after` before
serialization. `Content-Disposition` is `attachment;
filename="audit-export-YYYY-MM-DD.csv"`.

Response headers:

- `content-type: text/csv; charset=utf-8`
- `content-disposition: attachment; filename="audit-export-YYYY-MM-DD.csv"`

## CMS activity authoring — EDU-30.C

### `GET /api/v1/activity-types`

Public registry read. Returns paginated `activity_types` rows with
`typeId`, `displayName`, `category`, `configSchema`, `rendererKey`, and
`version`.

### `GET /api/v1/activity-types/:typeId`

Public detail read for one activity type. Returns `404` when the
`typeId` is not registered.

### `POST /api/v1/activities`

Admin or teacher create. Existing `template` remains supported; new CMS
clients may send `typeId`. When `configData` is present, the route loads
the registered type, validates `configData` against `configSchema`, pins
`configSchemaVersion`, and preserves JSON key casing inside `configData`.

### `PATCH /api/v1/activities/:id`

Admin or teacher update. `configData` is validated against `typeId`,
`template`, or the current activity type, in that order. Returns `422`
for schema validation failures.

### `GET /api/v1/progress`

Role-scoped learner progress list. New Activity-native callers filter with
`activityId`; `gameId` remains supported only for legacy `game_progress`
rows. Optional filters: `studentId`, `activityId`, `gameId`, `status`,
`page`, `perPage`.

Activity rows include `activityId`, `lastVersionId`, optional
`legacyGameId`, `status`, `score`, `timeSpent`, `attempts`, timestamps,
`data`, and optional joined `activities` metadata.

### `POST /api/v1/progress`

Records progress. Canonical payload uses `activityId`; `gameId` is
deprecated legacy input. Students record their own progress. Teachers must
include `studentId` for a roster student.

```json
{
  "activityId": "uuid",
  "versionId": "uuid",
  "assignmentId": "uuid",
  "status": "in_progress",
  "score": 80,
  "timeSpent": 30,
  "data": { "starRating": 3 }
}
```

`versionId` records the last Activity Version played. When `assignmentId`
is provided, the assignment must target the same `activityId` and pinned
version. Legacy `{ "gameId": "uuid" }` still writes `game_progress`; when
that game maps to a published Activity, the API also writes canonical
`activity_progress` for migration compatibility.

### `GET /api/v1/activities/:id/config`

Returns the exact JSON config document for a published Activity Version.
Requires `versionId`. Assignment launches add `assignmentId`; the assignment
must target both the same Activity and version.

Renderer iframes receive this endpoint only through the iframe `configUrl`
query parameter, for example:

```text
/api/v1/renderer-proxy/activity-renderers/multiple-choice/index.html?game=fractions-01&configUrl=%2Fapi%2Fv1%2Factivities%2F...%2Fconfig%3FversionId%3D...
```

`configUrl` must be a same-origin `/api/v1/...` exact JSON document URL; it
is not sent in `ACTIVITY_INIT`.

Renderer postMessage behavior is governed by the shared
`@edu-play/activity-protocol` package. Renderers must send game-to-host messages
to a concrete trusted parent origin, never `'*'`, and must ignore inbound
`ACTIVITY_INIT` / `GAME_CONTROL` messages unless `event.origin` matches that
trusted parent origin. Resolve the parent origin from a valid `origin` query
parameter, then `document.referrer`, then the same-origin renderer page origin
for proxied launches.

### `GET /api/v1/activities/:id/preview/config`

Returns the JSON config for an admin preview session. Requires `previewId`
from `POST /api/v1/activities/:id/preview`. Preview config follows the same
iframe `configUrl` query-parameter contract as published config.

### `GET /api/v1/activities/:id/versions`

Admin-only paginated list of immutable `activity_versions` snapshots,
ordered newest first.

### `POST /api/v1/activities/:id/versions`

Admin-only draft snapshot creation.

```json
{ "configData": { "question": "..." } }
```

The route validates against the activity type schema, assigns the next
`versionNumber`, pins `activityTypeId` and `configSchemaVersion`, and
returns `201`.

### `POST /api/v1/activities/:id/publish`

Admin-only publish action. Validates the activity's current
`configData`, reuses the latest matching snapshot when present, otherwise
creates the next immutable `activity_versions` row, then updates the
activity to `status = "published"` and `isPublished = true`.

### `POST /api/v1/activities/:id/preview`

Admin-only validation without persistence.

```json
{ "typeId": "multiple-choice", "configData": { "question": "..." } }
```

`typeId` is optional and defaults to the activity's current type. The
response contains a short-lived HMAC preview `token` plus `expiresAt`.
No `activity_versions` row is written.
