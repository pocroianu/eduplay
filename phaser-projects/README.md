# 🎮 edu-play Phaser Projects

A monorepo containing educational Phaser games for early learning.

## 🚀 Quick Start

### Prerequisites
- **Node.js v24.12.0** (or compatible)
- **npm 11.6.2** (or compatible)

### Run the Activity host
```bash
npm install
npm run start:activities
```

Open canonical Activity routes on the single game-core Vite host:

```text
http://localhost:5173/activities/fruits-01
http://localhost:5173/activities/phonics-ro-01?lang=ro
http://localhost:5173/templates/multiple-choice/
```

Renderers are package-less modules under `renderers/`. Legacy per-template webpack dev servers and template workspaces have been removed.

### Build and test
```bash
npm run build:all
npm run test:game-core
npm run test:e2e
```

## 🛠️ Tech Stack

- **Phaser 4** - Game framework
- **TypeScript** - Type safety
- **Vite** - single Activity host bundling

## 📝 License

MIT - See individual project LICENSE files.
