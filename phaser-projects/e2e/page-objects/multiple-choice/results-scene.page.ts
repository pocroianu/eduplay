import { Page } from '@playwright/test';
import { waitForScene, waitForAnimation } from '../../utils/wait-utils';
import { BASIC_ANIMATION, CELEBRATION_ANIMATION } from '../../utils/timing-constants';
import { clickResultsButton } from '../../utils/canvas-utils';

/**
 * Page Object for the Results scene
 *
 * Encapsulates interactions with the end-game results screen including:
 * - Score display
 * - Star rating
 * - Play Again functionality
 */
export class ResultsScenePage {
  constructor(private page: Page) {}

  // ============================================
  // Navigation & Setup
  // ============================================

  /**
   * Wait for the Results scene to be active
   */
  async waitForReady(): Promise<void> {
    await waitForScene(this.page, 'Results');
    await waitForAnimation(this.page, BASIC_ANIMATION);
  }

  /**
   * Check if Results scene is currently active
   */
  async isActive(): Promise<boolean> {
    return this.page.evaluate(() => {
      const game = (window as any).__PHASER_GAME__;
      if (!game) return false;
      const scene = game.scene.getScene('Results');
      return scene && scene.scene.isActive();
    });
  }

  // ============================================
  // Score Information
  // ============================================

  /**
   * Get the displayed score as {correct, total}
   */
  async getDisplayedScore(): Promise<{ correct: number; total: number } | null> {
    return this.page.evaluate(() => {
      const game = (window as any).__PHASER_GAME__;
      if (!game) return null;

      const resultsScene = game.scene.getScene('Results');
      if (!resultsScene) return null;

      // Search through all text objects for score pattern
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
   * Get the score from GameManager
   */
  async getScore(): Promise<number> {
    return this.page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      return gm?.getScore() || 0;
    });
  }

  /**
   * Get the star rating (0-3)
   */
  async getStarRating(): Promise<number> {
    return this.page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      return gm?.getStarRating() || 0;
    });
  }

  /**
   * Get the number of filled stars displayed
   */
  async getDisplayedStars(): Promise<number> {
    return this.page.evaluate(() => {
      const game = (window as any).__PHASER_GAME__;
      if (!game) return 0;

      const resultsScene = game.scene.getScene('Results');
      if (!resultsScene || !resultsScene.stars) return 0;

      // Count visible filled stars
      return resultsScene.stars.filter(star => star.alpha > 0.5).length;
    });
  }

  // ============================================
  // Performance Message
  // ============================================

  /**
   * Get the performance message displayed
   */
  async getPerformanceMessage(): Promise<string> {
    return this.page.evaluate(() => {
      const game = (window as any).__PHASER_GAME__;
      if (!game) return '';

      const resultsScene = game.scene.getScene('Results');
      if (!resultsScene) return '';

      // Find the message text - typically contains emoji and encouragement
      for (const child of resultsScene.children.list) {
        if (child.type === 'Text') {
          const text = child.text;
          // Performance messages contain emoji indicators
          if (text?.match(/[^\x00-\x7F]/)) {
            // Has non-ASCII (likely emoji)
            if (!text.match(/^\d+\s*\/\s*\d+$/) && !text.match(/Score|Stars/i)) {
              return text;
            }
          }
        }
      }

      return '';
    });
  }

  // ============================================
  // Actions
  // ============================================

  /**
   * Click the "Play Again" button
   */
  async clickPlayAgain(): Promise<void> {
    try {
      await clickResultsButton(this.page, 'Play Again');
    } catch {
      // Fallback: try Romanian text
      await clickResultsButton(this.page, 'Joacă din nou');
    }

    // Wait for transition to Level scene
    await waitForScene(this.page, 'Level');
    await waitForAnimation(this.page);
  }

  /**
   * Wait for celebration animation to complete
   */
  async waitForCelebration(): Promise<void> {
    // Celebration includes confetti for good scores
    await waitForAnimation(this.page, CELEBRATION_ANIMATION);
  }

  // ============================================
  // Accessibility
  // ============================================

  /**
   * Check if game completion was announced
   */
  async wasCompletionAnnounced(): Promise<boolean> {
    const announcement = await this.page.textContent('#a11y-status-region');
    return announcement?.includes('Game complete') || announcement?.includes('complete') || false;
  }

  /**
   * Get the completion announcement text
   */
  async getCompletionAnnouncement(): Promise<string> {
    return (await this.page.textContent('#a11y-status-region')) || '';
  }

  // ============================================
  // Validation Helpers
  // ============================================

  /**
   * Verify perfect score (all correct)
   */
  async isPerfectScore(): Promise<boolean> {
    const score = await this.getDisplayedScore();
    return score !== null && score.correct === score.total;
  }

  /**
   * Verify 3-star rating
   */
  async has3Stars(): Promise<boolean> {
    const stars = await this.getStarRating();
    return stars === 3;
  }

  /**
   * Get underlying page object
   */
  get rawPage(): Page {
    return this.page;
  }
}
