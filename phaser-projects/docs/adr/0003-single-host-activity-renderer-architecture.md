# Single-host Activity Renderer Architecture

## Status

Implemented

Runtime migration is complete for the game-core host, package-less renderers, generated catalogs, Activity-first routes, versioned Activity content, and reusable asset-library pins. Remaining work is tracked as follow-up scope below rather than blocking this ADR.

## Context

The current Phaser template runtime assigns each template a separate dev port through `packages/game-core/templates/registry.json` and runs each template as a workspace-owned mini-app with its own `package.json`, `webpack.config.js`, and standalone entrypoint. This does not scale to 100+ templates:

- one port per template becomes operationally awkward and collision-prone;
- one npm workspace/package per template creates package-management noise;
- template-owned servers and build configuration invite drift;
- URLs expose renderer/template implementation details instead of the learning Activity being played;
- generated Activity content and reusable assets need a cleaner boundary than template-local config folders.

We also want `packages/ai-content` to generate Activities for different renderers without coupling directly to `game-core` runtime internals.

## Decision

Adopt a single game-core Vite host with Activity-first routing, package-less renderer modules, generated runtime catalogs, separated Activity content, and a reusable asset library.

### 1. One game-core host and one dev port

`game-core` owns the dev server and runtime host. It serves all renderers through one Vite app on one port.

Canonical routes:

- `/activities/:activityId` — public/canonical play route.
- `/activities/:activityId@:version` — exact immutable Activity version route.
- `/templates/:templateId/` — renderer/template development and debugging route only.

Renderers do not own ports or dev servers.

### 2. Activities are canonical; renderers are implementation details

A public play URL identifies an Activity, not a renderer. The Activity catalog resolves:

- Activity id/version;
- renderer id;
- compatible renderer version range;
- config and strings location;
- asset manifest location.

Example Activity metadata:

```json
{
  "activityId": "fruits-01",
  "version": 1,
  "renderer": {
    "id": "multiple-choice",
    "version": "^1.0.0"
  }
}
```

### 3. Renderers are package-less modules

A renderer is a folder/module, not an npm package/workspace.

Target shape:

```txt
renderers/
  multiple-choice/
    renderer.json
    src/template.ts
    src/scenes/...
```

Renderer dependencies are centralized at the host/root level. Renderers may import approved shared dependencies such as Phaser, `@edu-play/game-core`, and shared UI libraries. They do not declare per-renderer `package.json` files.

Each renderer exports a template definition, not a mount/start function. `game-core` owns mounting, lifecycle, URL parsing, config base paths, restart, diagnostics, bridge, and Phaser construction.

### 4. Vite imports local renderer source directly and lazy-loads renderers

For first-party/local renderers, Vite imports `src/template.ts` directly and code-splits by renderer. The host must not eagerly import the full renderer catalog.

A generated loader map provides lazy imports:

```ts
export const rendererLoaders = {
  "multiple-choice": () => import("../../renderers/multiple-choice/src/template"),
  "matching-game": () => import("../../renderers/matching-game/src/template")
};
```

### 5. Self-describing renderer folders plus central root policy

Renderers are discovered from configured roots. Each renderer has local metadata. The app/game-core config decides which roots are active and can exclude draft folders.

Example root policy:

```json
{
  "rendererRoots": ["renderers", "../client-renderers"],
  "exclude": ["**/_experimental/**"]
}
```

This keeps built-in and custom renderers possible without requiring one package per renderer.

### 6. Generated catalogs, not hand-maintained mega registries

Runtime catalogs are generated at dev/build time:

- generated renderer loader map;
- generated Activity catalog;
- generated validation diagnostics for duplicate IDs and broken references.

Duplicate Activity IDs fail fast unless an explicit override/alias policy is added later.

### 7. Separate renderer code from Activity content

Long-term target:

```txt
activities/
  fruits-01/
    activity.json
    versions/1/
      config.json
      strings/en.json
      strings/ro.json
      assets.json
```

Renderer folders contain code. Activity folders contain playable content.

Migration may support current template-local config folders temporarily, but the target is separate Activity content roots.

### 8. Activity versions are immutable once published

Published Activities are versioned and immutable:

```txt
activities/fruits-01/
  activity.json          # alias metadata, e.g. stable/latest
  versions/1/...
  versions/2/...
```

Aliases may resolve `/activities/fruits-01` to latest/stable, while `/activities/fruits-01@1` loads an exact version.

Published Activity versions pin exact asset IDs and declare renderer compatibility ranges. Renderer major versions change when config/runtime compatibility breaks.

### 9. Assets use semantic library paths plus immutable integrity pins

Generated and reusable assets use stable semantic filenames for fast human lookup, with SHA-256 recorded in Activity pins for reproducibility and change detection.

Example:

```txt
assets/library/images/apple.png
assets/library/audio/question1.mp3
assets/library/catalog.json
```

Global asset catalog:

```json
{
  "images": {
    "apple": {
      "variants": {
        "red-cartoon": {
          "path": "/assets/library/images/apple.png",
          "sha256": "abcd...",
          "candidates": []
        }
      }
    }
  }
}
```

