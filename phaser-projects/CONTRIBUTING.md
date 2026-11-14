# CONTRIBUTING.md — phaser-projects

> Game templates and shared engine for EduPlay. Same workflow as `edu-play-core`; this file calls out what is specific to this repo.

The canonical contribution guide lives at [`edu-play-core/CONTRIBUTING.md`](../edu-play-core/CONTRIBUTING.md). Read it first — everything below assumes those rules.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Git Workflow](#git-workflow)
3. [Branch Naming](#branch-naming)
4. [Commit Format](#commit-format)
5. [Pull Request Process](#pull-request-process)
6. [Code Quality Gates](#code-quality-gates)
7. [Repo-Specific Rules](#repo-specific-rules)

---

## Prerequisites

- Node.js **24.12.0** (`nvm use` — `.nvmrc` present)
- A checkout of `edu-play-core` in a sibling directory if you need to test the full game ↔ web app loop

---

## Git Workflow

We follow the same trunk-based workflow as `edu-play-core`.

### Rules

- **Always work on a dedicated feature branch.** Never commit to, or push to, `main` — not even for docs, asset swaps, or typo fixes.
- **Every change reaches `main` through a Pull Request.** At the end of a work session, push your branch and open a PR; direct pushes to `main` are rejected.
- **`main` is always deployable.** Treat it as read-only for humans and agents.
- Feature branches are **short-lived** (days, not weeks).
- Rebase onto `main` before opening a PR — no merge commits from upstream.
- Delete branches after merging.
- Do not use `--no-verify` to skip hooks. Fix the failing check.

### Agents and AI Contributors

If you are an AI agent (Claude Code, Codex, Copilot, etc.) working in this repo, the branch-and-PR rule is **mandatory, not advisory**:

1. Before making edits, confirm you are on a `feat/` / `fix/` / `chore/` / `refactor/` / `docs/` / `test/` / `perf/` branch — never on `main`. If you find yourself on `main`, create a new branch before writing any files.

### Daily Flow

```bash
git checkout main
git pull --rebase
git checkout -b feat/EDUA-55-multiple-choice-score-reporting

# ... make changes, commit ...

git fetch origin
git rebase origin/main
git push -u origin feat/EDUA-55-multiple-choice-score-reporting

gh pr create --title "feat(multiple-choice): add score reporting [EDUA-55]"
```

---

## Branch Naming

Same format as `edu-play-core`:

```
{type}/{ticket-id}-{short-kebab-description}
```

Use the **same ticket ID** when a branch spans both repos (e.g., protocol changes that require coordinated PRs).

---

## Commit Format

Same Conventional Commits + ticket suffix as `edu-play-core`.

### Scopes (phaser-projects)

Common scopes: `game-core`, `multiple-choice`, `matching-game`, `memory-game`, `tracing-game`, `sequence-order`, `categorize`, `a11y`, `i18n`, `editor`, `validation`, `deps`.

### Examples

```
feat(multiple-choice): add score reporting via postMessage [EDUA-55]
fix(matching-game): prevent double-fire of card flip on touch [EDUA-71]
chore(deps): bump phaser to 3.88.2 [EDUA-82]
```

---

## Pull Request Process

Follow the process in `edu-play-core/CONTRIBUTING.md` §"Pull Request Process". The PR description must include:

- Which templates are affected (`game-core` changes often hit all of them).
- Screenshots or screen recordings for any visual change.
- Confirmation that the build passes for each affected template.

---

## Code Quality Gates

```bash
npm install                                      # Install workspace deps
npm run build:host --workspace=@edu-play/game-core  # Build the single Activity host
npm run build:all                                # Build all workspace packages
npm run test:e2e                                 # Playwright E2E tests through the Activity host
```

All gates must pass before merge. Do not use `--no-verify`.

---

## Repo-Specific Rules

### PostMessage Contract

Changes to the game ↔ web app postMessage protocol are **breaking changes**. They require:

1. A ticket with sign-off from the CTO.
2. Coordinated PRs in both repos (`phaser-projects` + `edu-play-core`) on branches sharing the same ticket ID.
3. A version bump in the protocol spec (`public/games/README.md` in `edu-play-core`).

### Phaser Editor Sync Rule

Never edit generated scene file code outside `/* START-USER-CODE */` blocks. See `CLAUDE.md`.

### Assets and Binaries

- Do not commit unoptimised assets. Run the template's asset pipeline first.
- Do not commit anything under `node_modules/`, `test-results/`, or Playwright traces.

---

## Questions

Raise questions in the relevant Paperclip ticket or ping the CTO directly.
