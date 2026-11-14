import { test, expect, Page } from '@playwright/test';
import { buildActivityLaunchUrl } from '../../utils/activity-url';

type CountingRuntimeState = {
  score: number;
  totalSteps: number;
  completedSteps: number;
  maxScore: number;
  scorePercent: number;
  isComplete: boolean;
  activeSceneKeys: string[];
  readoutTexts: string[];
};

type ResultsSceneUiState = {
  activeSceneKeys: string[];
  visibleTexts: string[];
};

type ScreenCoordinates = {
  screenX: number;
  screenY: number;
};

const FARM_COUNT_ROUND_NUMERALS = ['2', '4', '1', '5', '3'] as const;
const FIRST_ROUND_CORRECT_NUMERAL = FARM_COUNT_ROUND_NUMERALS[0];
const FIRST_ROUND_INCORRECT_NUMERAL = '1';
const ROMANIAN_INCORRECT_FEEDBACK = [
  'Aproape!',
  'Mai încearcă!',
  'Poți să reușești!',
  'Bună încercare!',
  'Încearcă din nou!',
];

async function launchRomanianFarmCountActivity(page: Page): Promise<void> {
  await page.goto(buildActivityLaunchUrl({ templateId: 'counting-game', activityId: 'farm-count-01', lang: 'ro' }));
  await waitForCountingLevel(page);
}

async function waitForCountingLevel(page: Page): Promise<void> {
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 });
  await page.waitForFunction(
    () => {
      const game = (window as any).__PHASER_GAME__;
      const gm = (window as any).__GAME_MANAGER__;
      const activeSceneKeys = game?.scene?.getScenes(true).map((scene: any) => scene.scene.key) ?? [];
      return activeSceneKeys.includes('CountingLevel')
        && gm?.getConfig?.()
        && gm?.getTotalSteps?.() > 0;
    },
    { timeout: 15000 }
  );
}

async function getCountingRuntimeState(page: Page): Promise<CountingRuntimeState> {
  return page.evaluate(() => {
    const gm = (window as any).__GAME_MANAGER__;
    const game = (window as any).__PHASER_GAME__;
    const level = game?.scene?.getScene('CountingLevel');
    const activeSceneKeys = game?.scene?.getScenes(true).map((scene: any) => scene.scene.key) ?? [];
    const readoutTexts = (level?.children?.list ?? [])
      .filter((child: any) => child?.type === 'Text')
      .map((child: any) => child.text);

    return {
      score: gm?.getScore?.() ?? -1,
      totalSteps: gm?.getTotalSteps?.() ?? -1,
      completedSteps: gm?.getCompletedSteps?.() ?? -1,
      maxScore: gm?.getMaxScore?.() ?? -1,
      scorePercent: gm?.getScorePercent?.() ?? -1,
      isComplete: gm?.isGameComplete?.() ?? false,
      activeSceneKeys,
      readoutTexts,
    };
  });
}

async function getResultsSceneUiState(page: Page): Promise<ResultsSceneUiState> {
  return page.evaluate(() => {
    const game = (window as any).__PHASER_GAME__;
    const results = game?.scene?.getScene('Results');
    const activeSceneKeys = game?.scene?.getScenes(true).map((scene: any) => scene.scene.key) ?? [];
    const visibleTexts: string[] = [];

    const collectVisibleTexts = (node: any, parentVisible = true) => {
      if (!node || !parentVisible) return;

      const isVisible = node.visible !== false && (node.alpha ?? 1) > 0;
      if (node.type === 'Text' && isVisible) {
        visibleTexts.push(String(node.text ?? ''));
      }

      for (const child of node.list ?? []) {
        collectVisibleTexts(child, isVisible);
      }
    };

    for (const child of results?.children?.list ?? []) {
      collectVisibleTexts(child);
    }

    return {
      activeSceneKeys,
      visibleTexts,
    };
  });
}

async function getVisibleNumeralCoords(page: Page, numeral: string): Promise<ScreenCoordinates | null> {
  return page.evaluate((targetNumeral) => {
    const game = (window as any).__PHASER_GAME__;
    const level = game?.scene?.getScene('CountingLevel');
    const canvas = game?.canvas as HTMLCanvasElement | undefined;
    if (!game || !level || !canvas) return null;

    const labels: any[] = [];
    const collectTextLabels = (node: any) => {
      if (!node || node.visible === false) return;
      const text = String(node.text ?? '');
      if (node.type === 'Text' && text === targetNumeral) {
        labels.push(node);
      }
      for (const child of node.list ?? []) collectTextLabels(child);
    };
    for (const child of level.children?.list ?? []) collectTextLabels(child);

    const gameWidth = Number(game.config.width) || level.scale.width;
    const gameHeight = Number(game.config.height) || level.scale.height;
    const target = labels
      .map((label) => {
        const matrix = label.getWorldTransformMatrix?.();
        return {
          button: label.parentContainer,
          gameX: matrix?.tx,
          gameY: matrix?.ty,
        };
      })
      .find(({ button, gameY }) => button?.input?.enabled && button.scaleX > 0.95 && gameY > gameHeight * 0.6);

    if (!target) return null;

    const rect = canvas.getBoundingClientRect();
    return {
      screenX: rect.left + target.gameX * (rect.width / gameWidth),
      screenY: rect.top + target.gameY * (rect.height / gameHeight),
    };
  }, numeral);
}

