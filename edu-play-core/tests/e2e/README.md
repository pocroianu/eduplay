# EduPlay E2E Tests

Playwright tests live under `tests/e2e/specs` and use page objects from
`tests/e2e/pages`.

## Commands

```bash
npm run test:e2e          # Full configured Playwright suite
npm run test:e2e:smoke    # Focused Chromium smoke suite
npm run test:e2e:report   # Open the last HTML report
```

`npm run test:e2e:smoke` covers representative teacher, student, parent, admin,
assignment launch, and game/play paths through existing specs. Use it for fast
browser confidence before full E2E when changing shared routing, auth, shells,
or agent-facing guardrails.

## Artifacts

Playwright writes:

- `playwright-report/**` for the HTML report and JUnit report in CI
- `test-results/**` for screenshots, videos, and traces

CI keeps traces on first failure. Local runs collect traces on first retry to
avoid noisy artifacts during normal development.

## Prerequisites

Start the local stack before E2E:

```bash
npm run dev:full
```

If you start Supabase manually, ensure `.env.local` has the local Supabase URL,
anon key, and service role key before running Playwright.
