# EduPlay

Personal workspace for the EduPlay platform and educational games.

| Directory | Responsibility | Main tools |
| --- | --- | --- |
| [edu-play-core](./edu-play-core/) | Accounts, classes, activities, assignments, portfolios, and iframe player | Next.js 16, React 19, TypeScript, Supabase |
| [phaser-projects](./phaser-projects/) | Game runtime, renderer plugins, activity editor, validation, and optional AI content tools | Phaser 4, TypeScript, Vite |

The root owns one npm workspace graph, lockfile, and development commands.
Project-specific agent instructions stay in each directory. Keep them adjacent:
platform deployment scripts resolve the game workspace as `../phaser-projects`.

## Development

Use Node.js 24.12.0 and Docker Desktop for local Supabase. Install from the
root lockfile, especially after copying the workspace: npm workspace links from a
different checkout may still point at the old directory.

Start Docker Desktop, then run from the repository root:

```powershell
npm run setup
npm run dev
```

`setup` installs dependencies from the root lockfile, builds shared protocol and
validation exports, starts local Supabase, prepares the local environment file,
and seeds the medium demo dataset with playable Activities. It does not reset
the database. Use `npm run setup:deps` for dependencies and shared builds only
(CI or games-only development, without Docker or database seeding).
`dev` starts the platform
(including local Supabase), Activity host, and config editor together, with
labelled logs. If a command exits, the runner stops the other commands.

Next.js development uses webpack to avoid runaway Turbopack/PostCSS workers
observed on Windows. Production builds still use Next.js's default bundler.
To explicitly try Turbopack, use
`npm run dev:turbo --workspace=edu-play-core`.

| Command | What it runs | URL |
| --- | --- | --- |
| `npm run dev:platform` | Supabase + Next.js | http://localhost:3000 |
| `npm run dev:games` | Activity host | http://localhost:5173 |
| `npm run dev:editor` | Config editor | http://localhost:8091 |
| `npm run dev:storybook` | Optional platform component explorer | http://localhost:6006 |
| `npm run dev:ai` | Optional AI package TypeScript watcher | No HTTP server |

Press Ctrl+C in the `dev` terminal to stop its foreground processes. Supabase
containers remain available between runs; use `npm run dev:stop` to stop the
platform's local stack. That command does not stop separately launched game or
editor terminals. `npm run dev:status` reports platform/Supabase health only.

AI generation services are optional and may require GPU support, model files,
and provider configuration. Use `npm run ai:up` to start their default Docker
Compose services, `npm run ai:status` or `npm run ai:health` to inspect them, and
`npm run ai:stop` to stop them. Optional Compose profiles remain opt-in; see the
[AI package README](./phaser-projects/packages/ai-content/README.md).

Shared libraries (`activity-protocol`, `validation`, `phaser-ui`) and editor
adapters are consumed by the apps; they do not each need a server. See each
project's README for environment configuration and detailed workflows.
After editing protocol or validation source, run `npm run build:shared` to
refresh their compiled exports.

## Local database and demo data

The standard `npm run setup` includes database setup. To start Supabase and seed
again without reinstalling dependencies, run this from the repository root:

```powershell
npm run db:setup
```

This starts local Supabase without launching Next.js, prepares
`edu-play-core/.env.local`, then seeds the medium demo dataset. It does not reset
the database. If Supabase is already running (for example through `npm run dev`),
seed directly:

```powershell
npm run db:seed
```

| Root command | Purpose |
| --- | --- |
| `npm run db:start` | Start/check Supabase and prepare local environment values |
| `npm run db:seed:minimal` | Smallest dataset, with one Activity |
| `npm run db:seed:medium` | Default demo dataset |
| `npm run db:seed:full` | Full demo dataset |
| `npm run db:seed -- --help` | Show seed flags without modifying data |
| `npm run db:seed -- --tier minimal --dry-run` | Validate configs and preview counts without writes or builds |
| `npm run db:seed -- --no-build` | Seed using an existing compiled Activity host |

Normal seeding builds and uploads the shared Activity host to local Supabase
Storage, then creates demo accounts, classes, learners, Activities, assignments,
progress and notifications. It prints the demo login details at the end. The
seed client targets `http://127.0.0.1:54421`; npm workspace execution keeps env
loading and sibling Activity catalog paths relative to `edu-play-core/`.

For cleanup, `npm run db:seed:clean` deletes the medium tier's seed users and
associated data. Select another tier with
`npm run db:seed:clean -- --tier full`. `npm run db:reset` deletes **all local
database data**, reapplies migrations, and seeds medium again. Neither cleanup
nor reset is needed for the normal seed command. Keep schema changes in SQL
migrations; this TypeScript seed runner owns demo data and renderer imports.

