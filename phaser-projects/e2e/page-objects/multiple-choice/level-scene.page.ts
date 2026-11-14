import { Page, expect } from '@playwright/test';
import { waitForScene, waitForAnimation, waitForSceneReady } from '../../utils/wait-utils';
import { FEEDBACK_ANIMATION } from '../../utils/timing-constants';
import {
  clickChoiceCard,
  getCorrectChoiceIndex,
  getIncorrectChoiceIndices,
  getChoiceCardCount,
  getChoiceCardState,
  getCurrentQuestion,
  getGameState,
  hoverChoiceCard,
  isFocusIndicatorVisible,
  getFocusedChoiceIndex
} from '../../utils/canvas-utils';
import { buildActivityLaunchUrl } from '../../utils/activity-url';

/**
 * Page Object for the Level (gameplay) scene
 *
 * Encapsulates all interactions with the main game scene including:
 * - Question display
 * - Choice card interactions
 * - Keyboard navigation
 * - Progress tracking
 */
export class LevelScenePage {
  constructor(private page: Page) {}

  // ============================================
  // Navigation & Setup
  // ============================================

  /**
   * Navigate to the Level scene with specific activity and language.
   */
  async goto(activityId: string, lang = 'en'): Promise<void> {
    await this.page.goto(buildActivityLaunchUrl({ templateId: 'multiple-choice', activityId, lang }));
    await this.waitForReady();
  }

  /**
   * Wait for the Level scene to be fully loaded and ready
   */
  async waitForReady(): Promise<void> {
    await waitForSceneReady(this.page, 'Level');
    await waitForAnimation(this.page);
  }

  /**
   * Check if Level scene is currently active
   */
  async isActive(): Promise<boolean> {
    return this.page.evaluate(() => {
      const game = (window as any).__PHASER_GAME__;
      if (!game) return false;
      const scene = game.scene.getScene('Level');
      return scene && scene.scene.isActive();
    });
  }

  // ============================================
  // Question Information
  // ============================================

  /**
   * Get the current question text
   */
  async getQuestionText(): Promise<string> {
    const question = await getCurrentQuestion(this.page);
    return question?.text || '';
  }

  /**
   * Get the number of choices for the current question
   */
  async getChoiceCount(): Promise<number> {
    return getChoiceCardCount(this.page);
  }

  /**
   * Get the current question ID
   */
  async getQuestionId(): Promise<string> {
    const question = await getCurrentQuestion(this.page);
    return question?.id || '';
  }

  // ============================================
  // Choice Card Interactions
  // ============================================

  /**
   * Click on a choice card by index
   */
  async selectChoice(index: number): Promise<void> {
    await clickChoiceCard(this.page, index);
  }

  /**
   * Select the correct answer
   */
  async selectCorrectAnswer(): Promise<void> {
    const correctIndex = await getCorrectChoiceIndex(this.page);
    if (correctIndex < 0) {
      throw new Error('No correct choice found');
    }
    await clickChoiceCard(this.page, correctIndex);
  }

  /**
   * Select an incorrect answer (first wrong choice)
   */
  async selectIncorrectAnswer(): Promise<void> {
    const incorrectIndices = await getIncorrectChoiceIndices(this.page);
    if (incorrectIndices.length === 0) {
      throw new Error('No incorrect choices found');
    }
    await clickChoiceCard(this.page, incorrectIndices[0]);
  }

  /**
   * Hover over a choice card
   */
  async hoverChoice(index: number): Promise<void> {
    await hoverChoiceCard(this.page, index);
  }

  /**
   * Get the state of a choice card
   */
  async getChoiceState(index: number): Promise<string | null> {
    return getChoiceCardState(this.page, index);
  }

  /**
   * Wait for feedback animation to complete
   */
  async waitForFeedback(): Promise<void> {
    await waitForAnimation(this.page, FEEDBACK_ANIMATION);
  }

  // ============================================
  // Keyboard Navigation
  // ============================================

  /**
   * Navigate to next choice with keyboard
   */
  async navigateNext(): Promise<void> {
    await this.page.keyboard.press('ArrowRight');
  }

