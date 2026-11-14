import { expect, test } from '@playwright/test';

const DIST_SMOKE_ROUTES = [
  { route: '/activities/fruits-01', activityId: 'fruits-01', gameId: 'fruits-01' },
  { route: '/activities/fruits-01@1', activityId: 'fruits-01', gameId: 'fruits-01' },
  { route: '/activities/animals-match-01', activityId: 'animals-match-01', gameId: 'animals-match-01' },
];

test.describe('production Activity host dist', () => {
  for (const route of DIST_SMOKE_ROUTES) {
    test(`${route.route} boots from built activity content`, async ({ page, request }) => {
      const failedResponses: string[] = [];
      page.on('response', (response) => {
        if (response.status() >= 400) {
          failedResponses.push(`${response.status()} ${response.url()}`);
        }
      });

      await expectOkJson(request.get(`/activities/${route.activityId}/versions/1/config.json`));
      await expectOkJson(request.get(`/activities/${route.activityId}/versions/1/strings/en.json`));
      await expectOkJson(request.get(`/activities/${route.activityId}/versions/1/assets.json`));

      await page.goto(route.route);

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

      expect(diagnostics.gameId).toBe(route.gameId);
      expect(diagnostics.totalSteps).toBeGreaterThan(0);
      expect(diagnostics.activeSceneCount).toBeGreaterThan(0);
      expect(failedResponses).toEqual([]);
    });
  }

  test('serves shared asset files from production dist', async ({ request }) => {
    const libraryResponse = await request.get('/assets/library/images/apple.png');
    expect(libraryResponse.ok()).toBe(true);
    expect(libraryResponse.headers()['content-type']).toContain('image/png');

    const bootMascotResponse = await request.get('/assets/shared/mascots/guapen.png');
    expect(bootMascotResponse.ok()).toBe(true);
    expect(bootMascotResponse.headers()['content-type']).toContain('image/png');
  });
});

async function expectOkJson(responsePromise: Promise<import('@playwright/test').APIResponse>): Promise<void> {
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('application/json');
}
