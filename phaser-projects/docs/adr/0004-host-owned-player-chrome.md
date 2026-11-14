# Host-owned player chrome for embedded Activities

## Status

Accepted

## Context

Phaser renderers currently instantiate `BottomNavbar` inside the game canvas. That navbar includes player name, repeat instruction, progress dots, and pause/play behavior. The embedding EduPlay `/play` route also renders its own player controls, route header, pause/mute/fullscreen/exit HUD, and bottom navigation.

This split creates duplicated chrome and unclear ownership. It also makes Phaser renderers responsible for route/player concerns that the host shell can manage more consistently: responsive layout, accessibility, fullscreen, exit confirmation, restart, and completion navigation.

The game-core bridge already defines messages such as `GAME_CONTROL`, `ACTIVITY_READY`, `PROGRESS_UPDATE`, and `GAME_COMPLETE`, but `GAME_CONTROL` handling is currently incomplete for the host-owned chrome target.

## Decision

Embedded Phaser renderers must not render persistent player chrome. Persistent Activity player chrome is owned by the host `/play` shell.

Phaser renderers own the playable scene and game behavior only:

- instructions and prompts;
- answer controls;
- game-specific progress mechanics;
- feedback, hints, animations, and audio playback;
- responding to host bridge commands.

The host owns the persistent player UI:

- player name;
- repeat-instruction button;
- progress dots;
- pause button and pause menu;
- mute, fullscreen, restart, exit, and route completion actions.

`BottomNavbar` may remain in `game-core` temporarily for deletion safety, but first-party renderers should stop instantiating it.

## Bridge contract

The game-core iframe protocol supports host-owned player chrome through typed messages.

Parent shell to game:

```ts
export interface GameControlMessage {
  type: 'GAME_CONTROL';
  action:
    | 'pause'
    | 'resume'
    | 'restart'
    | 'mute'
    | 'unmute'
    | 'repeatInstruction';
}
```

Game to parent shell:

```ts
export interface ActivityReadyMessage {
  type: 'ACTIVITY_READY';
  gameId: string;
  capabilities?: {
    repeatInstruction?: boolean;
  };
}

export interface ProgressUpdateMessage {
  type: 'PROGRESS_UPDATE';
  currentSet: number;
  totalSets: number;
  progress: number;
  score?: number;
}
```

`repeatInstruction` is capability-gated. A renderer should advertise `capabilities.repeatInstruction: true` only when it can replay the current prompt or last instruction correctly.

Pause state is host-authoritative for the first rollout. The host sends `pause`/`resume` and updates its UI immediately. Renderer command handlers should be idempotent and safe if commands arrive repeatedly or at awkward lifecycle moments.

## Renderer requirements

All first-party renderers must:

- stop creating `BottomNavbar`;
- stop reserving canvas/layout space for the old internal navbar;
- preserve or extract the behavior previously triggered by `BottomNavbar` events;
- expose pause/resume behavior through game-core bridge command handling;
- expose repeat behavior through `repeatInstruction` when supported;
- continue emitting accurate `PROGRESS_UPDATE` messages for host-rendered progress dots;
- continue emitting `GAME_COMPLETE` when finished.

The old `BottomNavbar` behavior should become renderer/game-control behavior, not hidden UI. Host commands must not simulate clicking a hidden Phaser button.

## Consequences

Positive:

- Renderers focus on game mechanics and visuals.
- The host has one consistent active-play navigation/control surface across all Activities.
- Progress and capabilities become explicit protocol data instead of implicit UI state.
- The iframe stage can reserve space for host chrome without renderers drawing competing chrome.

Tradeoffs:

- This is a coordinated breaking migration for current renderers; no long-lived feature flag or dual-navbar mode is planned.
- The bridge implementation must dispatch `GAME_CONTROL` into real runtime behavior instead of logging only.
- Renderer tests and visual layouts need updates because the old internal navbar disappears.

## Implementation notes

- Keep `BottomNavbar.ts` temporarily if deleting it would expand the first change too much, but do not instantiate it from first-party renderers.
- Restart may initially be implemented by the host remounting the iframe; renderer-side `restart` handling can still be supported for future soft restart behavior.
- Mute/unmute should delegate to the shared audio manager.
- Pause/resume should preserve the semantics previously reached through `BottomNavbar.AUTO_PAUSE` and `BottomNavbar.AUTO_RESUME`.
- Repeat should call the renderer's current prompt/audio replay path where available.
