# Migrate progress toward Activities before fully removing Games

EduPlay treats **Activity** as the canonical learner-facing unit, but existing code still stores assignments, dashboards, and progress through the legacy `games` model. We decided to migrate progress first by introducing a new Activity-native progress table while keeping the legacy `games` catalog and `game_progress` as temporary compatibility surfaces, because progress correctness is the highest-risk semantic mismatch and a full `games` cutover would make this branch too broad.

## Considered Options

- Keep a compatibility bridge only: smaller, but preserves two competing progress identities.
- Migrate progress first with a new table and backfill: fixes the most important learner/parent/reporting semantics while keeping scope manageable.
- Rename `game_progress` to `activity_progress`: direct, but too disruptive for legacy routes, reports, and external assumptions in this branch.
- Full cutover: cleanest end state, but too large and risky for this branch.

## Consequences

- New learner progress should be keyed by Activity, not Activity Version and not legacy Game.
- `/api/v1/progress` remains the learner progress endpoint and evolves to accept `activityId`; `gameId` is retained only as deprecated legacy input during migration.
- Assignments gain `activity_id` while keeping legacy `game_id` temporarily; new assignment creation should populate `activity_id` and `version_id` when a legacy game maps to an Activity.
- Activity Version references remain useful for recording what was last played.
- Legacy `games` APIs/routes and `game_progress` may remain temporarily, but should not define new domain language.
- Backfill maps only proxy-backed Phaser `games.game_url` rows whose URL identifies an existing Activity; unmapped legacy rows stay in `game_progress` until a later cleanup.
- Activity config overrides are a renderer boot concern owned centrally by `game-core`/`ConfigLoader`; `configUrl` means a same-origin `/api/v1/...` exact config JSON document URL, not an absolute URL and not a base path. All shipped Phaser templates should be registered as Activity types and load playable config through centralized `ConfigLoader`, not duplicate CMS/static config fetch logic. Registering a template does not auto-publish Activity rows except where existing legacy catalog rows are deliberately mapped. Boot-critical config source is the iframe query param only; `ACTIVITY_INIT` may carry runtime context but must not carry `configUrl`. API and iframe protocol docs must describe `previewId`, config endpoints, and the `configUrl` query-param contract in the same branch.