  /**
   * Navigate to previous choice with keyboard
   */
  async navigatePrevious(): Promise<void> {
    await this.page.keyboard.press('ArrowLeft');
  }

  /**
   * Navigate down (same as next for horizontal layout)
   */
  async navigateDown(): Promise<void> {
    await this.page.keyboard.press('ArrowDown');
  }

  /**
   * Navigate up (same as previous for horizontal layout)
   */
  async navigateUp(): Promise<void> {
    await this.page.keyboard.press('ArrowUp');
  }

  /**
   * Jump to first choice
   */
  async navigateToFirst(): Promise<void> {
    await this.page.keyboard.press('Home');
  }

  /**
   * Jump to last choice
   */
  async navigateToLast(): Promise<void> {
    await this.page.keyboard.press('End');
  }

  /**
   * Select focused choice with keyboard
   */
  async selectWithKeyboard(): Promise<void> {
    await this.page.keyboard.press('Enter');
  }

  /**
   * Select focused choice with space bar
   */
  async selectWithSpace(): Promise<void> {
    await this.page.keyboard.press(' ');
  }

  /**
   * Clear focus with Escape
   */
  async clearFocus(): Promise<void> {
    await this.page.keyboard.press('Escape');
  }

  /**
   * Check if focus indicator is visible
   */
  async isFocusVisible(): Promise<boolean> {
    return isFocusIndicatorVisible(this.page);
  }

  /**
   * Get the index of the currently focused choice
   */
  async getFocusedIndex(): Promise<number> {
    return getFocusedChoiceIndex(this.page);
  }

  // ============================================
  // Game State
  // ============================================

  /**
   * Get the current score
   */
  async getScore(): Promise<number> {
    const state = await getGameState(this.page);
    return state?.score || 0;
  }

  /**
   * Get the current question index (0-based)
   */
  async getQuestionIndex(): Promise<number> {
    const state = await getGameState(this.page);
    return state?.questionIndex || 0;
  }

  /**
   * Get the total number of questions
   */
  async getTotalQuestions(): Promise<number> {
    const state = await getGameState(this.page);
    return state?.totalQuestions || 0;
  }

  /**
   * Check if the game is complete
   */
  async isGameComplete(): Promise<boolean> {
    const state = await getGameState(this.page);
    return state?.isComplete || false;
  }

  /**
   * Get the current star rating
   */
  async getStarRating(): Promise<number> {
    const state = await getGameState(this.page);
    return state?.starRating || 0;
  }

  /**
   * Get full game state
   */
  async getFullState() {
    return getGameState(this.page);
  }

  // ============================================
  // Accessibility
  // ============================================

  /**
   * Get the content of the ARIA live region
   */
  async getAnnouncement(): Promise<string> {
    const region = await this.page.$('#a11y-live-region');
    return (await region?.textContent()) || '';
  }

  /**
   * Get the content of the ARIA status region (urgent)
   */
  async getUrgentAnnouncement(): Promise<string> {
    const region = await this.page.$('#a11y-status-region');
    return (await region?.textContent()) || '';
  }

  /**
   * Wait for announcement containing specific text
   */
  async waitForAnnouncement(text: string, timeout = 5000): Promise<void> {
    await this.page.waitForFunction(
      (expected) => {
        const region = document.getElementById('a11y-live-region');
        return region?.textContent?.includes(expected) || false;
      },
      text,
      { timeout }
    );
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Answer current question correctly and wait for next
   */
  async answerCorrectlyAndProceed(): Promise<void> {
    await this.selectCorrectAnswer();
    await this.waitForFeedback();
  }

  /**
   * Answer current question incorrectly and wait for next
   */
  async answerIncorrectlyAndProceed(): Promise<void> {
    await this.selectIncorrectAnswer();
    await this.waitForFeedback();
  }

  /**
   * Complete entire game with all correct answers
   */
  async playPerfectGame(): Promise<void> {
    const total = await this.getTotalQuestions();

    for (let i = 0; i < total; i++) {
      await waitForAnimation(this.page);
      await this.answerCorrectlyAndProceed();
    }
  }

  /**
   * Get underlying page object
   */
  get rawPage(): Page {
    return this.page;
  }
}
