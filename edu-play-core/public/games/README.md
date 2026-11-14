# Browser game integration

This directory holds browser-playable game bundles and fixtures that the Next.js app can embed.

Current repo reality:
- simple local fixtures can live under `public/games/<name>/index.html`
- activity launches currently route through `/api/v1/renderer-proxy/activity-renderers/...`
- playable config overrides are supplied with a same-origin `configUrl` iframe query parameter
- the player shell listens for `ACTIVITY_READY`, `PROGRESS_UPDATE`, and `GAME_COMPLETE` and sends `GAME_CONTROL` commands for host-owned player chrome
- some legacy `/games/...` hosting still works for same-origin bundles, but new activity launches should follow the proxied `/api/v1/renderer-proxy/activity-renderers/...` flow used by the app

See also:
- `../../CLAUDE.md` for current app conventions
- `../../src/features/games/components/GameEmbed.tsx` for the live message handling contract

## Local bundle layout

```text
public/games/
└── your-game/
    ├── index.html
    ├── assets/
    └── ...other static files
```

If you add a same-origin static bundle here, it is typically reachable at `/games/your-game/index.html`.

## Config loading

Activity launches use the central game-core/ConfigLoader path. The host app
adds an encoded `configUrl` query parameter to the iframe `src` when a CMS
Activity config should override bundled/static config:

```text
/api/v1/renderer-proxy/activity-renderers/<template>/index.html?game=<game-id>&configUrl=%2Fapi%2Fv1%2Factivities%2F<activityId>%2Fconfig%3FversionId%3D<versionId>
```

Preview launches use `/api/v1/activities/<activityId>/preview/config?previewId=...`.
Published launches use `/api/v1/activities/<activityId>/config?versionId=...` and
may include `assignmentId=...`. `configUrl` is an exact same-origin `/api/v1/...`
JSON document URL. Do not treat it as a base path, do not replace it with an
absolute third-party URL, and do not rely on `ACTIVITY_INIT` for boot-critical
config; `ACTIVITY_INIT` intentionally does not carry `configUrl`.

## Current postMessage contract

The executable source of truth for the iframe wire contract is
`@edu-play/activity-protocol` in `packages/activity-protocol/`. This README
explains integration behavior for renderer authors; message shapes, runtime
validation, and canonical fixtures live in the shared package so
`edu-play-core` and `phaser-projects` do not duplicate the contract by hand.

The embedded player currently consumes these messages from the game iframe.
Games must send messages to a trusted parent origin. Do not use `'*'`, including when passing
a transfer list or the `WindowPostMessageOptions` form.

Resolve the trusted parent origin from a valid `origin` query parameter when present,
then `document.referrer`, then the current renderer page origin for same-origin proxied
launches:

```js
function toOrigin(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : undefined
  } catch {
    return undefined
  }
}

const parentOrigin =
  toOrigin(new URLSearchParams(window.location.search).get('origin')) ??
  toOrigin(document.referrer) ??
  toOrigin(window.location.href)
```

Games must also validate inbound host messages before acting on them: ignore
`ACTIVITY_INIT` and `GAME_CONTROL` unless `event.origin === parentOrigin`.

### 1. `ACTIVITY_READY`

Send this when the activity has loaded and is ready for interaction. Capabilities tell the host which player chrome actions can be enabled.

```js
window.parent.postMessage(
  {
    type: 'ACTIVITY_READY',
    gameId: '<activity-or-game-id>',
    capabilities: {
      repeatInstruction: true,
    },
  },
  parentOrigin,
)
```

Notes:
- `gameId` should match the id the shell expects for the current activity or legacy game
- the shell uses this to dismiss loading state
- `capabilities.repeatInstruction` should be `true` only when the activity can replay the current prompt/instruction correctly; otherwise the shell keeps the repeat slot disabled

### 2. `PROGRESS_UPDATE`

Send this during play to update progress.

```js
window.parent.postMessage(
  {
    type: 'PROGRESS_UPDATE',
    currentSet: 2,
    totalSets: 10,
    progress: 0.2,
  },
  parentOrigin,
)
```

Fields:
- `currentSet`: current step/set index
- `totalSets`: total steps/sets
- `progress`: number from `0` to `1`

### 3. `GAME_COMPLETE`

Send this when the activity finishes.

```js
window.parent.postMessage(
  {
    type: 'GAME_COMPLETE',
    score: 8,
    totalSets: 10,
    timeSpent: 95,
    reason: 'completed',
    starRating: 2,
    screenshotDataUrl: 'data:image/png;base64,…', // optional
  },
  parentOrigin,
)
```

Fields:
- `score`: final score used by the shell
- `totalSets`: total step/set count
- `timeSpent`: seconds spent in the activity
- `reason`: completion reason string
- `starRating`: optional extra rating persisted in progress data
- `screenshotDataUrl`: optional PNG data URL of the game canvas at completion. When the player is a logged-in student, the host hands this off to the portfolio module (`recordGameArtifact`) which decodes the bytes server-side and persists them as a draft `child_artifacts` row for teacher review. Capture is best-effort — sending it is optional and never blocks the saveProgress flow.

## `GAME_CONTROL` from host to iframe

The host owns persistent player chrome on `/play`. Games respond to host commands instead of rendering their own persistent navbar.

```js
{
  type: 'GAME_CONTROL',
  action: 'pause' | 'resume' | 'restart' | 'mute' | 'unmute' | 'repeatInstruction',
}
```

Required behavior:
- `pause` / `resume`: stop and restore timers, tweens, input, and current audio as appropriate.
- `mute` / `unmute`: respect the shell's audio state.
- `repeatInstruction`: replay the current prompt only when advertised by `ACTIVITY_READY.capabilities.repeatInstruction`.
- `restart`: optional for soft restarts; the current shell may remount the iframe for restart.

## `ACTIVITY_INIT` from host to iframe

After iframe load, the host posts runtime context to the game:

```js
{
  type: 'ACTIVITY_INIT',
  gameId: '<legacy-or-runtime-game-id>',
  activityId: '<activity-uuid>',       // Activity launches only
  versionId: '<activity-version-uuid>',// Activity launches only
  assignmentId: '<assignment-uuid>',   // Assignment launches only
  language: 'ro',
  studentId: '<student-uuid>',
  muted: false,
}
```

This message is not the config source of truth. Read config from the iframe
`configUrl` query parameter during preload.

## Important limitations

- This file is intentionally minimal and only reflects the current shell contract.
- Older Godot-specific setup notes and manual SQL insertion steps were removed because they no longer match the main app flow.
- If protocol behavior changes, update `GameEmbed.tsx` and this file together.
