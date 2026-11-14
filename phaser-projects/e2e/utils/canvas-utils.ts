import { Page } from '@playwright/test';

/**
 * Canvas Utilities for Phaser Game Testing
 *
 * Since Phaser renders to Canvas, we cannot use DOM selectors.
 * These utilities help interact with game objects through coordinates
 * and the exposed game state.
 */

export interface GameObjectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface ScreenCoordinates {
  screenX: number;
  screenY: number;
}

/**
 * Get the canvas element's bounding box
 */
export async function getCanvasBounds(page: Page): Promise<DOMRect | null> {
  const canvas = await page.locator('canvas').boundingBox();
  return canvas;
}

/**
 * Convert Phaser game coordinates to screen coordinates
 */
export async function gameToScreenCoords(
  page: Page,
  gameX: number,
  gameY: number
): Promise<ScreenCoordinates> {
  const coords = await page.evaluate(({ x, y }) => {
    const game = (window as any).__PHASER_GAME__;
    if (!game) return null;

    const canvas = game.canvas;
    const rect = canvas.getBoundingClientRect();

    const scaleX = rect.width / game.config.width;
    const scaleY = rect.height / game.config.height;

    return {
      screenX: rect.left + x * scaleX,
      screenY: rect.top + y * scaleY
    };
  }, { x: gameX, y: gameY });

  if (!coords) {
    throw new Error('Could not convert coordinates - game not available');
  }

  return coords;
}

/**
 * Get the bounds of a choice card in screen coordinates
 */
export async function getChoiceCardBounds(
  page: Page,
  choiceIndex: number
): Promise<GameObjectBounds | null> {
  return page.evaluate((index) => {
    const game = (window as any).__PHASER_GAME__;
    if (!game) return null;

    const levelScene = game.scene.getScene('Level');
    if (!levelScene || !levelScene.choiceCards) return null;

    const card = levelScene.choiceCards[index];
    if (!card) return null;

    const canvas = game.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / game.config.width;
    const scaleY = rect.height / game.config.height;

    // Get card position and size
    const cardWidth = card.width || 200;
    const cardHeight = card.height || 200;

    return {
      x: (card.x - cardWidth / 2) * scaleX,
      y: (card.y - cardHeight / 2) * scaleY,
      width: cardWidth * scaleX,
      height: cardHeight * scaleY,
      centerX: card.x * scaleX,
      centerY: card.y * scaleY
    };
  }, choiceIndex);
}

/**
 * Click on a choice card by index.
 *
 * Uses selectViaKeyboard() via page.evaluate() rather than CDP mouse events so
 * that the selection works reliably across all environments (local Windows and
 * headless Docker Linux).  selectViaKeyboard() plays the 'click' SFX and emits
 * the SELECTED event synchronously — the same outcome as a real pointer click —
 * keeping all audio and game-flow assertions intact.
 */
export async function clickChoiceCard(page: Page, choiceIndex: number): Promise<void> {
  const success = await page.evaluate((index) => {
    const game = (window as any).__PHASER_GAME__;
    if (!game) return false;

    const levelScene = game.scene.getScene('Level');
    if (!levelScene || !levelScene.choiceCards) return false;

    const card = levelScene.choiceCards[index];
    if (!card) return false;

    const state = card.getState();
    if (state === 'disabled' || state === 'correct' || state === 'incorrect') return false;

    // selectViaKeyboard plays the 'click' SFX and emits SELECTED synchronously,
    // triggering the full onChoiceSelected → feedback → proceedToNext chain.
    card.selectViaKeyboard();
    return true;
  }, choiceIndex);

  if (!success) {
    throw new Error(`Could not click choice card ${choiceIndex}`);
  }
}

/**
 * Get the index of the correct choice for the current question
 */
export async function getCorrectChoiceIndex(page: Page): Promise<number> {
  return page.evaluate(() => {
    const game = (window as any).__PHASER_GAME__;
    if (!game) return -1;

    const levelScene = game.scene.getScene('Level');
    if (!levelScene || !levelScene.choiceCards) return -1;

    const index = levelScene.choiceCards.findIndex(card => card.isCorrect());
    return index;
  });
}

/**
 * Get an array of all incorrect choice indices
 */
export async function getIncorrectChoiceIndices(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const game = (window as any).__PHASER_GAME__;
    if (!game) return [];

    const levelScene = game.scene.getScene('Level');
    if (!levelScene || !levelScene.choiceCards) return [];

    return levelScene.choiceCards
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => !card.isCorrect())
      .map(({ index }) => index);
  });
}

