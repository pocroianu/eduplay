# 🎮 edu-play Phaser Projects

A monorepo containing educational Phaser games for early learning.

## 🚀 Quick Start

### Prerequisites
- **Node.js v24.12.0** (or compatible)
- **npm 11.6.2** (or compatible)

### Run the Activity host
```bash
# From the repository root
npm run setup:deps
npm run dev:games
```

Open canonical Activity routes on the single game-core Vite host:

```text
http://localhost:5173/activities/fruits-01
http://localhost:5173/activities/phonics-ro-01?lang=ro
http://localhost:5173/templates/multiple-choice/
```

Renderers are package-less modules under `renderers/`. Legacy per-template webpack dev servers and template workspaces have been removed.

Install and update dependencies from the repository root; there is one shared
lockfile. The commands below run from `phaser-projects/` after root dependency
setup. For the complete platform and seeded database, use root `npm run setup`
with Docker Desktop running.

### Build and test
```bash
npm run build:all
npm run lint
npm run test:game-core
npm run test:e2e
```

`npm run lint` runs lint scripts declared by workspaces. Currently only
`@edu-play/ai-content` has a lint configuration; renderer and shared runtime
lint coverage is still pending.

## 🛠️ Tech Stack

- **Phaser 4** - Game framework
- **TypeScript** - Type safety
- **Vite** - single Activity host bundling

## 📝 License

MIT - See individual project LICENSE files.
