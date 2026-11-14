import { expect, test } from '@playwright/test';

const TEMPLATE_DEBUG_ROUTES = [
  { templateId: 'categorize-game', gameId: 'animals-habitat-01' },
  { templateId: 'counting-game', gameId: 'farm-count-01' },
  { templateId: 'listen-tap', gameId: 'phonics-ro-01' },
  { templateId: 'matching-game', gameId: 'animals-match-01' },
  { templateId: 'memory-game', gameId: 'animals-memory-01' },
  { templateId: 'multiple-choice', gameId: 'fruits-01' },
  { templateId: 'pattern-game', gameId: 'shapes-pattern-01' },
  { templateId: 'repeat-sequence', gameId: 'animals-sequence-01' },
  { templateId: 'sequence-order', gameId: 'numbers-1-to-6' },
  { templateId: 'tracing-game', gameId: 'shapes-basic' },
];

test.describe('single-host template debug routes', () => {
  for (const template of TEMPLATE_DEBUG_ROUTES) {
    test(`boots /templates/${template.templateId}/ with default Activity content`, async ({ page }) => {
      await page.goto(`/templates/${template.templateId}/`);

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
        const preview = (window as any).__MULTIPLE_CHOICE_PREVIEW__;
        return {
          gameId: config?.meta?.gameId,
          totalSteps: gm?.getTotalSteps?.(),
          activeSceneCount: game?.scene?.getScenes(true).length ?? 0,
          basePath: preview?.basePath,
        };
      });

      expect(diagnostics.gameId).toBe(template.gameId);
      expect(diagnostics.totalSteps).toBeGreaterThan(0);
      expect(diagnostics.activeSceneCount).toBeGreaterThan(0);
      expect(diagnostics.basePath).toBe(`/activities/${template.gameId}/versions/1`);
    });
  }
});
