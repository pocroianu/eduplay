import { test, expect } from '@playwright/test';

const DEFAULT_ACTIVITY_ROUTES = [
  { activityId: 'fruits-01', gameId: 'fruits-01' },
  { activityId: 'animals-match-01', gameId: 'animals-match-01' },
  { activityId: 'animals-habitat-01', gameId: 'animals-habitat-01' },
  { activityId: 'numbers-1-to-6', gameId: 'numbers-1-to-6' },
  { activityId: 'animals-memory-01', gameId: 'animals-memory-01' },
  { activityId: 'farm-count-01', gameId: 'farm-count-01' },
  { activityId: 'shapes-pattern-01', gameId: 'shapes-pattern-01' },
  { activityId: 'animals-sequence-01', gameId: 'animals-sequence-01' },
  { activityId: 'phonics-ro-01', gameId: 'phonics-ro-01' },
  { activityId: 'shapes-basic', gameId: 'shapes-basic' },
];

test.describe('single-host Activity routes', () => {
  for (const activity of DEFAULT_ACTIVITY_ROUTES) {
    test(`loads ${activity.activityId} through the canonical /activities route`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') {
          consoleErrors.push(message.text());
        }
      });

      await page.goto(`/activities/${activity.activityId}`);

      await expect(page.locator('canvas')).toBeVisible({ timeout: 20000 });
      await page.waitForFunction(
        () => !!(window as any).__GAME_MANAGER__?.getConfig(),
        { timeout: 20000 }
      );

      const diagnostics = await page.evaluate(() => {
        const gm = (window as any).__GAME_MANAGER__;
        const config = gm?.getConfig();
        const game = (window as any).__PHASER_GAME__;
        return {
          gameId: config?.meta?.gameId,
          totalSteps: gm?.getTotalSteps?.(),
          score: gm?.getScore?.(),
          isComplete: gm?.isGameComplete?.(),
          activeSceneCount: game?.scene?.getScenes(true).length ?? 0,
        };
      });

      expect(diagnostics.gameId).toBe(activity.gameId);
      expect(diagnostics.totalSteps).toBeGreaterThan(0);
      expect(diagnostics.score).toBe(0);
      expect(diagnostics.isComplete).toBe(false);
      expect(diagnostics.activeSceneCount).toBeGreaterThan(0);
      expect(consoleErrors.filter((message) => !message.includes('Failed to load resource: the server responded with a status of 404'))).toEqual([]);
    });
  }
});
