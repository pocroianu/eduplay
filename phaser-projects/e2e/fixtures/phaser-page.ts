import { test as base, Page, expect } from '@playwright/test';
import { waitForScene, waitForSceneReady, waitForAnimation, waitForChoiceCards } from '../utils/wait-utils';
import { setupAudioMocks, wrapAudioManager } from '../utils/audio-mock';
import {
  GAME_BOOT_TIMEOUT,
  CARD_ENTRANCE_ANIMATION,
  RESULTS_SCENE_TIMEOUT,
  SCENE_TRANSITION_DURATION,
  BASIC_ANIMATION,
  KEY_PRESS_DELAY,
  ANNOUNCEMENT_SETTLE
} from '../utils/timing-constants';
import {
  clickChoiceCard,
  getCorrectChoiceIndex,
  getGameState,
  getCurrentQuestion
} from '../utils/canvas-utils';
import { LevelScenePage } from '../page-objects/multiple-choice/level-scene.page';
import { ResultsScenePage } from '../page-objects/multiple-choice/results-scene.page';
import { buildActivityLaunchUrl, E2ETemplateId } from '../utils/activity-url';

/**
 * Extended Page fixture for Phaser game testing
 *
 * Usage:
 *   import { test, expect } from '../fixtures/phaser-page';
 *
 *   test('my test', async ({ phaserPage }) => {
 *     await phaserPage.gotoGame('fruits-01');
 *     await phaserPage.answerCorrectly();
 *   });
 */

export interface PhaserPageOptions {
  gameId?: string;
  lang?: string;
  mockAudio?: boolean;
}

export class PhaserPage {
  private _levelPage: LevelScenePage | null = null;
  private _resultsPage: ResultsScenePage | null = null;

  constructor(private page: Page) {}

  /**
   * Access Level scene specific methods
   * Lazily instantiated when first accessed
   */
  get level(): LevelScenePage {
    if (!this._levelPage) {
      this._levelPage = new LevelScenePage(this.page);
    }
    return this._levelPage;
  }

  /**
   * Access Results scene specific methods
   * Lazily instantiated when first accessed
   */
  get results(): ResultsScenePage {
    if (!this._resultsPage) {
      this._resultsPage = new ResultsScenePage(this.page);
    }
    return this._resultsPage;
  }

  /**
   * Navigate to an activity through the canonical single-host /activities route.
   */
  async gotoActivity(activityId: string, lang?: string, templateId: E2ETemplateId = 'multiple-choice'): Promise<void> {
    await this.page.goto(buildActivityLaunchUrl({ templateId, activityId, lang }));
    await this.waitForGameReady();
  }

  /**
   * Back-compatible helper name for multiple-choice specs.
   */
  async gotoGame(gameId: string, lang?: string): Promise<void> {
    await this.gotoActivity(gameId, lang, 'multiple-choice');
  }

  /**
   * Wait for the Phaser game to be fully loaded and ready
   */
  async waitForGameReady(): Promise<void> {
    // Wait for game to boot
    await this.page.waitForFunction(
      () => (window as any).__PHASER_GAME__?.isBooted,
      { timeout: GAME_BOOT_TIMEOUT }
    );

    // Wrap AudioManager for more reliable sound tracking
    await wrapAudioManager(this.page);
  }

  /**
   * Wait for the Level scene to be active and ready
   */
  async waitForLevelScene(): Promise<void> {
    await waitForSceneReady(this.page, 'Level');
    // Wait for choice cards to appear (they animate in with staggered delays)
    await waitForChoiceCards(this.page);
    // Wait until all cards have finished their entrance animation (scale reaches full size).
    // Polling card.scaleX is reliable in headless Docker; checking tween count is not because
    // the breathe tween starts immediately after entrance and keeps the count above 0 forever.
    // CI bump: ChoiceCard.animateIn() has a setTimeout fallback at delay+500 ms, so cards
    // reach scaleX=1 within ~1.1 s wall-clock even in Docker. The 15 s ceiling is a safety
    // net for unusually slow Jenkins agents.
    const entranceTimeout = CARD_ENTRANCE_ANIMATION + (process.env.CI ? 15000 : 2000);
    await this.page.waitForFunction(
      () => {
        const game = (window as any).__PHASER_GAME__;
        if (!game) return false;
        const levelScene = game.scene.getScene('Level');
        if (!levelScene?.choiceCards?.length) return false;
        return levelScene.choiceCards.every((c: any) => c.scaleX >= 0.95);
      },
      { timeout: entranceTimeout }
    );
  }

  /**
   * Wait for the Results scene to be active
   */
  async waitForResultsScene(): Promise<void> {
    // Wait longer for Results scene as it involves game completion
    await waitForScene(this.page, 'Results', RESULTS_SCENE_TIMEOUT);

    // Brief settle for Results scene to fully render. A plain timeout avoids the breathe-tween
    // false-positive that makes waitForAnimation always hit its 5s fallback.
    await this.page.waitForTimeout(SCENE_TRANSITION_DURATION);
  }

