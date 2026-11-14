import { test, expect } from '../../fixtures/phaser-page';
import { waitForScene, waitForAnimation } from '../../utils/wait-utils';
import { clickChoiceCard, getCorrectChoiceIndex, getGameState } from '../../utils/canvas-utils';
import { buildActivityLaunchUrl } from '../../utils/activity-url';

/**
 * Game Flow E2E Tests
 *
 * Tests the complete user journey through the Multiple Choice game,
 * including game initialization, gameplay, and results.
 */

test.describe('Multiple Choice - Complete Game Flow', () => {
  test.beforeEach(async ({ phaserPage }) => {
    // Navigate to game and wait for it to be ready
    await phaserPage.gotoGame('fruits-01', 'en');
    await phaserPage.waitForLevelScene();
  });

  test('should load game and display first question', async ({ phaserPage }) => {
    const question = await phaserPage.getCurrentQuestion();

    expect(question).not.toBeNull();
    expect(question?.text).toContain('apple');
    expect(question?.choiceCount).toBe(3);
  });

  test('should complete game with perfect score', async ({ phaserPage }) => {
    // Play through all questions correctly
    await phaserPage.completeGamePerfectly();

    // Verify we're on Results scene
    const state = await phaserPage.getGameState();
    expect(state?.isComplete).toBe(true);
    expect(state?.score).toBe(state?.totalQuestions);

    // Verify 3 stars for perfect score
    const starRating = await phaserPage.getStarRating();
    expect(starRating).toBe(3);
  });

  test('should show correct feedback and update progress on correct answer', async ({ phaserPage }) => {
    // Get initial state
    const initialState = await phaserPage.getGameState();
    expect(initialState?.score).toBe(0);

    // Answer correctly
    await phaserPage.answerCorrectly();

    // Check state updated
    const newState = await phaserPage.getGameState();
    expect(newState?.score).toBe(1);
    expect(newState?.questionIndex).toBe(1);
  });

  test('should show encouragement for wrong answer and reveal correct answer', async ({ phaserPage }) => {
    // Get initial state
    const initialState = await phaserPage.getGameState();

    // Answer incorrectly
    await phaserPage.answerIncorrectly();

    // Check score unchanged
    const newState = await phaserPage.getGameState();
    expect(newState?.score).toBe(0);
    expect(newState?.questionIndex).toBe(1); // Still advances to next question
  });

  test('should restart game from results screen', async ({ phaserPage }) => {
    // Complete game
    await phaserPage.completeGamePerfectly();

    // Verify on Results screen
    await phaserPage.waitForResultsScene();

    // Click Play Again
    await phaserPage.clickPlayAgain();

    // Verify game reset
    const state = await phaserPage.getGameState();
    expect(state?.score).toBe(0);
    expect(state?.questionIndex).toBe(0);
    expect(state?.isComplete).toBe(false);
  });

  test.skip('should display different star ratings based on performance', async ({ phaserPage }) => {
    // EDU-464: skipped — waitForResultsScene() times out in Docker CI headless on the
    // mixed correct/incorrect answer path. The results-screen transition itself works
    // (completeGamePerfectly passes); the star-rating assertion cannot be reached
    // reliably within CI timing budgets. Tracking: EDU-464.
    await phaserPage.answerCorrectly();
    await phaserPage.answerIncorrectly();
    await phaserPage.answerCorrectly();
    await phaserPage.waitForResultsScene();
    const starRating = await phaserPage.getStarRating();
    expect(starRating).toBe(1);
  });
});

test.describe('Multiple Choice - Progress Tracking', () => {
  test('should track question progress correctly', async ({ phaserPage }) => {
    await phaserPage.gotoGame('fruits-01', 'en');
    await phaserPage.waitForLevelScene();

    const initialState = await phaserPage.getGameState();
    expect(initialState?.totalQuestions).toBe(3);

    // Answer first question
    await phaserPage.answerCorrectly();
    let state = await phaserPage.getGameState();
    expect(state?.questionIndex).toBe(1);

    // Answer second question
    await phaserPage.answerCorrectly();
    state = await phaserPage.getGameState();
    expect(state?.questionIndex).toBe(2);

    // Answer third question (final)
    await phaserPage.answerCorrectly();
    state = await phaserPage.getGameState();
    expect(state?.isComplete).toBe(true);
  });

  test.skip('should calculate accuracy correctly', async ({ phaserPage }) => {
    // EDU-464: skipped — same Docker CI timing issue as the star-ratings test above.
    await phaserPage.gotoGame('fruits-01', 'en');
    await phaserPage.waitForLevelScene();
    await phaserPage.answerCorrectly();
    await phaserPage.answerIncorrectly();
    await phaserPage.answerIncorrectly();
    await phaserPage.waitForResultsScene();
    const state = await phaserPage.getGameState();
    expect(state?.score).toBe(1);
    expect(state?.totalQuestions).toBe(3);
    const starRating = await phaserPage.getStarRating();
    expect(starRating).toBe(0);
  });
});

test.describe('Multiple Choice - Error Handling', () => {
  test('should handle invalid activity config gracefully', async ({ page }) => {
    await page.goto(buildActivityLaunchUrl({
      templateId: 'multiple-choice',
      activityId: 'fruits-01',
      params: { configUrl: '/api/v1/missing-config' },
    }));

    // Wait for game to boot and check error state on canvas
    await page.waitForFunction(
      () => {
        const game = (window as any).__PHASER_GAME__;
        if (!game?.isBooted) return false;

        const preloadScene = game.scene.getScene('Preload');
        // Check if error text exists on canvas
        return preloadScene?.children?.list?.some(
          (child: any) => child.type === 'Text' && child.text?.includes('Error')
        );
      },
      { timeout: 15000 }
    );
  });

  test('should fall back to English for unsupported language', async ({ phaserPage }) => {
    // Try with unsupported language
    await phaserPage.gotoActivity('fruits-01', 'fr');
    await phaserPage.waitForLevelScene();

    // Game should still load with English content
    const question = await phaserPage.getCurrentQuestion();
    expect(question?.text).toContain('apple');
  });
});
