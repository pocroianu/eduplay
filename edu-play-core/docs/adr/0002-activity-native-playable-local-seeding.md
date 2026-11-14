# Make local baseline seeding Activity-native and playable

EduPlay's local baseline seed is a demo/development fixture, not a test-specific fixture universe, so it should create deterministic teacher, learner, parent, Activity, Assignment, and Activity Progress data that can be safely re-run. We decided the baseline seed should import playable Activity content from the sibling `phaser-projects` template catalogs, publish each imported Activity with one immutable Activity Version, pin assignments to those versions, and avoid legacy Game/game_progress compatibility data. For now, plain `npm run seed` also syncs the matching Phaser renderer builds into local `activity-renderers` storage so the seeded Activities launch immediately; this favors a working local demo over a purer two-step seed/sync split until the catalog grows.

## Consequences

- Seed tiers control catalog breadth: minimal is a tiny sanity-check subset, medium covers each available renderer template once, and full imports the full Phaser catalog.
- Imported `activity_versions.config_data` stores the Phaser `config.json` structure only; localized `ro.json`/`en.json` files remain static renderer assets until the renderer/config contract changes.
- Baseline-owned rows use deterministic UUIDs and seed metadata so cleanup targets only the baseline seed, not local experiments.
- The default seed validates selected Phaser Activity configs before writing partial seed data and hard-fails when required Phaser catalogs/configs or renderer builds are missing; a DB-only opt-out can exist for workflows that do not need launchable Activities.
- The TypeScript seed is the baseline demo source of truth; Supabase SQL seeds should stay minimal/bootstrap-only and must not maintain a parallel demo catalog.