/**
 * Get the number of choice cards displayed
 */
export async function getChoiceCardCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const game = (window as any).__PHASER_GAME__;
    if (!game) return 0;

    const levelScene = game.scene.getScene('Level');
    if (!levelScene || !levelScene.choiceCards) return 0;

    return levelScene.choiceCards.length;
  });
}

/**
 * Get the state of a specific choice card
 */
export async function getChoiceCardState(
  page: Page,
  choiceIndex: number
): Promise<string | null> {
  return page.evaluate((index) => {
    const game = (window as any).__PHASER_GAME__;
    if (!game) return null;

    const levelScene = game.scene.getScene('Level');
    if (!levelScene || !levelScene.choiceCards) return null;

    const card = levelScene.choiceCards[index];
    if (!card) return null;

    return card.getState();
  }, choiceIndex);
}

/**
 * Click on a button in the Results scene
 */
export async function clickResultsButton(page: Page, buttonText: string): Promise<void> {
  // Results scene uses interactive containers, we need to find the button position
  const buttonCoords = await page.evaluate((text) => {
    const game = (window as any).__PHASER_GAME__;
    if (!game) return null;

    const resultsScene = game.scene.getScene('Results');
    if (!resultsScene) return null;

    // Search for the button container - it should have the text
    const children = resultsScene.children.list;

    for (const child of children) {
      if (child.type === 'Container' && child.input?.enabled) {
        // Check if this container has text matching our button
        for (const item of child.list || []) {
          if (item.type === 'Text' && item.text?.includes(text)) {
            const canvas = game.canvas;
            const rect = canvas.getBoundingClientRect();
            const scaleX = rect.width / game.config.width;
            const scaleY = rect.height / game.config.height;

            return {
              x: child.x * scaleX,
              y: child.y * scaleY
            };
          }
        }
      }
    }

    return null;
  }, buttonText);

  if (!buttonCoords) {
    // Fallback: try clicking the text directly via Playwright
    await page.click(`text=${buttonText}`);
    return;
  }

  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) {
    throw new Error('Canvas not found');
  }

  await page.mouse.click(
    canvas.x + buttonCoords.x,
    canvas.y + buttonCoords.y
  );
}

/**
 * Hover over a choice card
 */
export async function hoverChoiceCard(page: Page, choiceIndex: number): Promise<void> {
  const bounds = await getChoiceCardBounds(page, choiceIndex);
  if (!bounds) {
    throw new Error(`Choice card ${choiceIndex} not found`);
  }

  const canvas = await page.locator('canvas').boundingBox();
  if (!canvas) {
    throw new Error('Canvas not found');
  }

  await page.mouse.move(
    canvas.x + bounds.centerX,
    canvas.y + bounds.centerY
  );
}

/**
 * Get the current game state
 */
export async function getGameState(page: Page): Promise<{
  score: number;
  questionIndex: number;
  totalQuestions: number;
  isComplete: boolean;
  starRating: number;
} | null> {
  return page.evaluate(() => {
    const gm = (window as any).__GAME_MANAGER__;
    if (!gm) return null;

    return {
      score: gm.getScore(),
      questionIndex: gm.getCurrentQuestionIndex(),
      totalQuestions: gm.getTotalQuestions(),
      isComplete: gm.isGameComplete(),
      starRating: gm.getStarRating()
    };
  });
}

/**
 * Get the current question data
 */
export async function getCurrentQuestion(page: Page): Promise<{
  id: string;
  text: string;
  choiceCount: number;
} | null> {
  return page.evaluate(() => {
    const gm = (window as any).__GAME_MANAGER__;
    if (!gm) return null;

    const question = gm.getCurrentQuestion();
    if (!question) return null;

    return {
      id: question.id,
      text: question.question.text,
      choiceCount: question.choices.length
    };
  });
}

/**
 * Check if focus indicator is visible (for accessibility testing)
 */
export async function isFocusIndicatorVisible(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const a11y = (window as any).__A11Y_MANAGER__;
    if (!a11y) return false;

    return a11y.currentFocusIndex >= 0;
  });
}

/**
 * Get the currently focused choice index
 */
export async function getFocusedChoiceIndex(page: Page): Promise<number> {
  return page.evaluate(() => {
    const a11y = (window as any).__A11Y_MANAGER__;
    if (!a11y) return -1;

    return a11y.currentFocusIndex;
  });
}
