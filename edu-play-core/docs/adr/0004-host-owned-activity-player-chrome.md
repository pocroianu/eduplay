# Host-owned Activity player chrome

## Status

Accepted

## Context

The `/play` route embeds Phaser Activities inside the Next.js Activity player. Today, persistent player controls are split across multiple surfaces:

- the host `GameEmbed` top HUD renders pause, mute, fullscreen, exit, score, time, and progress;
- Phaser renderers render their own `BottomNavbar` with player name, repeat instruction, progress dots, and pause;
- a route-level strip rendered navigation such as `Următorul` below the stage (since removed);
- `CategoryBanner` remains visible above active play.

This creates duplicate navigation and control ownership, reduces the playable stage, and can block or compete with the Activity content. The host also cannot consistently manage accessibility, responsive layout, fullscreen, exit confirmation, restart, or completion actions while Phaser renderers own persistent chrome.

## Decision

`/play` is an immersive Activity player. Persistent player chrome belongs to the host Activity player, not to embedded Phaser renderers.

During active play, `/play` owns and renders a single bottom Activity navbar with:

- the student's first name, with a translated `Jucător` fallback;
- a persistent repeat-instruction control;
- progress dots sourced from Phaser `PROGRESS_UPDATE` messages;
- a pause control.

The bottom Activity navbar reserves layout space outside the iframe. It must not overlay the Phaser stage.

The host Activity player also owns:

- pause menu UI;
- mute/audio control;
- fullscreen control;
- restart;
- exit/back and exit confirmation;
- route-level completion actions such as `Continuă` and `Joacă din nou`.

Phaser renderers own:

- game/instruction content;
- answer controls;
- game-specific feedback, hints, animations, and audio playback;
- implementing behavior requested by host bridge commands.

Phaser renderers must not render persistent player navbars or route/player controls. In-world game-specific UI remains allowed.

## Route layout rules

- `CategoryBanner` is visible on intro and completion states, but hidden during active play.
- The top-center active-play HUD is removed.
- No route-level action strip exists on `/play`; player chrome actions now live in the player header.
- `Următorul` / `Continuă` appears only after completion, inside the completion UI.
- The Activity navbar is visible only during active play once the Activity is ready enough for controls.
- Pause opens a host pause menu and pauses the embedded Activity.
- Exit from the pause menu still requires confirmation.
- Restart from the pause menu remounts the iframe, resets host play state, and does not require confirmation.

## Bridge contract

The host controls Phaser behavior through the iframe bridge:

```ts
GAME_CONTROL:
  | 'pause'
  | 'resume'
  | 'restart'
  | 'mute'
  | 'unmute'
  | 'repeatInstruction'

ACTIVITY_READY: {
  capabilities?: {
    repeatInstruction?: boolean
  }
}

PROGRESS_UPDATE: {
  currentSet: number
  totalSets: number
  progress: number
  score?: number
}
```

For the first implementation pass, pause state is host-authoritative: the host updates its pause UI immediately and sends `pause`/`resume`. Phaser should make these commands idempotent. A required `GAME_STATE` acknowledgement is not part of this decision.

Repeat instruction is capability-gated. If an Activity does not advertise `capabilities.repeatInstruction`, the host keeps the repeat slot visible but disabled.

## Consequences

Positive:

- One visible active-play control surface.
- The Activity content is no longer blocked by host overlays.
- The host can enforce consistent accessibility, touch targets, responsive layout, fullscreen behavior, exit confirmation, and completion actions.
- Phaser renderers keep responsibility for game behavior while exposing behavior through a typed protocol.
- `/play` becomes easier to test because route chrome is in React components instead of duplicated inside renderers.

Tradeoffs:

- The change must be coordinated with Phaser renderer changes; no long-lived compatibility flag is used.
- All current Phaser renderers must stop instantiating their internal `BottomNavbar` in the same rollout.
- Phaser bridge command handling must move from log-only handling to real behavior dispatch.

## Implementation notes

- Add a dedicated `features/games/components/ActivityNavbar.tsx` component that uses the app UI kit rather than copying the old Phaser dark frosted style.
- Keep active-play score/time out of the navbar. The pause menu may show neutral summary information such as time and progress. Completion UI may show score, stars, and time.
- Keep passing `studentId` to Phaser where needed for runtime context; do not pass display name by default.
- Source the navbar display name in the host from the authenticated profile first name, with fallback copy from the player namespace.
