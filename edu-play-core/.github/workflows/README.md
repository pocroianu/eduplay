# CI Workflows

EduPlay currently uses the self-hosted Jenkins pipeline in `Jenkinsfile` as the
merge gate. This directory intentionally has no active GitHub Actions workflow
YAML files.

Historical GitHub Actions notes were retired after EDU-104 brought self-hosted
CI online. Do not assume `test.yml`, `e2e-full.yml`, `pr-comments.yml`, or
`code-review.yml` are active unless corresponding workflow files are restored.

## Active Jenkins Pipeline

`Jenkinsfile` runs in a pinned CI container and performs:

- install with npm 10 via `npx npm@10 ci`
- `npm run lint`
- `npm run typecheck`
- `npm run check:agent-guardrails`
- `npm run test:unit:coverage`
- Supabase startup and `npx supabase db reset`
- `npm run check:types-drift`
- Chromium Playwright E2E through `npm run test:e2e -- --project=chromium`

The E2E section is serialized with the Jenkins Lockable Resources plugin so
parallel branch builds do not race for local Supabase Docker ports.

## Local Agent Gates

Use these before opening or updating a PR:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run check:agent-guardrails
npm run verify:agent
```

`npm run verify:agent` runs the default local agent gate and only invokes the
Supabase type drift check when migrations changed. Use `npm run test:e2e` or
`npm run test:e2e:smoke` when the change touches user flows, route protection,
game iframe behavior, or browser-only UI.

## Artifacts

Jenkins archives:

| Artifact | Description |
| --- | --- |
| `coverage/**` | Unit coverage reports |
| `playwright-report/**` | Playwright HTML/JUnit reports |
| `test-results/**` | Playwright screenshots, traces, and failure assets |

## AI Review Status

The repo still contains `.github/code-review-system.md` and
`.github/scripts/ai-code-review.py` as dormant design assets. There is no active
GitHub Actions workflow wiring them into PRs right now. If AI review is restored,
document the active trigger, runner, required secrets, and artifact paths here.

## Branch Protection

Recommended `main` protection:

- require the Jenkins multibranch check to pass
- require at least one PR approval
- require conversation resolution
- disallow force pushes and branch deletion

## Troubleshooting

- Jenkins install failures: inspect the Install stage diagnostics for Node/npm,
  disk, memory, and lockfile state.
- Supabase E2E failures: inspect the archived Supabase container diagnostics
  emitted before teardown.
- Type drift failures: regenerate database types with `npm run generate:types`
  after applying migrations locally.
- Browser failures: open the archived Playwright report and trace assets.
