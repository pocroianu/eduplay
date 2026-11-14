# CONTRIBUTING.md — EduPlay Contribution Guide

> How we work together as an engineering team. Follow these conventions so that every PR is readable, every commit is traceable, and every deploy is safe.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Git Workflow](#git-workflow)
3. [Branch Naming](#branch-naming)
4. [Commit Format](#commit-format)
5. [Pull Request Process](#pull-request-process)
6. [Code Quality Gates](#code-quality-gates)
7. [Review Guidelines](#review-guidelines)
8. [Phaser Projects Repo](#phaser-projects-repo)

---

## Prerequisites

- Node.js **24.12.0** (use `nvm use` — `.nvmrc` is present in both repos)
- Docker Desktop (for Supabase local dev)
- Git with GPG signing configured (preferred — ask CTO for setup)

---

## Git Workflow

We use a **trunk-based development** workflow with short-lived feature branches.

```
main (always deployable)
 ├── feat/EDUA-42-teacher-bulk-assign
 ├── fix/EDUA-67-student-login-rate-limit
 └── chore/EDUA-55-upgrade-next-16
```

### Rules

- **Always work on a dedicated feature branch.** Never commit to, or push to, `main` — not even "just this once" for docs or typos.
- **Every change reaches `main` through a Pull Request.** At the end of a work session, push your branch and open a PR; direct pushes to `main` are rejected.
- **`main` is always deployable.** Treat it as read-only for humans and agents.
- Feature branches are **short-lived** (days, not weeks). If a branch lives longer than a week, break it into smaller PRs.
- Rebase onto `main` before opening a PR — no merge commits from upstream.
- Delete branches after merging.
- Do not use `--no-verify` to skip hooks. Fix the failing check.

### Agents and AI Contributors

If you are an AI agent (Claude Code, Codex, Copilot, etc.) working in this repo, the branch-and-PR rule is **mandatory, not advisory**:

1. Before making edits, confirm you are on a `feat/` / `fix/` / `chore/` / `refactor/` / `docs/` / `test/` / `perf/` branch — never on `main`. If you find yourself on `main`, create a new branch before writing any files.
2. Commit incrementally on that branch.
3. Push the branch (`git push -u origin <branch>`) when a logical unit of work is complete.
4. Open a PR with `gh pr create` at the end of the session, even for small changes. Do not leave work stranded in unpushed local commits.

### Daily Flow

```bash
# Start new work
git checkout main
git pull --rebase
git checkout -b feat/EDUA-42-short-description

# Stay current with main
git fetch origin
git rebase origin/main

# Open PR when ready
gh pr create --title "feat: add bulk assignment for teachers [EDUA-42]"
```

---

## Branch Naming

```
{type}/{ticket-id}-{short-kebab-description}
```

| Type | When to use |
|------|-------------|
| `feat/` | New feature or user-visible behaviour |
| `fix/` | Bug fix |
| `chore/` | Non-functional change: tooling, deps, config |
| `refactor/` | Code restructuring with no behaviour change |
| `docs/` | Documentation-only change |
| `test/` | Test-only change |
| `perf/` | Performance improvement |

**Examples:**
```
feat/EDUA-42-teacher-bulk-assign
fix/EDUA-67-student-login-rate-limit
chore/EDUA-55-upgrade-next-16
docs/EDUA-12-update-architecture
```

---

## Commit Format

We follow **Conventional Commits** with a ticket suffix.

```
{type}({scope}): {short description} [{ticket-id}]

{optional body — explain the WHY, not the WHAT}

{optional footers}
```

### Types

| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Tooling, config, deps |
| `refactor` | Code restructure, no behaviour change |
| `docs` | Documentation only |
| `test` | Tests only |
| `perf` | Performance improvement |
| `style` | Formatting, no logic change |
| `ci` | CI/CD changes |

### Scopes (edu-play-core)

Common scopes: `auth`, `games`, `students`, `classes`, `assignments`, `reports`, `admin`, `db`, `api`, `ui`, `deps`

### Examples

```
feat(students): add PIN reset flow for teachers [EDUA-42]

Teachers can now reset student PINs from the class management view.
The reset generates a new 4-digit PIN and emails the teacher a printable
slip. Rate-limited to 3 resets per student per day.

feat(games): integrate phaser postMessage score reporting [EDUA-55]

fix(auth): prevent rate limit bypass via email normalization [EDUA-67]

chore(deps): upgrade Next.js to 16.2.0 [EDUA-80]

docs: add ARCHITECTURE.md covering both repos [EDUA-2]
```

### Rules

- **Subject line ≤ 72 characters.**
- Use the **imperative mood**: "add", not "added" or "adds".
- Reference the ticket ID at the end of the subject line.
- Body explains *why*, not *what* — the diff explains what.

---

## Pull Request Process

### Opening a PR

1. **Self-review your diff first.** Read it as if you are a reviewer who knows nothing about the branch.
2. **Fill in the PR template** (`.github/pull_request_template.md` if present, otherwise cover these sections):
   - **What** — one sentence summary
   - **Why** — the ticket or problem being solved
   - **How** — key implementation decisions worth calling out
   - **Testing** — how you verified this works
   - **Screenshots / screen recordings** — required for UI changes

3. **Link the ticket.** Use `Closes #42` or `Refs EDUA-42` in the PR description.
4. **Mark as Draft** if the PR is not ready for review. Remove the Draft status when it is.

### PR Size Guidelines

| Lines changed | Expectation |
|---------------|-------------|
| < 200 | Reviewed and merged same day |
| 200–400 | Reviewed within 1 business day |
| > 400 | Must be split unless a single atomic migration |

Large PRs slow down the team. If your PR is large, explain why it cannot be split.

### Review Turnaround

- First review within **1 business day** of marking ready.
- Re-review of addressed comments within **4 hours**.
- Merge within **1 business day** of final approval.

### Merging

- **Squash merge** for feature branches (clean `main` history).
- **Merge commit** for release branches (preserves full history).
- The PR author merges after approval (not the reviewer).
- Delete the branch after merging.

> **Note:** The interim "Hold-Posture" merge process retired on 2026-04-28 once self-hosted CI went green ([EDU-104](/EDU/issues/EDU-104), [EDU-160](/EDU/issues/EDU-160)). PRs no longer require a `## Hold Posture` section or a separate "CTO Hold-Posture Sign-off" comment — standard CI checks plus normal review/approval are the merge gate again. The retired policy is kept for historical reference at [`docs/process/hold-posture-merge-policy.md`](docs/process/hold-posture-merge-policy.md).

---

## Code Quality Gates

All gates must pass before a PR can merge. They run in CI and locally:

```bash
npm run lint          # ESLint — zero errors, zero warnings on new code
npm run typecheck     # TypeScript strict — zero errors
npm run test:unit     # Vitest — all pass
npm run test:e2e      # Playwright — all pass (requires Supabase running)
```

### Running Gates Locally

```bash
# Quick check before pushing
npm run lint && npm run typecheck && npm run test:unit

# Full check including E2E (slower)
npm run dev:full      # Start Supabase + Next.js
npm test              # Unit + E2E
```

### Gate Rules

- **Never use `--no-verify`** to skip pre-commit hooks. Fix the code.
- If a test is flaky, fix or skip it with a comment — do not delete it silently.
- New features must include unit tests. UI changes must include or update E2E tests.
- Type assertions (`as X`) must have a comment explaining why the cast is safe.

---

## Review Guidelines

### For Authors

- **Self-review before requesting review.** Check for debug code, TODOs, and console.log.
- **Respond to every comment.** Either fix it or explain why you disagree.
- **Keep PRs focused.** Do not sneak in unrelated refactors.
- **Update tests when changing components** (see testing rules in `AGENTS.md`).

### For Reviewers

- **Complete reviews within 1 business day.**
- **Review for correctness and security first.** Style is the linter's job.
- **Distinguish blocking from optional.** Use `nit:` or `optional:` for non-blocking suggestions.
- **Approve when good enough.** Do not withhold approval over minor preferences.
- **Explain the why** when requesting changes. A bare "change this" is not helpful.

### Security Review Checklist

For PRs touching auth, API routes, or database policies, verify:

- [ ] No raw error messages returned to clients
- [ ] Input validated with Zod at all API boundaries
- [ ] New RLS policies are scoped, not blanket
- [ ] `postMessage` handlers validate `event.origin`
- [ ] Rate limiting in place for auth endpoints
- [ ] No secrets committed (`.env.local` is gitignored)

---

## Phaser Projects Repo (`phaser-projects`)

The `phaser-projects` monorepo follows the same conventions above with these additions:

### Commands

```bash
npm install                          # Install all workspace deps
npm run build:multiple-choice        # Build a specific template
npm run build:all                    # Build all templates
npm run test:e2e                     # Playwright E2E tests
```

### Branch Naming

Same format. Use the same ticket ID when a branch spans both repos:

```
feat/EDUA-55-multiple-choice-score-reporting
```

### Commit Scopes (phaser-projects)

Common scopes: `game-core`, `multiple-choice`, `matching-game`, `memory-game`, `tracing-game`, `sequence-order`, `categorize`, `a11y`, `i18n`, `editor`, `validation`, `deps`

### PostMessage Contract

Changes to the game ↔ web app postMessage protocol are **breaking changes**. They require:

1. A ticket with sign-off from the CTO.
2. Coordinated PRs in both repos.
3. Version bump in the protocol spec (`public/games/README.md` in `edu-play-core`).

### Phaser Editor Sync Rule

Never edit generated scene file code outside `/* START-USER-CODE */` blocks. See the agent guide in `phaser-projects` before changing generated scenes.

---

## EU Region Pinning

All serverless/edge functions must run in the EU to comply with GDPR data residency requirements (`PRIVACY.md` §2).

- `vercel.json` pins the global deployment region to `fra1` (Frankfurt). **Do not remove or change this.**
- Route handlers **must not** set `export const preferredRegion` to a non-EU region. The global pin covers all routes; per-route overrides are only needed if you want a *different* EU region (e.g. `arn1`, `cdg1`, `dub1`).
- If you need to add a new third-party service that processes user data, confirm it has an EU data path and add it to the sub-processor register.

---

## Questions

Raise questions in the relevant Paperclip ticket or ping the CTO directly.
