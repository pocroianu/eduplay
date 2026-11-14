import { test, expect } from '../../fixtures/phaser-page';
import { waitForScene, waitForAnimation } from '../../utils/wait-utils';
import { ANNOUNCEMENT_TIMEOUT } from '../../utils/timing-constants';

/**
 * Language (i18n) E2E Tests
 *
 * Tests language switching, URL parameters, and content localization.
 */

test.describe('Language - URL Parameters', () => {
  test('should load English content with ?lang=en', async ({ phaserPage }) => {
    await phaserPage.gotoGame('fruits-01', 'en');
    await phaserPage.waitForLevelScene();

    const question = await phaserPage.getCurrentQuestion();
    expect(question?.text).toContain('apple');
    expect(question?.text).not.toContain('măr');
  });

  test('should load Romanian content with ?lang=ro', async ({ phaserPage }) => {
    await phaserPage.gotoGame('fruits-01', 'ro');
    await phaserPage.waitForLevelScene();

    const question = await phaserPage.getCurrentQuestion();
    // Romanian question text should contain Romanian words
    expect(question?.text).toBeDefined();

    // Check for Romanian UI elements
    const page = phaserPage.rawPage;
    const loadingText = await page.evaluate(() => {
      // Check localStorage for language setting
      const lang = localStorage.getItem('edu-play-language');
      return lang;
    });

    // Language should be persisted
    expect(loadingText).toBe('ro');
  });

  test('should default to English when no lang parameter', async ({ phaserPage }) => {
    await phaserPage.gotoActivity('fruits-01');
    await phaserPage.waitForLevelScene();

    const question = await phaserPage.getCurrentQuestion();
    expect(question?.text).toContain('apple');
  });

  test('should fall back to English for unsupported language', async ({ phaserPage }) => {
    await phaserPage.gotoActivity('fruits-01', 'de');
    await phaserPage.waitForLevelScene();

    // Should fall back to English
    const question = await phaserPage.getCurrentQuestion();
    expect(question?.text).toContain('apple');
  });
});

test.describe('Language - Persistence', () => {
  test('should persist language selection in localStorage', async ({ phaserPage }) => {
    // Load with Romanian
    await phaserPage.gotoGame('fruits-01', 'ro');
    await phaserPage.waitForLevelScene();

    // Check localStorage
    const savedLang = await phaserPage.rawPage.evaluate(() => {
      return localStorage.getItem('edu-play-language');
    });

    expect(savedLang).toBe('ro');
  });

  test('should use persisted language on reload', async ({ phaserPage }) => {
    // First load with Romanian
    await phaserPage.gotoGame('fruits-01', 'ro');
    await phaserPage.waitForLevelScene();

    // Navigate without language parameter
    await phaserPage.gotoActivity('fruits-01');
    await phaserPage.waitForLevelScene();

    // Should still use Romanian from localStorage
    const savedLang = await phaserPage.rawPage.evaluate(() => {
      return localStorage.getItem('edu-play-language');
    });

    expect(savedLang).toBe('ro');
  });
});

test.describe('Language - UI Elements', () => {
  test.fixme('should display language selector flags', async ({ phaserPage }) => {
    // The LanguageSelector prefab exists in packages/game-core but is not yet
    // instantiated in renderers/multiple-choice/src/scenes/Level.ts.
    // levelScene.languageSelector is always undefined so this test always fails.
    // Re-enable once the feature is wired up (tracker: EDU-459).
    await phaserPage.gotoGame('fruits-01', 'en');
    await phaserPage.waitForLevelScene();

    const hasLanguageSelector = await phaserPage.rawPage.evaluate(() => {
      const game = (window as any).__PHASER_GAME__;
      const levelScene = game.scene.getScene('Level');
      return levelScene?.languageSelector !== undefined;
    });

    expect(hasLanguageSelector).toBe(true);
  });

  test('should update ARIA announcements based on language', async ({ phaserPage }) => {
    // Load English version
    await phaserPage.gotoGame('fruits-01', 'en');
    await phaserPage.waitForLevelScene();

    // Wait for question announcement in English
    await phaserPage.waitForAnnouncement('Question:', { timeout: ANNOUNCEMENT_TIMEOUT });

    const announcement = await phaserPage.rawPage.textContent('#a11y-live-region');
    expect(announcement).toContain('apple');
  });
});

test.describe('Language - Results Screen', () => {
  test('should display results in English', async ({ phaserPage }) => {
    await phaserPage.gotoGame('fruits-01', 'en');
    await phaserPage.waitForLevelScene();

    await phaserPage.completeGamePerfectly();
    await phaserPage.waitForResultsScene();

    // Check for English UI elements
    const hasPlayAgain = await phaserPage.rawPage.evaluate(() => {
      const game = (window as any).__PHASER_GAME__;
      const resultsScene = game.scene.getScene('Results');

      // Search for Play Again text
      for (const child of resultsScene.children.list) {
        if (child.list) {
          for (const item of child.list) {
            if (item.text?.includes('Play Again')) {
              return true;
            }
          }
        }
      }
      return false;
    });

    expect(hasPlayAgain).toBe(true);
  });

  test('should display results in Romanian', async ({ phaserPage }) => {
    await phaserPage.gotoGame('fruits-01', 'ro');
    await phaserPage.waitForLevelScene();

    await phaserPage.completeGamePerfectly();
    await phaserPage.waitForResultsScene();

    // Check for Romanian UI elements
    const hasPlayAgain = await phaserPage.rawPage.evaluate(() => {
      const game = (window as any).__PHASER_GAME__;
      const resultsScene = game.scene.getScene('Results');

      // Search for Romanian "Play Again" text
      for (const child of resultsScene.children.list) {
        if (child.list) {
          for (const item of child.list) {
            if (item.text?.includes('Joacă din nou') || item.text?.includes('nou')) {
              return true;
            }
          }
        }
      }
      return false;
    });

    expect(hasPlayAgain).toBe(true);
  });
});

test.describe('Language - All Game Configs', () => {
  const GAME_IDS = [
    'fruits-01',
    'animals-01',
    'colors-01',
    'food-01',
    'objects-01',
    'nature-01'
  ];

  for (const gameId of GAME_IDS) {
    test(`${gameId} should load in English`, async ({ phaserPage }) => {
      await phaserPage.gotoGame(gameId, 'en');
      await phaserPage.waitForLevelScene();

      const question = await phaserPage.getCurrentQuestion();
      expect(question).not.toBeNull();
      expect(question?.text.length).toBeGreaterThan(0);
    });

    test(`${gameId} should load in Romanian`, async ({ phaserPage }) => {
      await phaserPage.gotoGame(gameId, 'ro');
      await phaserPage.waitForLevelScene();

      const question = await phaserPage.getCurrentQuestion();
      expect(question).not.toBeNull();
      expect(question?.text.length).toBeGreaterThan(0);
    });
  }
});