  /**
   * Answer the current question correctly
   */
  async answerCorrectly(): Promise<void> {
    // Wait for cards to be fully animated in and interactive.
    // waitForNotProcessing() checks both isProcessingAnswer and card.scaleX, so no
    // separate tween-count wait is needed (breathe tweens would block it indefinitely).
    await waitForChoiceCards(this.page);

    // Wait for scene to not be processing a previous answer
    await this.waitForNotProcessing();

    // Capture current question index before answering
    const stateBefore = await getGameState(this.page);
    const indexBefore = stateBefore?.questionIndex ?? 0;

    const correctIndex = await getCorrectChoiceIndex(this.page);

    if (correctIndex < 0) {
      throw new Error('Could not find correct choice');
    }

    await clickChoiceCard(this.page, correctIndex);

    // Wait for question to advance or game to complete (polls actual state)
    await this.waitForQuestionAdvancement(indexBefore);
  }

  /**
   * Answer the current question incorrectly
   */
  async answerIncorrectly(): Promise<void> {
    // Same rationale as answerCorrectly — skip tween count, rely on waitForNotProcessing.
    await waitForChoiceCards(this.page);

    // Wait for scene to not be processing a previous answer
    await this.waitForNotProcessing();

    // Capture current question index before answering
    const stateBefore = await getGameState(this.page);
    const indexBefore = stateBefore?.questionIndex ?? 0;

    const correctIndex = await getCorrectChoiceIndex(this.page);
    const wrongIndex = correctIndex === 0 ? 1 : 0;

    await clickChoiceCard(this.page, wrongIndex);

    // Wait for question to advance or game to complete (polls actual state)
    await this.waitForQuestionAdvancement(indexBefore);
  }

  /**
   * Wait for the Level scene to not be processing a previous answer
   * and for cards to be in an interactive state.
   * This prevents clicking a new card before the previous answer's
   * feedback and transition cycle has fully completed.
   *
   * The CI bump is for the Jenkins eduplay-ci Docker agent (3.8 GB / 2 CPUs):
   * Phaser scene boot + card entrance animations run measurably slower than on
   * a developer laptop, and the previous 10 s budget triggered timeouts on
   * Jenkins build #11 even after PRs #34/#35/#36 fixed the local-pass baseline.
   */
  private async waitForNotProcessing(): Promise<void> {
    const timeout = process.env.CI ? 25000 : 10000;
    await this.page.waitForFunction(
      () => {
        const game = (window as any).__PHASER_GAME__;
        if (!game) return true;
        const levelScene = game.scene.getScene('Level');
        if (!levelScene) return true;
        // Check both the processing flag and that cards exist and are at full scale
        if (levelScene.isProcessingAnswer) return false;
        if (!levelScene.choiceCards || levelScene.choiceCards.length === 0) return false;
        // All cards must be at full scale before interaction (avoids race on partially-animated cards)
        return levelScene.choiceCards.every((card: any) => card.scaleX >= 0.95);
      },
      { timeout }
    );
  }

  /**
   * Wait for the question index to advance beyond the given index,
   * or for the game to complete. This replaces fixed animation waits
   * with polling for actual state change.
   *
   * Same CI rationale as waitForNotProcessing: the SELECTED → onChoiceSelected
   * → feedback animation → next-question chain runs slower under the Jenkins
   * Docker agent. The 15 s budget was tight on a fast laptop; not enough on
   * the constrained CI VM. EDU-404 build #11 timed out at this exact wait
   * for accessibility / audio / game-flow specs that answer questions; specs
   * that don't answer (DOM-only) passed.
   *
   * EDU-464: bumped from 30 s to 60 s. The setTimeout fallbacks in
   * FeedbackOverlay / ChoiceCard / Level are the primary fix (resolution now
   * happens in ~3 s real time). The 60 s ceiling is a safety net in case any
   * Phaser-timer path we did not patch is still slow in Docker.
   */
  private async waitForQuestionAdvancement(previousIndex: number): Promise<void> {
    const timeout = process.env.CI ? 60000 : 15000;
    await this.page.waitForFunction(
      (prevIdx) => {
        const gm = (window as any).__GAME_MANAGER__;
        if (!gm) return false;
        // Either the question advanced or the game completed
        return gm.getCurrentQuestionIndex() > prevIdx || gm.isGameComplete();
      },
      previousIndex,
      { timeout }
    );
    // Brief settle time for UI updates after state change
    await this.page.waitForTimeout(200);
  }

