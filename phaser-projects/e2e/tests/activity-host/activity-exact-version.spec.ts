import { expect, test } from '@playwright/test';

const EXACT_VERSION_ROUTES = [
  { route: '/activities/fruits-01@1', gameId: 'fruits-01' },
  { route: '/activities/animals-match-01@1', gameId: 'animals-match-01' },
  { route: '/activities/shapes-basic@1', gameId: 'shapes-basic' },
];

test.describe('single-host exact Activity version routes', () => {
  for (const activity of EXACT_VERSION_ROUTES) {
    test(`loads ${activity.route}`, async ({ page }) => {
      await page.goto(activity.route);

      await expect(page.locator('canvas')).toBeVisible({ timeout: 20000 });
      await expect(page.getByRole('heading', { name: 'Activity host' })).toHaveCount(0);
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
          activeSceneCount: game?.scene?.getScenes(true).length ?? 0,
        };
      });

      expect(diagnostics.gameId).toBe(activity.gameId);
      expect(diagnostics.totalSteps).toBeGreaterThan(0);
      expect(diagnostics.activeSceneCount).toBeGreaterThan(0);
    });
  }
});
