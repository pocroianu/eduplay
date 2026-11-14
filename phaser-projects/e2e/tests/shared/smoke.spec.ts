import { test, expect } from '../../fixtures/phaser-page';
import { waitForScene, waitForAnimation } from '../../utils/wait-utils';
import { SCENE_READY_TIMEOUT, ERROR_HANDLING_DELAY } from '../../utils/timing-constants';
import { getGameState, getChoiceCardCount } from '../../utils/canvas-utils';
import { buildActivityLaunchUrl } from '../../utils/activity-url';

/**
 * Smoke Tests - All Games
 *
 * Quick sanity checks to ensure all game configurations load and function.
 * These tests should be fast and run on every commit.
 */

const ALL_GAMES = [
  { id: 'fruits-01', name: 'Fruits Quiz', expectedQuestions: 3 },
  { id: 'animals-01', name: 'Animals Quiz', expectedQuestions: 5 },
  { id: 'colors-01', name: 'Colors Quiz', expectedQuestions: 5 },
  { id: 'food-01', name: 'Food Quiz', expectedQuestions: 5 },
  { id: 'objects-01', name: 'Objects Quiz', expectedQuestions: 5 },
  { id: 'nature-01', name: 'Nature Quiz', expectedQuestions: 5 },
];

test.describe('Smoke Tests - Game Loading', () => {
  for (const game of ALL_GAMES) {
    test(`${game.name} (${game.id}) should load successfully`, async ({ phaserPage }) => {
      await phaserPage.gotoGame(game.id, 'en');
      await phaserPage.waitForLevelScene();

      // Verify game loaded
      const state = await phaserPage.getGameState();
      expect(state).not.toBeNull();
      expect(state?.totalQuestions).toBe(game.expectedQuestions);
      expect(state?.isComplete).toBe(false);
    });

    test(`${game.name} (${game.id}) should display choice cards`, async ({ phaserPage }) => {
      await phaserPage.gotoGame(game.id, 'en');
      await phaserPage.waitForLevelScene();

      const choiceCount = await getChoiceCardCount(phaserPage.rawPage);
      expect(choiceCount).toBeGreaterThanOrEqual(2);
      expect(choiceCount).toBeLessThanOrEqual(4);
    });

    test(`${game.name} (${game.id}) should complete with all correct answers`, async ({ phaserPage }) => {
      await phaserPage.gotoGame(game.id, 'en');
      await phaserPage.waitForLevelScene();

      // Play through entire game
      await phaserPage.completeGamePerfectly();

      // Verify results
      const state = await phaserPage.getGameState();
      expect(state?.isComplete).toBe(true);
      expect(state?.score).toBe(game.expectedQuestions);
    });
  }
});

test.describe('Smoke Tests - Scene Transitions', () => {
  test('should transition Boot -> Preload -> Level', async ({ phaserPage }) => {
    await phaserPage.rawPage.goto(buildActivityLaunchUrl({ templateId: 'multiple-choice', activityId: 'fruits-01' }));

    // Wait for game boot
    await phaserPage.waitForGameReady();

    // Should eventually reach Level scene
    await waitForScene(phaserPage.rawPage, 'Level', SCENE_READY_TIMEOUT);

    const state = await phaserPage.getGameState();
    expect(state).not.toBeNull();
  });

  test('should transition Level -> Results on game complete', async ({ phaserPage }) => {
    await phaserPage.gotoGame('fruits-01', 'en');
    await phaserPage.waitForLevelScene();

    await phaserPage.completeGamePerfectly();

    // Should be on Results scene
    await waitForScene(phaserPage.rawPage, 'Results');

    const isOnResults = await phaserPage.rawPage.evaluate(() => {
      const game = (window as any).__PHASER_GAME__;
      const resultsScene = game.scene.getScene('Results');
      return resultsScene && resultsScene.scene.isActive();
    });

    expect(isOnResults).toBe(true);
  });

  test('should transition Results -> Level on restart', async ({ phaserPage }) => {
    await phaserPage.gotoGame('fruits-01', 'en');
    await phaserPage.waitForLevelScene();

    await phaserPage.completeGamePerfectly();
    await phaserPage.waitForResultsScene();

    await phaserPage.clickPlayAgain();

    const state = await phaserPage.getGameState();
    expect(state?.questionIndex).toBe(0);
    expect(state?.score).toBe(0);
    expect(state?.isComplete).toBe(false);
  });
});

