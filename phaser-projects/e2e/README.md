# E2E Testing for Phaser Educational Games

This directory contains end-to-end tests for the edu-play Phaser games using [Playwright](https://playwright.dev/).

## Quick Start

```bash
# Install dependencies (from root directory)
npm install

# Install Playwright browsers
npx playwright install

# Run all tests
npm run test:e2e

# Run tests with UI mode (interactive)
npm run test:e2e:ui

# Run tests in headed mode (visible browser)
npm run test:e2e:headed

# Run only Chromium tests
npm run test:e2e:chromium

# View test report
npm run test:e2e:report
```

## Directory Structure

```
e2e/
├── playwright.config.ts       # Playwright configuration
├── fixtures/                  # Test fixtures and extended page classes
│   └── phaser-page.ts         # Extended Page with Phaser helpers
├── page-objects/              # Page Object Model classes
│   └── multiple-choice/
│       ├── level-scene.page.ts    # Level scene interactions
│       └── results-scene.page.ts  # Results scene interactions
├── tests/                     # Test specifications
│   ├── multiple-choice/       # Tests for multiple-choice game
│   │   ├── game-flow.spec.ts      # Complete game flow tests
│   │   ├── accessibility.spec.ts  # Keyboard nav, screen reader tests
│   │   ├── audio.spec.ts          # Sound effects and mute tests
│   │   └── language.spec.ts       # i18n tests
│   ├── matching-game/         # Matching-game coverage
│   │   └── gameplay.spec.ts       # Matching-game gameplay checks
│   └── shared/                # Cross-game tests
│       └── smoke.spec.ts          # Quick sanity checks
└── utils/                     # Utility functions
    ├── wait-utils.ts          # Async waiting helpers
    ├── timing-constants.ts    # Shared E2E timing values
    ├── canvas-utils.ts        # Canvas interaction helpers
    └── audio-mock.ts          # Audio API mocking
```

## Writing Tests

### Using the PhaserPage Fixture

The `phaserPage` fixture provides helper methods for common game interactions:

```typescript
import { test, expect } from '../../fixtures/phaser-page';

test('should complete game', async ({ phaserPage }) => {
  await phaserPage.gotoGame('fruits-01', 'en');
  await phaserPage.waitForLevelScene();

  // Answer correctly
  await phaserPage.answerCorrectly();

  // Check score
  const state = await phaserPage.getGameState();
  expect(state?.score).toBe(1);
});
```

### Using Page Objects

For more complex scenarios, use the Page Object classes:

```typescript
import { test, expect } from '@playwright/test';
import { LevelScenePage } from '../../page-objects/multiple-choice/level-scene.page';

test('keyboard navigation', async ({ page }) => {
  const levelPage = new LevelScenePage(page);

  await levelPage.goto('fruits-01');
  await levelPage.navigateNext();

  expect(await levelPage.isFocusVisible()).toBe(true);
});
```

### Working with Canvas

Since Phaser renders to Canvas, we cannot use DOM selectors for game objects. Use the canvas utilities:

```typescript
import { clickChoiceCard, getCorrectChoiceIndex } from '../../utils/canvas-utils';

// Click a specific choice by index
await clickChoiceCard(page, 1);

// Find and click the correct answer
const correctIndex = await getCorrectChoiceIndex(page);
await clickChoiceCard(page, correctIndex);
```

### Waiting for Async Operations

Phaser games are asynchronous. Use the wait utilities:

```typescript
import { waitForScene, waitForAnimation } from '../../utils/wait-utils';

// Wait for scene to be active
await waitForScene(page, 'Level');

// Wait for animations to complete
await waitForAnimation(page, 1000);
```

### Testing Audio

Audio is mocked in tests. Verify sound effects using:

```typescript
import { wasSoundPlayed, waitForSound } from '../../utils/audio-mock';

// Check if a sound was played
expect(await wasSoundPlayed(page, 'correct')).toBe(true);

// Wait for a specific sound
await waitForSound(page, 'click', 3000);
```

## Test Categories

### Smoke Tests
Quick sanity checks that verify all games load and function. Run these on every commit:
```bash
npm run test:e2e -- --grep="Smoke"
```

### Functional Tests
Core feature validation including gameplay, scoring, and transitions.

### Accessibility Tests
WCAG 2.1 compliance including keyboard navigation and screen reader support.

### Visual Regression Tests (future)
Screenshot comparison for detecting visual regressions.

## Configuration

### Browser Matrix

Tests currently run Chromium only, split by Playwright projects defined in `e2e/playwright.config.ts`. Renderer projects group their own specs, and the `activity-host` project covers centralized host routes.

Run a specific project:
```bash
npm run test:e2e -- --project=listen-tap
```

`npm run test:e2e:chromium` remains as an explicit Chromium-only alias for the full E2E suite.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CI` | Set to `true` in CI environment | - |

### Web Server

Tests automatically start or reuse the single game-core Activity host on port 5173. Legacy project names are kept to group specs, but all projects navigate through canonical Activity URLs on the same Vite host.

Local and CI runs use:
```bash
npm run start:activities
```

Primary E2E navigation uses `/activities/:activityId`, for example:
```text
/activities/phonics-ro-01?lang=ro
```

Production-dist smoke coverage builds the Activity host and serves `packages/game-core/dist/activity-host` through Vite preview:

```bash
npm run test:e2e:activity-dist
```

There is no special repo-level "skip server startup" wrapper documented in this batch; the previous README implied one existed.

## Activity-host renderer interaction drivers

The cross-renderer Activity-host interaction spec stays in `e2e/tests/activity-host/activity-interaction.spec.ts` and runs every renderer through the single `@edu-play/game-core` Activity host. Keep renderer-specific scripted interaction details beside the renderer in `renderers/<renderer-id>/e2e-driver.cjs`; do not add per-renderer Playwright servers, ports, webpack config, or workspace packages.

Each renderer with a `renderer.json` must provide a CommonJS driver with these exports:

| Export | Required | Meaning |
|--------|----------|---------|
| `sceneKey` | Yes | Phaser scene key the host waits for before running renderer-specific checks. |
| `lang` | No | Activity route language query value when the default sample requires one. |
| `activityId` | No | Activity to open instead of `renderer.json` `defaultGameId`. |
| `waitUntilReady(page)` | Yes | Playwright hook that waits until the scene has enough runtime state for one safe scripted interaction. |
| `completeOneInteraction(page)` | Yes | Playwright hook that performs one renderer-local progress smoke path and causes progress or score to increase. |

Minimal driver:

```js
// renderers/my-renderer/e2e-driver.cjs
module.exports = {
  sceneKey: 'MyLevelScene',

  async waitUntilReady(page) {
    await page.waitForFunction(() => {
      const scene = window.__PHASER_GAME__?.scene?.getScene('MyLevelScene');
      return !!scene?.currentPrompt;
    }, { timeout: 20000 });
  },

  async completeOneInteraction(page) {
    await page.evaluate(() => {
      const scene = window.__PHASER_GAME__.scene.getScene('MyLevelScene');
      scene.answerCorrectly();
    });
  },
};
```

Validate this coverage with:

```bash
npm run test:e2e:activity-interaction
```

## Debugging

### Interactive Mode
```bash
npm run test:e2e:ui
```

### Debug Mode
```bash
npm run test:e2e:debug
```

### View Trace
After test failure, view the trace:
```bash
npx playwright show-trace e2e/test-results/path-to-trace.zip
```

### Screenshots and Videos
Failed tests automatically capture screenshots and videos in `e2e/test-results/`.

## CI/CD Integration

Tests run automatically on:
- Push to `main` branch
- Pull requests targeting `main`

See `.github/workflows/ci-cd.yml` for the current workflow entrypoint.

### Artifacts

CI produces these artifacts:
- `playwright-results-{browser}` - Full test report
- `failure-screenshots-{browser}` - Screenshots from failed tests

## Troubleshooting

### Tests failing with "Game not found"
Ensure the game exposes testing hooks. Check that `__PHASER_GAME__` is set in development mode.

### Canvas coordinates are wrong
Ensure the game's scale mode is `Phaser.Scale.FIT`. The coordinate mapping assumes this.

### Flaky tests
1. Add more specific waits using `waitForScene` or `waitForAnimation`
2. Increase timeouts if animations are slow
3. Use retry logic for external dependencies

### Audio tests failing
Audio is mocked - ensure `setupAudioMocks` is called before navigation. The `phaserPage` fixture does this automatically.

## Adding Tests for New Games

1. Create a new directory under `e2e/tests/{game-name}/`
2. Add to the smoke test array in `smoke.spec.ts`
3. Create game-specific test files as needed
4. Optionally add Page Objects under `e2e/page-objects/{game-name}/`

## Best Practices

1. **Use fixtures** - The `phaserPage` fixture handles common setup
2. **Wait properly** - Always use wait utilities, avoid `page.waitForTimeout()`
3. **Isolate tests** - Each test should be independent
4. **Clean state** - Tests start with fresh browser context
5. **Descriptive names** - Test names should explain what is being verified
6. **Avoid selectors** - Use coordinate-based clicking for canvas
7. **Mock external** - Mock audio, network requests where appropriate
