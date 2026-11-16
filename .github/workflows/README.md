# Monorepo CI

`ci.yml` is the repository's GitHub Actions entrypoint. It runs on pull requests,
pushes to `main`, and manual dispatch, using Node from the root `.nvmrc` and the
single root npm lockfile. Commands run from the repository root:

1. `npm run setup`: frozen install and shared exports.
2. `npm run lint`: existing platform and AI package lint coverage.
3. `npm run typecheck`: platform and game library TypeScript checks.
4. `npm run check:agent-guardrails`: platform changed-file guardrails.
5. `npm test`: platform unit, validation, game-core and configuration script tests.
6. `npm run build`: prerequisite libraries, game/editor bundles and Next.js.

After setup, CI also validates the installed workspace dependencies with
`npm ls --workspaces --include-workspace-root --depth=0`.

Builds use public placeholder Supabase values; no deployment credentials are
required. This workflow does not deploy or start provider services.

Browser and database tests remain separate (`npm run test:e2e` requires Docker,
local Supabase and Playwright Chromium). They are not covered by the unit/build
job. Neither are optional AI model/provider integration tests. The retained
nested Jenkinsfiles are archives of the original repositories and should not be
configured as monorepo jobs.

No repository settings or branch protection are changed by adding this file.
After the workflow runs on GitHub, its `Lint, types, tests and builds` check can
be selected as a required check. Existing external Jenkins requirements must be
reviewed separately by the repository owner.

Docker uses the repository root build context; see the root README. The Next.js
development Compose files use a new `workspace_node_modules` volume so an old
standalone dependency volume cannot mask the migrated install. The Next.js
standalone tree preserves `edu-play-core/server.js`, so the production image
launches that path and copies static/public assets alongside it. Sibling game
deployment paths remain valid because the application directories did not move.
