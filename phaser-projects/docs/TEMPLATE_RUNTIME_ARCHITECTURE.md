# Activity Renderer Runtime Architecture

Templates/renderers are run through the single `@edu-play/game-core` Activity host. Per-template webpack configs, npm packages/workspaces, standalone `src/index.*` entrypoints, and one-port-per-template dev servers have been removed.

See the source-of-truth ADR:

- `docs/adr/0003-single-host-activity-renderer-architecture.md`

## Runtime sources

Runtime discovery is generated from:

- `renderers/*/renderer.json` — renderer metadata and lazy entrypoint.
- optional `activity-host.config.json` — renderer root/exclude policy for external renderer packs.
- `activities/*/activity.json` — Activity identity/latest version metadata, renderer compatibility, and game id.
- `activities/*/versions/*/` — immutable Activity content (`config.json`, `strings/*.json`, `assets.json`, `assets/`). All version folders are published into the host catalog for exact `@version` routes.

The generator writes:

- `packages/game-core/host/generated/activityHostCatalog.generated.ts`
- `packages/game-core/host/generated/rendererLoaders.generated.ts`

Generate explicitly with:

```bash
npm run generate:activity-host --workspace=@edu-play/game-core
```

`dev:host` and `build:host` run generation automatically.

## Host routes

```text
/activities/:activityId
/activities/:activityId@:version
/templates/:templateId/
```

Use:

```bash
npm run start:activities
npm run build:host --workspace=@edu-play/game-core
```

## Current migration boundary

Renderer code now lives under `renderers/*/src`. Activity-host and config-editor content now load from versioned Activity folders under `activities/*/versions/*`.

Config-editor renderer ordering comes from its editor adapters, and editor catalogs are generated from `renderers/*/renderer.json` plus Activity-version content. `packages/game-core/templates/registry.json` is no longer a config-editor source of truth.

## Reviewable generated Activity packages

`@edu-play/ai-content` writes generated content as a reviewable Activity package:

```text
generated/my-activity/
  activity.json
  versions/1/config.json
  versions/1/strings/en.json
  versions/1/assets.json
  assets/library/images/...
  generation-metadata.json
```

Import a reviewed package into this repo with:

```bash
npm run import:activity-package -- generated/my-activity
```

The importer validates Activity metadata and asset pins, copies immutable version content into `activities/<activityId>/versions/<version>/`, and copies pinned assets into `assets/library/*`.
