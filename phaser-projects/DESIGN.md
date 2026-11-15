# Design Contract — phaser-projects

The games shipped from this monorepo run inside the EduPlay platform. EduPlay
is developing its own design identity; follow the workspace `.impeccable.md`
and the current platform implementation contracts in `../edu-play-core/DESIGN.md`.
Existing canvas styling is a baseline to evolve, not a fixed brand direction.
Legacy palette, font, and mascot examples below are historical implementation
notes; they do not override the current platform contract or canvas accessibility
rules in `.impeccable.md`.

## Source Of Truth

Read these in order:

1. **[`../edu-play-core/DESIGN.md`](../edu-play-core/DESIGN.md)** — canonical Duo spec. Tokens, primitives, fonts, mascot, motion, and component contracts. Always start here.
2. This document — game-specific addenda the canonical spec doesn't (and shouldn't) cover.
3. Existing renderers under `renderers/*` — `multiple-choice/` and `matching-game/` are the best-documented references for shipped Phaser patterns.
4. [`../edu-play-core/public/games/README.md`](../edu-play-core/public/games/README.md) — the postMessage protocol you implement against.

If a task forces a deviation from the canonical Duo spec, call out the deviation explicitly and keep the change narrow.

## Game-specific addenda

These rules cover the Phaser canvas. The platform shell already follows Duo through `edu-play-core` — the notes below are for what happens *inside* the iframe.

### HUD safe areas

The canvas is full-bleed inside the iframe; the host shell does not overlay chrome on top of game content. Inside the canvas, reserve safe-area gutters for our own HUD:

- ≥ **64 px** clear gutter on every edge for HUD chrome (score, pause, life / streak, exit).
- Interactive game-world elements (cards, draggable pieces, target slots) sit at least **88 px** from any canvas edge so a kid's thumb can reach them on a tilted Chromebook or tablet.
- Layout responds to canvas resize — never assume a fixed `1280 × 720`. Test the smallest supported viewport (Chromebook portrait at `800 × 600`).

### Pause overlay

Every template must support a pause state.

- Trigger: an in-canvas pause button at top-right inside the safe area, plus a host-side lifecycle event when the protocol surfaces one (see [`../edu-play-core/public/games/README.md`](../edu-play-core/public/games/README.md)).
- While paused: dim the game world to ~40 % opacity behind a translucent ink wash, and centre a chunky white card with three primitives — title ("Pauză"), a green primary CTA ("Continuă"), and a ghost CTA ("Ieși din joc"). The card uses the canvas equivalent of the `--shadow-chunk-lg` token (6 px solid-offset bottom in `--color-ink`).
- Pausing stops tweens, sound effects, and timers. Resuming restores them — do not re-roll randomness, do not skip the current question.

### Reward / fail moments

These fire after every answered question. Stay quick and warm — never punishing.

- **Correct / reward:** green wash overlay, "Super!" in Baloo 2 800, a small drawn star burst (Phaser `Graphics`, never emoji). Optional Vulpiță in `cheer` mood on level-completion moments only. 600–800 ms total.
- **Incorrect / fail:** warm coral wash (`--color-coral`, never error red), "Aproape!" text, a 3-cycle horizontal shake at ~60 ms per cycle. Optional Vulpiță in `sad` mood. 400–600 ms total. Never block the next try for longer than ~800 ms.
- Score reporting back to the host goes through the postMessage protocol. The canvas does not write directly to the parent DOM.

### Audio cues

- Every interactive tap and every reward / fail moment has an audio cue when audio is enabled.
- Reuse the same cue set across templates (correct, incorrect, tap, level-up, pause) so kids learn the language.
- Respect the host's mute / audio-toggle protocol. Never autoplay sound before first user interaction — browser autoplay policies block it on shared devices anyway, and an unexpected sound on a classroom Chromebook is a real complaint.
- Every audio cue has a visible equivalent (colour pulse, particle burst, shake). Colour is never the only signal — children with hearing or colour-vision differences must still understand outcomes.

### Accessibility floor

Non-negotiable for every template. These extend the canonical Duo accessibility rules with canvas-specific minimums:

- **Touch targets:** ≥ **88 × 88 px** for in-canvas interactive elements. The shell baseline is 64 × 64 px; the canvas raises the floor because pointer precision is worse over a Phaser canvas than over native DOM.
- **Keyboard:** Arrow keys to navigate, Enter / Space to activate, Home / End to jump to first / last item. Focus indicator mirrors the hover visual plus a 3 px gold ring (`--color-gold`) around the focused element.
- **Screen reader:** Question prompts and answer outcomes are announced via the host shell's ARIA live region. The canvas emits announcements through the postMessage protocol — never via direct DOM injection from inside the iframe.
- **Reduced motion:** Respect `prefers-reduced-motion`. Replace transforms with instant opacity, skip the mascot idle-breathe loop, cap shake / pulse to a single cycle. Reward and fail copy are always shown — motion is the bonus, not the message.
- **Romanian copy:** Real diacritics (`ă â î ș ț`) at every weight. Re-validate Phaser's text-to-texture rasterisation whenever a weight is added or a font is swapped — diacritic glitches are a known Phaser failure mode.

## Mascot

Vulpiță is the platform mascot and the default character in canvas. Per-template themed variants (e.g. an alien for a space level) are allowed when the lesson context demands it, but Vulpiță remains the brand voice — the variant is decorative, the personality is hers.

Animation states match the canonical mascot system: `idle` (gentle breathe), `cheer` (scale pop + wiggle), `sad` (slow head tilt). Use the canonical Vulpiță SVG paths from `../edu-play-core/` rather than redrawing per-template.

## Anti-patterns

- Blurred drop shadows on canvas cards or buttons. Duo depth is solid-offset only — translate it into Phaser as a thick bottom-fill `Graphics.fillRoundedRect`.
- 1 px strokes anywhere in canvas. Use shadows and fills for hierarchy; if you need an edge, use 2–3 px in `--color-ink`.
- Pure black for text, shadows, or overlays. Use the ink token.
- Pure red for incorrect answers. Use coral, paired with "Aproape!" copy.
- Unicode emoji rendered as game objects. Draw shapes, sprites, or particles instead.
- New brand colours, fonts, or primitive components invented inside a template. Pull them from the canonical Duo spec or escalate to the CTO.
- Bypassing the postMessage protocol to talk to the host. The iframe sandbox is part of the safety model — keep it that way.