  /**
   * Complete the entire game with all correct answers
   */
  async completeGamePerfectly(): Promise<void> {
    const state = await getGameState(this.page);
    if (!state) {
      throw new Error('Could not get game state');
    }

    for (let i = 0; i < state.totalQuestions; i++) {
      await this.answerCorrectly(); // Already waits for feedback internally

      // Check if game is complete after this answer
      const currentState = await getGameState(this.page);
      if (currentState?.isComplete) {
        // Game just completed, wait a bit longer for transition to start
        await this.page.waitForTimeout(SCENE_TRANSITION_DURATION);
        break;
      }
    }

    // Wait for Results scene transition with longer timeout
    await this.waitForResultsScene();
  }

  /**
   * Get the current game state
   */
  async getGameState() {
    return getGameState(this.page);
  }

  /**
   * Get the current question
   */
  async getCurrentQuestion() {
    return getCurrentQuestion(this.page);
  }

  /**
   * Navigate choices using keyboard
   */
  async navigateWithKeyboard(direction: 'left' | 'right' | 'up' | 'down'): Promise<void> {
    const keyMap = {
      left: 'ArrowLeft',
      right: 'ArrowRight',
      up: 'ArrowUp',
      down: 'ArrowDown'
    };
    await this.page.keyboard.press(keyMap[direction]);
  }

  /**
   * Select the currently focused choice with keyboard
   */
  async selectWithKeyboard(): Promise<void> {
    // Capture current question index before selecting
    const stateBefore = await getGameState(this.page);
    const indexBefore = stateBefore?.questionIndex ?? 0;

    // Small delay before pressing key
    await this.page.waitForTimeout(KEY_PRESS_DELAY);

    await this.page.keyboard.press('Enter');

    // Wait for question to advance or game to complete (polls actual state)
    await this.waitForQuestionAdvancement(indexBefore);
  }

  /**
   * Click the "Play Again" button on Results screen
   */
  async clickPlayAgain(): Promise<void> {
    // Wait for results scene to be fully ready
    await waitForAnimation(this.page, BASIC_ANIMATION);

    // Click the play again button (it's a Phaser game object, not DOM)
    await this.page.evaluate(() => {
      const game = (window as any).__PHASER_GAME__;
      const gm = (window as any).__GAME_MANAGER__;

      if (game && gm) {
        // Reset game state and restart Level scene
        gm.resetState();
        game.scene.getScene('Results')?.scene.start('Level');
      }
    });

    // Wait for transition back to Level scene
    await this.waitForLevelScene();
  }

  /**
   * Get the displayed score from Results scene
   */
  async getDisplayedScore(): Promise<{ correct: number; total: number } | null> {
    return this.page.evaluate(() => {
      const game = (window as any).__PHASER_GAME__;
      if (!game) return null;

      const resultsScene = game.scene.getScene('Results');
      if (!resultsScene) return null;

      // Find the score text object
      for (const child of resultsScene.children.list) {
        if (child.type === 'Text') {
          const match = child.text?.match(/(\d+)\s*\/\s*(\d+)/);
          if (match) {
            return {
              correct: parseInt(match[1], 10),
              total: parseInt(match[2], 10)
            };
          }
        }
      }

      return null;
    });
  }

  /**
   * Get the star rating from Results scene
   */
  async getStarRating(): Promise<number> {
    return this.page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      return gm?.getStarRating() || 0;
    });
  }

  /**
   * Check if ARIA announcement contains expected text
   */
  async checkAnnouncement(expectedText: string, urgent = false): Promise<boolean> {
    const regionId = urgent ? 'a11y-status-region' : 'a11y-live-region';
    const content = await this.page.textContent(`#${regionId}`);
    return content?.includes(expectedText) || false;
  }

  /**
   * Wait for ARIA announcement
   */
  async waitForAnnouncement(
    textMatch: string | RegExp,
    options: { urgent?: boolean; timeout?: number } = {}
  ): Promise<void> {
    const { urgent = false, timeout = 10000 } = options;
    const regionId = urgent ? 'a11y-status-region' : 'a11y-live-region';

    // Give announcements time to populate (they trigger after game state changes)
    await this.page.waitForTimeout(ANNOUNCEMENT_SETTLE);

    await this.page.waitForFunction(
      ({ text, id, isRegex }) => {
        const region = document.getElementById(id);
        if (!region || !region.textContent) return false;

        if (isRegex) {
          return new RegExp(text).test(region.textContent);
        }
        return region.textContent.includes(text);
      },
      {
        text: textMatch instanceof RegExp ? textMatch.source : textMatch,
        id: regionId,
        isRegex: textMatch instanceof RegExp
      },
      { timeout }
    );
  }

  /**
   * Get the underlying Playwright Page object
   */
  get rawPage(): Page {
    return this.page;
  }
}

/**
 * Extended test fixture with PhaserPage
 */
export const test = base.extend<{ phaserPage: PhaserPage }>({
  phaserPage: async ({ page }, use) => {
    // Set up audio mocks before any navigation
    await setupAudioMocks(page);

    // Create PhaserPage wrapper
    const phaserPage = new PhaserPage(page);

    // Use the fixture
    await use(phaserPage);
  },
});

export { expect };
