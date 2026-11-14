# Introduce an Activity/Step progress seam in game-core

## Status

Accepted

## Context

`@edu-play/game-core` currently treats `questions` as the primary runtime progress model. That fits the `multiple-choice` template, but most other templates are not question-shaped. They model learner progress as rounds, pairs, placed items, repeated sequences, traceable items, or listen-and-tap prompts.

Several templates currently adapt to the question-centric core by creating synthetic configs with `questions: []` and `meta.totalSteps`. Examples include matching, categorize, sequence-order, memory, counting, pattern, repeat-sequence, listen-tap, and tracing. This lets some shared UI read `totalSteps`, but core runtime behavior still relies on `questions.length` in important places:

- `GameManager.getTotalQuestions()` drives legacy progress and completion payloads.
- `PostMessageBridge` maps question events to parent `PROGRESS_UPDATE` / `GAME_COMPLETE` messages.
- `Results` assumes `score / totalQuestions`.
- Diagnostics mix `totalQuestions`, `totalSteps`, and completion state.

For non-question templates this can produce zero totals, wrong percentages, bad score denominators, or completion payloads that do not match what the learner experienced.

## Decision

Extend the existing `GameManager` with a first-class **Activity/Step** progress model before introducing any new manager abstraction.

Use the names `activity` and `step` because parent bridge messages already use Activity terminology and shared config/UI already uses `totalSteps`.

The new API should be shaped around these concepts:

- `loadActivity(...)`
- `startStep(...)`
- `completeStep(...)`
- `completeActivity(...)`
- `getTotalSteps()` / `getCurrentStep()` / activity score helpers
- events such as `ACTIVITY_LOADED`, `STEP_STARTED`, `STEP_COMPLETED`, and `ACTIVITY_COMPLETE`

Keep the existing question API as a compatibility layer. `loadConfig(config)` should also initialize activity state for question-based configs, using `questions.length` as the runtime step count and the sum of question points as `maxScore`.

## Progress semantics

A step is a learner-facing unit of progress shown in the UI, not every atomic input action.

Examples:

- listen-tap: one audio prompt + choice tap is one step.
- counting/pattern/repeat-sequence: one round is one step.
- matching/memory: each completed pair can be one step when the UI shows pair progress.
- categorize/sequence-order: each correctly placed item can be one step when item completion is the learner-facing progress.
- tracing: each completed traceable item is one step, not every stroke sample.

Step indexes are zero-based internally. Event payloads should include both zero-based and one-based forms, for example:

```ts
{
  stepIndex: 0,
  currentStep: 1,
  totalSteps: 5
}
```

Parent progress should be completion-based. `STEP_STARTED` may support UI/diagnostics, but `STEP_COMPLETED` is the canonical source for parent `PROGRESS_UPDATE`.

`completeStep(index)` should be idempotent. Repeated completion of the same step must not add score again. Duplicate completions may warn in development, but should not crash production games.

Templates decide when a step is complete. `completeStep({ correct: false })` is allowed for one-attempt-and-advance games, while retry-based games should call `completeStep` only when the step is accepted.

`completeActivity()` should be explicit for generic activities. Reaching `completedSteps === totalSteps` should not automatically complete the activity by default, because templates may need celebration, delay, cleanup, or a Results transition first. Legacy `nextQuestion()` can preserve its current auto-completion behavior for multiple-choice.

## Scoring semantics

`GameManager` stores raw score and explicit `maxScore`. Parent-facing bridge score remains a percentage for backward compatibility.

- `score` in `PROGRESS_UPDATE` / `GAME_COMPLETE` remains percent-like.
- Percentages are computed from `rawScore / maxScore`, not `score / totalSteps`.
- Future bridge fields may include raw values, for example `rawScore` and `maxScore`, but existing consumers should continue to receive `score` as a percentage.

Migrated templates should prefer step-scoped scoring:

```ts
gameManager.completeStep(index, { scoreDelta, correct });
```

`addPoints()` remains for compatibility and unusual bonus mechanics, but new template code should prefer `completeStep` when score is tied to progress.

`getStarRating()` should use activity score percentage by default:

- 90%+ -> 3 stars
- 70%+ -> 2 stars
- 50%+ -> 1 star
- otherwise 0 stars

Templates with special rating logic may override the rating during completion.

If `totalSteps` or `maxScore` is zero, runtime code must not divide by zero. Empty playable configs should fail validation, but runtime fallback behavior should produce safe zero progress/score/star values.

## Results semantics

Shared `Results` should move away from `score / totalQuestions` and normalize explicit scoring data such as:

```ts
{
  rawScore: 40,
  maxScore: 50,
  scorePercent: 80,
  completedSteps: 5,
  totalSteps: 5,
  starRating: 2
}
```

For compatibility, old `{ score, totalQuestions }` payloads may still be accepted and normalized internally. Results UI should display child-friendly percentage/stars or `rawScore / maxScore` points, never `rawScore / totalSteps` when those units differ.

## Bridge semantics

`PostMessageBridge` should prefer activity events:

- `STEP_COMPLETED` -> `PROGRESS_UPDATE`
- `ACTIVITY_COMPLETE` -> `GAME_COMPLETE`

Legacy question/score listeners may remain as fallback only when no activity state has been loaded. The bridge must avoid duplicate messages when both legacy and activity events fire during migration.

`completeActivity()` should also emit the legacy `GAME_COMPLETE` event with backward-compatible fields populated from activity state. Treat `GAME_COMPLETE` as a compatibility alias while new code moves to `ACTIVITY_COMPLETE`.

## Runtime total source of truth

Runtime-derived content length wins over config metadata. For multiple-choice, `questions.length` is the step count. For other templates, the hydrated rounds/items/pairs/etc. determine `totalSteps`.

Config `meta.totalSteps` remains useful editorial metadata and should be validated against runtime content where possible, but stale metadata must not drive runtime progress when content length disagrees.

## Migration plan

Use a tracer-bullet migration instead of converting every template at once:

1. Add `GameManager` activity/step API and unit tests.
2. Add bridge unit tests for activity progress, percentage score mapping, and zero-denominator safety.
3. Migrate `listen-tap` first because it clearly exposes the broken progress/score denominator issue.
4. Migrate `matching-game` next to prove the API works for a structurally different pair-completion template.
5. Add an iframe-style E2E assertion for `listen-tap` parent messages: `ACTIVITY_READY`, nonzero `PROGRESS_UPDATE`, and sane `GAME_COMPLETE`.
6. Bulk-migrate remaining templates after the seam is proven.

During the transition, templates may still call `loadConfig(...)` to preserve theme/title/config access for existing UI. `loadActivity(...)` is the canonical progress/scoring state, and new code should read totals from activity helpers rather than `getTotalQuestions()`.

## Deferred decisions

These are intentionally not part of the first progress tracer:

- Moving non-multiple-choice config hydration from template scenes into shared `game-core` template hydrators.
- Moving prompt audio and other asset discovery into shared `AssetResolver` usage.
- Making the template registry the single source of truth for all host/editor metadata.
- Extracting activity progress into a separate manager after the API stabilizes.

## Consequences

- `game-core` gains a deeper progress/completion seam that matches all template shapes.
- Existing question-based code continues to work during migration.
- Parent bridge behavior becomes correct for non-question templates without changing the external percentage-based contract.
- Results and star rating calculations become score-denominator-safe.
- Template migrations can happen incrementally without duplicating more question-shaped shims.