async function clickVisibleNumeral(page: Page, numeral: string): Promise<void> {
  await expect
    .poll(() => getVisibleNumeralCoords(page, numeral), { timeout: 5000 })
    .not.toBeNull();

  const coords = await getVisibleNumeralCoords(page, numeral);
  if (!coords) {
    throw new Error(`Could not locate visible numeral button ${numeral}`);
  }

  await page.mouse.click(coords.screenX, coords.screenY);
}

async function clickFirstRoundNumeral(page: Page, answer: 'correct' | 'incorrect'): Promise<void> {
  if (answer === 'correct') {
    await clickVisibleNumeral(page, FIRST_ROUND_CORRECT_NUMERAL);
    return;
  }

  await clickVisibleNumeral(page, FIRST_ROUND_INCORRECT_NUMERAL);
}

async function clickCorrectFirstRoundNumeral(page: Page): Promise<void> {
  await clickFirstRoundNumeral(page, 'correct');
}

async function clickIncorrectFirstRoundNumeral(page: Page): Promise<void> {
  await clickFirstRoundNumeral(page, 'incorrect');
  await waitForRomanianIncorrectFeedback(page);
}

async function completeFarmCountPerfectly(page: Page): Promise<void> {
  for (let index = 0; index < FARM_COUNT_ROUND_NUMERALS.length; index += 1) {
    await clickVisibleNumeral(page, FARM_COUNT_ROUND_NUMERALS[index]);

    const nextRoundNumeral = FARM_COUNT_ROUND_NUMERALS[index + 1];
    if (nextRoundNumeral) {
      await waitForRoundAdvance(page, (index + 1) * 10, nextRoundNumeral);
    }
  }
}

async function waitForRomanianIncorrectFeedback(page: Page): Promise<void> {
  await page.waitForFunction(
    (messages) => {
      const game = (window as any).__PHASER_GAME__;
      const level = game?.scene?.getScene('CountingLevel');
      return (level?.children?.list ?? []).some(
        (child: any) => child?.type === 'Text' && messages.includes(child.text)
      );
    },
    ROMANIAN_INCORRECT_FEEDBACK,
    { timeout: 5000 }
  );
}

async function waitForRoundAdvance(page: Page, expectedScore: number, nextRoundNumeral: string): Promise<void> {
  await page.waitForFunction(
    (score) => (window as any).__GAME_MANAGER__?.getScore?.() === score,
    expectedScore,
    { timeout: 10000 }
  );
  await page.waitForFunction(
    (readout) => {
      const game = (window as any).__PHASER_GAME__;
      const level = game?.scene?.getScene('CountingLevel');
      return (level?.children?.list ?? []).some((child: any) => child?.type === 'Text' && child.text === readout);
    },
    `0 / ${nextRoundNumeral}`,
    { timeout: 10000 }
  );
}

async function waitForFirstRoundAdvance(page: Page): Promise<void> {
  await waitForRoundAdvance(page, 10, '4');
}

async function waitForCountingGameCompletion(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = (window as any).__PHASER_GAME__;
      const activeSceneKeys = game?.scene?.getScenes(true).map((scene: any) => scene.scene.key) ?? [];
      return gm?.getScore?.() === 50
        && gm?.getTotalSteps?.() === 5
        && gm?.getCompletedSteps?.() === 5
        && gm?.getMaxScore?.() === 50
        && gm?.getScorePercent?.() === 100
        && gm?.isGameComplete?.() === true
        && activeSceneKeys.includes('Results');
    },
    { timeout: 15000 }
  );
}