Activity configs use logical asset references rather than concrete URLs:

```json
{ "imageRef": { "key": "apple", "variant": "red-cartoon" } }
```

Activity-local `assets.json` resolves logical references to semantic library paths plus pinned SHA-256 digests for reproducibility. Drafts may use semantic aliases; published versions pin exact asset hashes and fail validation if the file content changes.

### 10. `ai-content` generates reviewable Activity packages

`packages/ai-content` should not write directly into the runtime catalog as its canonical output. It generates reviewable Activity packages that an importer validates and publishes.

Flow:

```txt
edu-generate activity --renderer multiple-choice --topic fruits
edu-activity import generated/fruits-01
```

`ai-content` uses a shared generation pipeline plus renderer-specific generator adapters:

```ts
interface ActivityGeneratorAdapter {
  rendererId: string;
  plan(request: unknown): unknown;
  buildConfig(plan: unknown, assets: unknown): unknown;
  buildStrings(plan: unknown): Record<string, unknown>;
  validateConfig(config: unknown): unknown;
}
```

`ai-content`, `game-core`, and future import tooling communicate through stable schemas/files. `ai-content` may depend on `@edu-play/validation`, but should avoid direct coupling to `game-core` runtime internals.

## Consequences

Positive:

- One dev server/port scales to many renderers.
- Renderers become lightweight modules instead of npm packages.
- Activity URLs are stable and user/product-facing.
- Renderer code and Activity content can evolve independently.
- Vite lazy-loading keeps startup and bundle size manageable.
- Generated catalogs reduce manual registry drift.
- Asset deduplication supports reusable generated and curated media.
- Versioned Activities improve reproducibility, analytics, and review workflows.
- `ai-content` gets a clear path to generate for multiple renderer types.

Negative/tradeoffs:

- This is a significant migration from the current workspace/webpack shape.
- A catalog generator and importer become required infrastructure.
- Renderer source must obey centralized dependency rules.
- Activity versioning and asset pinning add process overhead.
- Vite migration happens alongside architecture migration, increasing first-slice complexity.

## Migration plan

Use a vertical slice, not a full big bang.

1. ✅ Add the single game-core Vite host on one port.
2. ✅ Add generated renderer loader map for one renderer.
3. ✅ Add `/templates/:templateId/` debug route for that renderer.
4. ✅ Add generated/static Activity catalog for one Activity.
5. ✅ Add `/activities/:activityId` canonical route.
6. ✅ Convert one renderer to definition-only, package-less runtime path.
7. ✅ Add E2E coverage for the Activity route.
8. ✅ Add asset manifest support compatible with current assets, then evolve toward semantic library paths with pinned hash integrity.
9. ✅ Migrate remaining renderers mechanically.
10. ✅ Remove per-renderer `package.json`, webpack configs, workspace entries, and per-template ports after all renderers are served by the host.
11. ↪ Follow-up: update `ai-content` to emit reviewable Activity packages and add an importer once runtime package shape stabilizes.

## Implementation notes

The implemented runtime shape is documented in `docs/TEMPLATE_RUNTIME_ARCHITECTURE.md` and `docs/TEMPLATE_CREATION_GUIDE.md`.

Current source-of-truth locations:

- `renderers/*/renderer.json` and `renderers/*/src/template.ts` for package-less renderer modules.
- `activities/*/activity.json` plus `activities/*/versions/*/` for playable Activity content.
- `assets/library/*` and Activity-local `assets.json` manifests for reusable assets with SHA-256 pins.
- `packages/game-core/scripts/activityHostCatalogGenerator.js` for generated host catalogs.
- `packages/game-core/host/generated/activityHostCatalog.generated.ts` and `packages/game-core/host/generated/rendererLoaders.generated.ts` for runtime catalog output.

## Follow-up scope

These follow-ups have also been implemented:

1. ✅ **AI-content Activity packages and importer** — `packages/ai-content` now writes reviewable Activity packages (`activity.json`, `versions/<n>/config.json`, `strings/*.json`, `assets.json`, assets), and `scripts/import-activity-package.mjs` validates/imports those packages into repo `activities/*` plus `assets/library/*`.
2. ✅ **Multi-version catalog publishing** — catalog generation includes every immutable version under `activities/<id>/versions/*`, not only the version selected by `activity.json`, so exact `/activities/:id@:version` routes can remain live across publications.
3. ✅ **Configurable renderer roots** — `activity-host.config.json` can provide `rendererRoots` and `exclude` entries when external renderer packs are needed. The default first-party runtime remains `renderers/`.

## Resolved questions

- Filesystem names are settled as `renderers/*` for code modules and `activities/*` for playable content. `/templates/:templateId/` remains a debug route name for compatibility with renderer/template terminology.
- Generated host files live under `packages/game-core/host/generated/`.
- Custom renderer packs are not needed for the first-party migration. Configurable roots remain follow-up scope.
- Activity metadata and asset manifests are validated through `@edu-play/validation`; the exact reviewable Activity-package/importer schema remains part of the `ai-content` follow-up.