test.describe('Smoke Tests - Core Functionality', () => {
  test('should track score correctly', async ({ phaserPage }) => {
    await phaserPage.gotoGame('fruits-01', 'en');
    await phaserPage.waitForLevelScene();

    // Answer correctly
    await phaserPage.answerCorrectly();
    let state = await phaserPage.getGameState();
    expect(state?.score).toBe(1);

    // Answer incorrectly
    await phaserPage.answerIncorrectly();
    state = await phaserPage.getGameState();
    expect(state?.score).toBe(1); // Score unchanged

    // Answer correctly again
    await phaserPage.answerCorrectly();
    state = await phaserPage.getGameState();
    expect(state?.score).toBe(2);
  });

  test('should calculate star rating correctly', async ({ phaserPage }) => {
    await phaserPage.gotoGame('fruits-01', 'en');
    await phaserPage.waitForLevelScene();

    // Get all correct for 3 stars
    await phaserPage.completeGamePerfectly();

    const starRating = await phaserPage.getStarRating();
    expect(starRating).toBe(3);
  });

  test('should handle URL parameters correctly', async ({ phaserPage }) => {
    // Test with specific game and language
    await phaserPage.gotoGame('animals-01', 'ro');
    await phaserPage.waitForLevelScene();

    const state = await phaserPage.getGameState();
    expect(state).not.toBeNull();

    // Check language was applied
    const lang = await phaserPage.rawPage.evaluate(() => {
      return localStorage.getItem('edu-play-language');
    });
    expect(lang).toBe('ro');
  });
});

test.describe('Smoke Tests - Error Handling', () => {
  test('should show an Activity host error for an unknown Activity route', async ({ page }) => {
    await page.goto(buildActivityLaunchUrl({ templateId: 'multiple-choice', activityId: 'nonexistent-game-12345' }));

    await expect(page.locator('.host-message')).toContainText('Unknown activity: nonexistent-game-12345');
    await expect(page.locator('canvas')).toHaveCount(0);
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await page.route('**/api/v1/missing-config', route => route.abort());

    await page.goto(buildActivityLaunchUrl({
      templateId: 'multiple-choice',
      activityId: 'fruits-01',
      params: { configUrl: '/api/v1/missing-config' },
    }));

    // Wait for game to attempt loading and fail
    await page.waitForTimeout(ERROR_HANDLING_DELAY);

    // GameManager is always exposed globally, but config should NOT be loaded
    const configLoaded = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      // Config should be null if network requests were blocked
      return gm?.getConfig() !== null;
    });

    expect(configLoaded).toBe(false);
  });
});

test.describe('Smoke Tests - Browser Support', () => {
  test('should work with canvas rendering', async ({ phaserPage }) => {
    await phaserPage.gotoGame('fruits-01', 'en');
    await phaserPage.waitForLevelScene();

    // Verify canvas exists
    const canvas = phaserPage.rawPage.locator('canvas');
    await expect(canvas).toBeVisible();

    // Verify canvas has correct dimensions
    const bounds = await canvas.boundingBox();
    expect(bounds?.width).toBeGreaterThan(0);
    expect(bounds?.height).toBeGreaterThan(0);
  });

  test('should have correct viewport scaling', async ({ phaserPage }) => {
    await phaserPage.gotoGame('fruits-01', 'en');
    await phaserPage.waitForLevelScene();

    // Check Phaser scale settings
    const scaleInfo = await phaserPage.rawPage.evaluate(() => {
      const game = (window as any).__PHASER_GAME__;
      return {
        width: game.config.width,
        height: game.config.height,
        scaleMode: game.scale.scaleMode
      };
    });

    expect(scaleInfo.width).toBe(1280);
    expect(scaleInfo.height).toBe(720);
    // Phaser.Scale.WIDTH_CONTROLS_HEIGHT = 3
    expect(scaleInfo.scaleMode).toBe(3);
  });
});