test.describe('Counting Game — farm-count-01 first interaction', () => {
  test('choosing the correct first-round numeral adds points and advances to the next prompt', async ({ page }) => {
    await launchRomanianFarmCountActivity(page);

    const initialState = await getCountingRuntimeState(page);
    expect(initialState.score).toBe(0);
    expect(initialState.totalSteps).toBe(5);
    expect(initialState.completedSteps).toBe(0);
    expect(initialState.maxScore).toBe(50);
    expect(initialState.scorePercent).toBe(0);
    expect(initialState.isComplete).toBe(false);
    expect(initialState.activeSceneKeys).toContain('CountingLevel');
    expect(initialState.readoutTexts).toContain('0 / 2');

    await clickCorrectFirstRoundNumeral(page);
    await waitForFirstRoundAdvance(page);

    const afterFirstAnswer = await getCountingRuntimeState(page);
    expect(afterFirstAnswer.score).toBe(10);
    expect(afterFirstAnswer.totalSteps).toBe(5);
    expect(afterFirstAnswer.completedSteps).toBe(1);
    expect(afterFirstAnswer.maxScore).toBe(50);
    expect(afterFirstAnswer.scorePercent).toBe(20);
    expect(afterFirstAnswer.isComplete).toBe(false);
    expect(afterFirstAnswer.activeSceneKeys).toContain('CountingLevel');
    expect(afterFirstAnswer.readoutTexts).toContain('0 / 4');
  });

  test('choosing an incorrect first-round numeral keeps the prompt retryable', async ({ page }) => {
    await launchRomanianFarmCountActivity(page);

    const initialState = await getCountingRuntimeState(page);
    expect(initialState.score).toBe(0);
    expect(initialState.isComplete).toBe(false);
    expect(initialState.readoutTexts).toContain('0 / 2');

    await clickIncorrectFirstRoundNumeral(page);

    const afterIncorrectAnswer = await getCountingRuntimeState(page);
    expect(afterIncorrectAnswer.score).toBe(0);
    expect(afterIncorrectAnswer.totalSteps).toBe(5);
    expect(afterIncorrectAnswer.completedSteps).toBe(0);
    expect(afterIncorrectAnswer.maxScore).toBe(50);
    expect(afterIncorrectAnswer.scorePercent).toBe(0);
    expect(afterIncorrectAnswer.isComplete).toBe(false);
    expect(afterIncorrectAnswer.activeSceneKeys).toContain('CountingLevel');
    expect(afterIncorrectAnswer.readoutTexts).toContain('0 / 2');
  });

  test('recovers from an incorrect first-round numeral when the correct numeral is chosen next', async ({ page }) => {
    await launchRomanianFarmCountActivity(page);

    await clickIncorrectFirstRoundNumeral(page);

    const afterIncorrectAnswer = await getCountingRuntimeState(page);
    expect(afterIncorrectAnswer.score).toBe(0);
    expect(afterIncorrectAnswer.isComplete).toBe(false);
    expect(afterIncorrectAnswer.activeSceneKeys).toContain('CountingLevel');
    expect(afterIncorrectAnswer.readoutTexts).toContain('0 / 2');

    await clickCorrectFirstRoundNumeral(page);
    await waitForFirstRoundAdvance(page);

    const afterRecovery = await getCountingRuntimeState(page);
    expect(afterRecovery.score).toBe(10);
    expect(afterRecovery.totalSteps).toBe(5);
    expect(afterRecovery.completedSteps).toBe(1);
    expect(afterRecovery.maxScore).toBe(50);
    expect(afterRecovery.scorePercent).toBe(20);
    expect(afterRecovery.isComplete).toBe(false);
    expect(afterRecovery.activeSceneKeys).toContain('CountingLevel');
    expect(afterRecovery.readoutTexts).toContain('0 / 4');
  });

  test('completes farm-count-01 with a perfect score', async ({ page }) => {
    await launchRomanianFarmCountActivity(page);

    await completeFarmCountPerfectly(page);
    await waitForCountingGameCompletion(page);

    const finalState = await getCountingRuntimeState(page);
    expect(finalState.score).toBe(50);
    expect(finalState.totalSteps).toBe(5);
    expect(finalState.completedSteps).toBe(5);
    expect(finalState.maxScore).toBe(50);
    expect(finalState.scorePercent).toBe(100);
    expect(finalState.isComplete || finalState.activeSceneKeys.includes('Results')).toBe(true);
    expect(finalState.activeSceneKeys).toContain('Results');
    expect(finalState.activeSceneKeys).not.toEqual(['CountingLevel']);
  });

  test('shows the Romanian results screen after a perfect completion', async ({ page }) => {
    await launchRomanianFarmCountActivity(page);

    await completeFarmCountPerfectly(page);
    await waitForCountingGameCompletion(page);

    const resultsUi = await getResultsSceneUiState(page);
    expect(resultsUi.activeSceneKeys).toContain('Results');
    await expect
      .poll(async () => (await getResultsSceneUiState(page)).visibleTexts, { timeout: 5000 })
      .toEqual(expect.arrayContaining([
        'Felicitări!',
        'Scorul tău',
        '100%',
        'Scor perfect!',
      ]));
  });
});
