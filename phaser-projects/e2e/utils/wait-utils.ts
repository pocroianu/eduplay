import { Page } from '@playwright/test';
import {
  GAME_BOOT_TIMEOUT,
  DEFAULT_WAIT_TIMEOUT,
  SCENE_READY_TIMEOUT,
  SHORT_ANIMATION,
  TWEEN_COMPLETION_TIMEOUT,
  TWEEN_COMPLETION_TIMEOUT_LONG,
  CHOICE_CARDS_TIMEOUT,
  LOADING_COMPLETE_TIMEOUT,
  FEEDBACK_OVERLAY_TIMEOUT,
  ANNOUNCEMENT_TIMEOUT
} from './timing-constants';

/**
 * Wait Utilities for Phaser Game Testing
 *
 * These utilities handle the async nature of Phaser games including:
 * - Scene transitions
 * - Asset loading
 * - Animation completion
 */

/**
 * Wait for the Phaser game to be fully booted
 */
export async function waitForGameBoot(page: Page, timeout = GAME_BOOT_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    () => {
      const game = (window as any).__PHASER_GAME__;
      return game && game.isBooted;
    },
    { timeout }
  );
}

/**
 * Wait for a specific scene to become active
 */
export async function waitForScene(page: Page, sceneName: string, timeout = DEFAULT_WAIT_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (name) => {
      const game = (window as any).__PHASER_GAME__;
      if (!game) return false;
      const scene = game.scene.getScene(name);
      return scene && scene.scene.isActive();
    },
    sceneName,
    { timeout }
  );
}

/**
 * Wait for a scene to be fully ready (loaded and not processing)
 */
export async function waitForSceneReady(page: Page, sceneName: string, timeout = SCENE_READY_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (name) => {
      const game = (window as any).__PHASER_GAME__;
      if (!game) return false;
      const scene = game.scene.getScene(name);
      if (!scene || !scene.scene.isActive()) return false;

      // Check if scene has isLoading property (Level scene)
      if (scene.isLoading !== undefined) {
        return !scene.isLoading;
      }

      return true;
    },
    sceneName,
    { timeout }
  );
}

/**
 * Wait for animations to complete by checking for active tweens
 * Falls back to a timeout if tweens take too long
 */
export async function waitForAnimation(page: Page, fallbackMs = SHORT_ANIMATION): Promise<void> {
  const tweensCompleted = await page.waitForFunction(
    () => {
      const game = (window as any).__PHASER_GAME__;
      if (!game) return true;

      const activeScenes = game.scene.getScenes(true);
      for (const scene of activeScenes) {
        // Check that tweens manager exists and has getAllTweens method
        if (scene.tweens && typeof scene.tweens.getAllTweens === 'function') {
          try {
            if (scene.tweens.getAllTweens().length > 0) {
              return false;
            }
          } catch {
            // If getAllTweens fails, skip this scene
            continue;
          }
        }
      }
      return true;
    },
    { timeout: TWEEN_COMPLETION_TIMEOUT }
  ).then(() => true).catch(() => false);

  // If tweens didn't complete naturally, wait the fallback time
  if (!tweensCompleted) {
    await page.waitForTimeout(fallbackMs);
  }
}

/**
 * Wait for all active tweens to complete across all scenes
 */
export async function waitForAllTweens(page: Page, timeout = TWEEN_COMPLETION_TIMEOUT_LONG): Promise<void> {
  await page.waitForFunction(
    () => {
      const game = (window as any).__PHASER_GAME__;
      if (!game) return true;

      let totalTweens = 0;
      const activeScenes = game.scene.getScenes(true);

      for (const scene of activeScenes) {
        // Check that tweens manager exists and has getAllTweens method
        if (scene.tweens && typeof scene.tweens.getAllTweens === 'function') {
          try {
            totalTweens += scene.tweens.getAllTweens().length;
          } catch {
            // If getAllTweens fails, skip this scene
            continue;
          }
        }
      }

      return totalTweens === 0;
    },
    { timeout }
  );
}

/**
 * Wait for choice cards to appear in the Level scene
 */
export async function waitForChoiceCards(page: Page, expectedCount?: number, timeout = CHOICE_CARDS_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (count) => {
      const game = (window as any).__PHASER_GAME__;
      if (!game) return false;

      const levelScene = game.scene.getScene('Level');
      if (!levelScene || !levelScene.choiceCards) return false;

      const cards = levelScene.choiceCards;
      if (count !== undefined) {
        return cards.length === count;
      }

      return cards.length > 0;
    },
    expectedCount,
    { timeout }
  );
}

/**
 * Wait for the loading state to complete in Level scene
 */
export async function waitForLoadingComplete(page: Page, timeout = LOADING_COMPLETE_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    () => {
      const game = (window as any).__PHASER_GAME__;
      if (!game) return false;

      const levelScene = game.scene.getScene('Level');
      if (!levelScene) return false;

      // Check both isLoading and loadingText existence
      return !levelScene.isLoading && !levelScene.loadingText;
    },
    { timeout }
  );
}

/**
 * Wait for feedback overlay to appear
 */
export async function waitForFeedbackOverlay(page: Page, type: 'correct' | 'incorrect', timeout = FEEDBACK_OVERLAY_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (expectedType) => {
      const game = (window as any).__PHASER_GAME__;
      if (!game) return false;

      const levelScene = game.scene.getScene('Level');
      if (!levelScene || !levelScene.feedbackOverlay) return false;

      // Check if overlay is visible
      return levelScene.feedbackOverlay.visible === true;
    },
    type,
    { timeout }
  );
}

/**
 * Wait for ARIA live region to contain specific text
 */
export async function waitForAnnouncement(
  page: Page,
  textMatch: string | RegExp,
  regionId = 'a11y-live-region',
  timeout = ANNOUNCEMENT_TIMEOUT
): Promise<string> {
  const content = await page.waitForFunction(
    ({ text, id, isRegex }) => {
      const region = document.getElementById(id);
      if (!region || !region.textContent) return null;

      if (isRegex) {
        const regex = new RegExp(text);
        if (regex.test(region.textContent)) {
          return region.textContent;
        }
      } else {
        if (region.textContent.includes(text)) {
          return region.textContent;
        }
      }

      return null;
    },
    {
      text: textMatch instanceof RegExp ? textMatch.source : textMatch,
      id: regionId,
      isRegex: textMatch instanceof RegExp
    },
    { timeout }
  );

  return content.jsonValue();
}

/**
 * Fast-forward all active animations by completing them immediately
 */
export async function fastForwardAnimations(page: Page): Promise<void> {
  await page.evaluate(() => {
    const game = (window as any).__PHASER_GAME__;
    if (!game) return;

    const activeScenes = game.scene.getScenes(true);
    for (const scene of activeScenes) {
      // Check that tweens manager exists and has getAllTweens method
      if (scene.tweens && typeof scene.tweens.getAllTweens === 'function') {
        try {
          const tweens = scene.tweens.getAllTweens();
          tweens.forEach((tween: any) => {
            tween.complete();
          });
        } catch {
          // If getAllTweens fails, skip this scene
          continue;
        }
      }
    }
  });
}
