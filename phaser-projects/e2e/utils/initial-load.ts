import { expect, type Page } from '@playwright/test';
import { buildActivityLaunchUrl, type E2ETemplateId } from './activity-url';

export interface InitialActivityLoadOptions {
  templateId: E2ETemplateId;
  activityId: string;
  sceneKey: string;
  lang?: string;
  expectedStepCount?: number;
  expectedMaxScore?: number;
}

export async function expectInitialActivityLoad(
  page: Page,
  { templateId, activityId, sceneKey, lang, expectedStepCount, expectedMaxScore }: InitialActivityLoadOptions
): Promise<void> {
  await page.goto(buildActivityLaunchUrl({ templateId, activityId, lang }));

  await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 });
  await page.waitForFunction(
    () => !!(window as any).__GAME_MANAGER__?.getConfig(),
    { timeout: 15000 }
  );
  await page.waitForFunction(
    (expectedSceneKey) => {
      const game = (window as any).__PHASER_GAME__;
      const activeSceneKeys = game?.scene?.getScenes(true).map((scene: any) => scene.scene.key) ?? [];
      return activeSceneKeys.includes(expectedSceneKey);
    },
    sceneKey,
    { timeout: 15000 }
  );

  const initialState = await page.evaluate(() => {
    const gm = (window as any).__GAME_MANAGER__;
    const config = gm?.getConfig();
    const game = (window as any).__PHASER_GAME__;
    const activeSceneKeys = game?.scene?.getScenes(true).map((scene: any) => scene.scene.key) ?? [];

    return {
      gameId: config?.meta?.gameId ?? config?.meta?.activityId ?? config?.id,
      stepCount: config?.meta?.totalSteps ?? config?.rounds?.length ?? config?.items?.length ?? config?.questions?.length,
      score: gm?.getScore?.(),
      isComplete: gm?.isGameComplete?.(),
      totalSteps: gm?.getTotalSteps?.(),
      completedSteps: gm?.getCompletedSteps?.(),
      maxScore: gm?.getMaxScore?.(),
      scorePercent: gm?.getScorePercent?.(),
      activeSceneKeys,
    };
  });

  expect(initialState.gameId).toBe(activityId);
  if (expectedStepCount !== undefined) {
    expect(initialState.stepCount).toBe(expectedStepCount);
    expect(initialState.totalSteps).toBe(expectedStepCount);
  }
  if (expectedMaxScore !== undefined) {
    expect(initialState.maxScore).toBe(expectedMaxScore);
  }
  expect(initialState.score).toBe(0);
  expect(initialState.completedSteps).toBe(0);
  expect(initialState.scorePercent).toBe(0);
  expect(initialState.isComplete).toBe(false);
  expect(initialState.activeSceneKeys).toContain(sceneKey);
}
