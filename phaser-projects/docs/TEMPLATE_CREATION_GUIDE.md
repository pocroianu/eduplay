# Renderer / Activity Creation Guide

This guide supersedes the old per-template package + webpack workflow. New renderers are package-less modules discovered by the game-core Activity host.

See also:

- `docs/adr/0003-single-host-activity-renderer-architecture.md`
- `docs/TEMPLATE_RUNTIME_ARCHITECTURE.md`

## Add a renderer

Create a renderer folder:

```text
renderers/my-renderer/
  renderer.json
  src/template.ts
```

Example `renderer.json`:

```json
{
  "rendererId": "my-renderer",
  "version": "1.0.0",
  "defaultGameId": "my-activity-01",
  "entry": "src/template.ts",
  "configGameType": "my-game-type"
}
```

`src/template.ts` should export a `GameTemplateDefinition` as the default export. `configGameType` is the `config.json` `meta.gameType` discriminator accepted by validation for this renderer. Keep renderer runtime/editor source under `renderers/<id>/src`; playable content belongs under `activities/*/versions/*`.

## Add an Activity

Create Activity metadata and versioned content:

```text
activities/my-activity-01/
  activity.json
  versions/1/
    config.json
    strings/en.json
    strings/ro.json
    assets.json
    assets/...
```

Example `activity.json`:

```json
{
  "activityId": "my-activity-01",
  "version": 1,
  "renderer": {
    "id": "my-renderer",
    "version": "^1.0.0"
  },
  "gameId": "my-activity-01"
}
```

The Activity host serves `/activities/:id` from the matching immutable `versions/:version` folder.

## Generate and run

```bash
npm run generate:activity-host --workspace=@edu-play/game-core
npm run start:activities
```

Open:

```text
http://localhost:5173/activities/my-activity-01
http://localhost:5173/templates/my-renderer/
```

## Test checklist

- Add or update unit coverage for route/catalog behavior when needed.
- Add Activity-host E2E coverage for at least initial load and one representative interaction.
- Run:

```bash
npm run build --workspace=@edu-play/game-core
npm test --workspace=@edu-play/game-core
npm run build:host --workspace=@edu-play/game-core
npm run test:e2e
```

## Do not add

- `templates/<name>/package.json`
- `templates/<name>/webpack.config.js`
- root `start:<name>` / `build:<name>` scripts
- per-template dev-server ports
- renderer-owned host lifecycle or `new Phaser.Game(...)` bootstrapping
