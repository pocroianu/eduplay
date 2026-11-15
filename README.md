# EduPlay

Personal workspace for the EduPlay platform and educational games.

| Directory | Responsibility | Main tools |
| --- | --- | --- |
| [edu-play-core](./edu-play-core/) | Accounts, classes, activities, assignments, portfolios, and iframe player | Next.js 16, React 19, TypeScript, Supabase |
| [phaser-projects](./phaser-projects/) | Game runtime, renderer plugins, activity editor, validation, and optional AI content tools | Phaser 4, TypeScript, Vite |

Each directory has its own npm workspaces, lockfile, and agent instructions.
There is no root npm install or build command. Keep the directories adjacent:
platform deployment scripts resolve the game workspace as `../phaser-projects`.

## Development

Use Node.js 24.12.0 and Docker Desktop for local Supabase. Install from the
lockfiles, especially after copying the workspace: npm workspace links from a
different checkout may still point at the old directory.

```powershell
cd edu-play-core
npm ci
npm run dev:full
```

In another terminal, to work on games:

```powershell
cd phaser-projects
npm ci
npm run start:activities
```

The platform runs on port 3000 and the game host on port 5173. See each
directory's README for details. AI generation services are optional and are
not required to start the platform or game host.

## Checks

```powershell
cd edu-play-core
npm run verify:agent
npm run build
```

```powershell
cd phaser-projects
npm run test:validation
npm run test:game-core
npm run build:all
```

Platform browser tests require local Supabase and currently run Chromium.
Several authenticated scenarios are still skipped; see the
[E2E notes](./edu-play-core/tests/e2e/README.md).

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
The production Docker path, database authorization findings, dependency
advisories, and missing privacy documentation still need release-readiness work.
This cleanup does not resolve those findings or establish production readiness.
