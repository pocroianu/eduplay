# EduPlay E2E Tests

Playwright tests live under `tests/e2e/specs` and use page objects from
`tests/e2e/pages`.

## Commands

```bash
npm run test:e2e          # Full configured Playwright suite
npm run test:e2e:smoke    # Focused Chromium smoke suite
npm run test:e2e:report   # Open the last HTML report
```

Only Chromium is currently configured. The smoke command selects teacher,
student, parent, admin, and assignment specs, but successful login and several
assignment scenarios remain skipped pending deterministic fixtures. A passing
smoke run does not yet verify the full authenticated assignment lifecycle.

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
