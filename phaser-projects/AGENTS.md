## Architecture Invariants

- Templates are plugins over `@edu-play/game-core`. Templates may define scenes, game-specific rules, config adapters, assets, and editor adapters; they must not own shared runtime lifecycle, postMessage bridge behavior, diagnostics, preview settings, or framework-level globals.
- Do not reintroduce per-template webpack infrastructure, hardcoded dev-server ports, duplicated host lifecycle, per-template package/workspace entries, or root `start:<template>` / `build:<template>` scripts. Use the single game-core Activity host (`npm run start:activities`).
- `renderers/*/renderer.json` and `activities/*/activity.json` are the runtime discovery sources for the Activity host. Do not add new code dependencies on `packages/game-core/templates/registry.json`; keep renderer/editor metadata with renderer folders and editor adapters.
- `@edu-play/game-core` owns lifecycle, context, managers, bridge, loaders, template framework, and shared game chrome that is part of running a game.
- `@edu-play/phaser-ui` is Duo design tokens plus Phaser UI primitives. Do not add lifecycle/framework behavior there; shared game lifecycle belongs in `@edu-play/game-core`.
- Shared progress/reporting should move toward first-class `totalSteps` / `currentStep` semantics. Avoid adding new question-centric assumptions or fake `questions: []` flows when a step-based activity model would fit better.
- Prefer shared preload, config hydration, and asset discovery hooks in `game-core` over new per-template preload duplication when working on new templates or refactoring hybrid templates.

## Simplification Pass

Opportunistically use the globally installed `simplify` skill when a task
introduces or exposes unnecessary complexity. Treat this as a cross-cutting
final pass, not as permission to over-refactor.

Use it when:

- code becomes harder to read than before
- logic is duplicated
- abstractions feel heavier than the problem
- control flow is awkward or deeply nested
- a refactor, cleanup, or maintainability task is requested
- the final diff feels larger or more complex than necessary

Do not use it when:

- the task is a tiny targeted fix
- simplification risks changing behavior without tests
- public APIs or contracts could change unexpectedly
- the user explicitly asks for minimal or no refactoring

Default workflow:

1. Implement the requested change.
2. If complexity increased or obvious simplification is available, apply the
   `simplify` skill.
3. Preserve behavior and public interfaces unless the user asked otherwise.
4. Run relevant tests/checks.
5. Mention any simplification performed in the final summary.

## Design Guidance

For any UI, frontend, visual, or interaction work, all agents must read:

- `DESIGN.md` - Repo-wide design contract and compliance checklist
- `.impeccable.md` - Canvas-specific design review addenda (font, touch targets, feedback rules, themes, audio, motion). Starts with a pointer to the canonical `edu-play-core/.impeccable.md` — read that first.
