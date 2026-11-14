# EduPlay Romania - Early Learning Platform

> Educational gaming platform for Romanian children (ages 3-12). Built with Next.js 16, Supabase, and Phaser games.

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)](https://supabase.com/)

## Quick Start

**Prerequisites:** Node.js 24.12.0, Docker Desktop, Git

```bash
git clone https://github.com/pocroianu/eduplay.git
cd eduplay/edu-play-core
npm ci
npm run dev:full          # Starts Supabase + Next.js and auto-writes .env.local
```

- App: http://localhost:3000
- Supabase Studio: http://localhost:54423
- Supabase API: http://localhost:54421

```bash
npm run dev:status        # Check services
npm run dev:stop          # Stop everything
```

## First Run

What `npm run dev:full` does for you:
- verifies required tools are available (`node`, `npm`, `docker`, `npx supabase`)
- checks that Node.js matches the required version (`24.12.0`)
- starts the local Supabase stack
- generates `.env.local` from `npx supabase status -o env`
- starts Next.js

Expected timing:
- first-ever Supabase startup on a machine: typically 1-3 minutes because Docker images may need to be prepared
- normal subsequent startup: usually 10-30 seconds

If startup fails:
- wrong Node version: switch to `24.12.0`
- Docker not running: open Docker Desktop and wait until it is healthy
- stale local services: run `npm run dev:stop`, then retry
- broken local database/container state: run `npx supabase db reset` or `npx supabase stop --no-backup && npm run dev:full`
- custom env conflicts: remove or rename `.env.local` if you want the script to regenerate the local Supabase keys

## Project Structure

```
src/
├── app/                  # Next.js App Router (routes only)
│   ├── (auth)/           # Public auth routes
│   ├── (dashboard)/      # Protected: teacher/, student/, parent/, admin/
│   └── games/[gameId]/   # Game player
├── features/             # Domain modules (auth, classes, students, games, etc.)
│   └── {feature}/        # components/, hooks/, actions/, queries/, schemas/, types/
├── shared/               # UI primitives, hooks, lib, types
└── config/               # App configuration
```

## Scripts

```bash
# Development
npm run dev:full          # Start all services
npm run dev               # Next.js only
npm run dev:docker        # Docker Compose alternative

# Database
npm run generate:types    # Regenerate TS types after schema changes
npx supabase db reset     # Reset database (deletes data)

# Testing
npm run test:unit         # Vitest
npm run test:e2e          # Playwright
npm run test:e2e:smoke    # Focused Chromium smoke suite
npm run test:e2e:ui       # Playwright with UI

# Code Quality
npm run lint              # ESLint
npm run format            # Prettier
npm run typecheck         # TypeScript
npm run verify:agent      # Default local agent gate
```

## Database

Key tables: `profiles`, `classes`, `students`, `activities`, `activity_versions`, `activity_progress`, `assignments`

```bash
# Studio GUI: http://localhost:54423
# Connection: postgresql://postgres:***@localhost:54422/postgres
```

## Game Development

Games use Phaser 4 on a shared Vite Activity host, embedded in iframes and communicating via `postMessage`. Renderer bundles are deployed to Supabase Storage and served through the platform's renderer proxy. See [public/games/README.md](./public/games/README.md).

## API

REST API available at `/api/v1/`. All endpoints return `{ data, error, meta }`.

```bash
# Health check
curl http://localhost:3000/api/v1/health

# List activities (requires auth cookie)
curl http://localhost:3000/api/v1/activities
```

Key endpoints: `/api/v1/activities`, `/api/v1/classes`, `/api/v1/students`, `/api/v1/assignments`, `/api/v1/progress`. The old `/api/v1/games` endpoint returns HTTP 410. See [docs/api.md](./docs/api.md) and [ARCHITECTURE.md](./ARCHITECTURE.md#api-layer) for API details.

## Environment Variables

For local Supabase CLI development, `npm run dev:full` auto-generates `.env.local` with the current local keys and URLs before Next.js starts.

Generated keys include:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

If `.env.local` already exists and was created manually, the startup script will keep it and print that it is using your custom file instead of overwriting it.

Use `env.example` only when you intentionally want to point the app at a different Supabase project or provide manual overrides.

## Deployment

```bash
npm run build && npm run start    # Production
```

The root Docker files are retained for ongoing deployment work, but the
production Dockerfile does not yet match the required Node version and Next.js
output configuration. Validate and repair that path before using it for a
release.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Port in use | `npx supabase stop` or `docker compose down` |
| DB connection errors | `npx supabase db reset` then `npm run dev:full` |
| PG version mismatch | `npm run dev:stop`, remove Docker volumes, restart |
| Types outdated | `npm run generate:types` |

## Documentation

- [AGENTS.md](./AGENTS.md) - Agent workflow and development conventions
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design and feature ownership
- [DESIGN.md](./DESIGN.md) - EduPlay design system and UI rules
- [docs/prd/](./docs/prd/) - Available product requirements documents
- [public/games/README.md](./public/games/README.md) - Game integration guide