## Checks

```powershell
npm run verify:agent
npm run build
```

```powershell
npm run lint
npm run test
npm run test:e2e
```

Platform browser tests require local Supabase and currently run Chromium.
Several authenticated scenarios are still skipped; see the
[E2E notes](./edu-play-core/tests/e2e/README.md).

`build` builds games and the platform with explicit prerequisites: validation
before game consumers, and activity-protocol before Next.js. `build:games`
includes library checks, the config editor bundle, and the Activity host bundle.
`typecheck` checks the platform and compiled game packages. `test` runs platform
unit tests, validation, game-core, and configuration script tests; browser tests
and AI provider integration tests remain separate. `verify:agent` combines the
platform gate with the game checks. Lint coverage still follows the existing
package configurations. Individual scripts are accessible from the root:

```powershell
npm run test:unit --workspace=edu-play-core -- src/path/to/example.test.ts
npm --prefix phaser-projects run generate:schemas
```

## Workspace maintenance

Install from the repository root with Node.js 24.12.0 and npm 11.6.2 or newer.
All apps, tools, and libraries are declared in root package.json. Dependencies
are linked by package name, and package-lock.json is the only dependency lockfile.
Do not recreate nested lockfiles or workspace declarations.
`phaser-projects/package.json` retains command aliases, while its shared
development tools live at root; that directory is not itself a workspace package.
When migrating another existing checkout, remove its old
`phaser-projects/node_modules` before the first root setup so stale tooling cannot
shadow the root installation. Fresh clones need only `npm run setup`.

Examples of dependency updates from the root:

```powershell
npm install <dependency> --workspace=edu-play-core
npm install <dependency> --workspace=@edu-play/game-core
```

TypeScript, Node 24 types, and Playwright use matching versions across packages.
Vitest and Vite retain their existing compatible major versions per consumer;
validation and platform schemas retain separate Zod majors. Shared tooling in
root devDependencies is available to all workspaces. Packages still declare the
tools they directly use so their requirements remain visible.
Root tooling pins retain Phaser 4.1.0 and React Hooks lint plugin 7.0.1 from the
previous lockfiles. Upgrade those deliberately alongside their type/lint impact.

Build order is explicit in root and Phaser scripts. When adding a built package,
declare its dependency by name and add its build before consumers. Root checks
do not rely on npm recursively discovering nested workspaces or sorting them.
This small graph does not currently need a separate task runner or build cache.

GitHub Actions runs root installation, lint, type checks, guardrails, unit tests,
and builds on pull requests and pushes to main. See
[CI notes](./.github/workflows/README.md) for coverage and deployment details.

Docker builds use the repository root as context. Development Compose files
already select that context. For a production image, provide the public Supabase
URL and anonymous key at build time (Next.js embeds public environment values):

```powershell
docker build -f edu-play-core/Dockerfile --build-arg NEXT_PUBLIC_SUPABASE_URL --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY -t eduplay .
```

Set those environment variables in your shell first. Supply server-only secrets
at runtime. The image runs Next.js standalone output under edu-play-core, with
root dependency tracing enabled. Existing renderer deployment scripts keep their
sibling-directory paths because app directories have not moved.

## Agent skills

Shared skills live in the root `.agents/skills/`: `simplify` and the five
TanStack skills (Query, Table, Form, Router, and Start). TanStack guidance is
available for selective adoption; it does not change the current Next.js
architecture. Check version-sensitive guidance against current official docs.

Project-specific skills stay with their project: Mantine and Next.js skills in
`edu-play-core/.agents/skills/`, and Phaser skills in
`phaser-projects/.agents/skills/`. Each of these three locations has a
`skills-lock.json` in its owning directory. Run skill installation and update
commands from that directory so the installed skills and lockfile stay together.
Keep shared skills at the root rather than duplicating them in subprojects.

The Phaser lockfile records the existing checked-in content from
`phaserjs/phaser`, including the local `v4-new-features` reference version.

## Local files and release status

Keep real credentials in ignored environment files. `edu-play-core/env.example`
contains placeholders only. IDE metadata, temporary screenshots, and captured
account pages are excluded by the root `.gitignore`.

The imported Jenkinsfiles describe the previous delivery setup; importing them
does not configure CI or branch protection for this personal GitHub repository.
Database authorization findings, dependency advisories, and missing privacy
documentation still need release-readiness work. Docker execution still needs
verification on a running Docker engine before release.
This cleanup does not resolve those findings or establish production readiness.
