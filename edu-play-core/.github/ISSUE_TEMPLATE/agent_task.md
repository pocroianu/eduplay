---
name: Agent Task
about: Define an implementation task for Codex, Claude, or another coding agent
title: '[AGENT] '
labels: 'agent-task'
assignees: ''
---

## Goal

<!-- One concrete outcome. Avoid bundling unrelated work. -->

## Source Of Truth

<!-- Link the issue, PR, spec, design, or doc the agent must follow. -->

- `AGENTS.md`
- `ARCHITECTURE.md`
- `DESIGN.md`
- Related issue/spec:

## Likely Files

<!-- List likely entry points or modules. The agent should still inspect the repo. -->

- `path/to/file`

## Out Of Scope

<!-- Explicitly list things the agent should not change. -->

- No database schema changes unless stated above.
- No unrelated refactors.

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Relevant docs or follow-up issue updated

## Verification

Required fast guardrail gate for any code change:

```bash
npm run check:agent-guardrails
```

Required default final gate:

```bash
npm run verify:agent
```

Add browser verification when touching routes, auth, UI shells, games, or iframe/play flows:

```bash
npm run test:e2e:smoke
```

## Browser Artifacts

<!-- Required for UI/browser work. Attach or link report, trace, screenshot, or video. -->

- [ ] Playwright report or trace inspected
- [ ] Screenshot/video included when visual behavior changed

## Follow-Up Notes

<!-- Record known follow-ups here instead of leaving ad-hoc TODOs in code. -->
