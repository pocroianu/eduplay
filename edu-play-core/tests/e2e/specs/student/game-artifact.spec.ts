import { test, expect } from '../../fixtures/auth.fixture';
import { testStudent } from '../../fixtures/test-data';

/**
 * Student Game Artifact E2E (EDU-273 / F6 Phase 1C)
 *
 * Verifies that completing a game produces a draft `child_artifacts` row
 * for the logged-in student when the game iframe posts a screenshotDataUrl
 * with GAME_COMPLETE.
 *
 * NOTE: Authenticated tests are skipped until test user/game seeding lands
 * in `tests/e2e/global-setup.ts`. The same gating applies to every other
 * authenticated student spec in this folder. Once seeding is in place, drop
 * the `test.skip(true, …)` line and these tests will exercise the full
 * flow.
 *
 * Manual reproduction (for now):
 *   1. `npm run dev:full`
 *   2. Log in as a seeded student.
 *   3. Open a published game and complete it.
 *   4. Verify in Supabase Studio that a row exists in `child_artifacts`
 *      with `student_id = <student>`, `visibility = 'draft'`,
 *      `artifact_type = 'drawing'`, and `storage_path` like
 *      `<student_id>/<uuid>.png` — and that the matching object lives in
 *      the `child-artifacts` storage bucket.
 */
test.describe('Student game completion → draft artifact', () => {
  test.skip(
    true,
    'Requires seeded test student and game (see tests/e2e/global-setup.ts TODO)',
  );

  test.beforeEach(async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.loginAsStudent(testStudent.username, testStudent.pin);
    await expect(page).toHaveURL(/\/student/, { timeout: 15000 });
  });

  test('GAME_COMPLETE with screenshotDataUrl persists a draft artifact', async ({
    page,
  }) => {
    // Navigate to a seeded game (placeholder id — the seeding step decides).
    await page.goto('/games/test-game-fruits');

    // Wait for the iframe to load and forward GAME_COMPLETE.
    const iframeLocator = page.frameLocator('iframe').first();
    await iframeLocator.locator('canvas').waitFor({ state: 'visible' });

    // Drive the postMessage contract directly so we don't have to play the
    // game through. The host validates origin, so the message must be
    // dispatched from the iframe context (same origin as the app).
    await page.evaluate(() => {
      const tinyPng =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';
      window.postMessage(
        {
          type: 'GAME_COMPLETE',
          score: 100,
          totalSets: 5,
          timeSpent: 30,
          reason: 'completed',
          starRating: 3,
          screenshotDataUrl: tinyPng,
        },
        window.location.origin,
      );
    });

    // The host calls `recordGameArtifact` (a Next.js Server Action). Wait
    // for the resulting POST to settle before we inspect the DB.
    await page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes('/games/'),
      { timeout: 10000 },
    );

    // TODO: query Supabase via service-role client and assert that a draft
    // `child_artifacts` row exists for the seeded student. The exact DB
    // helper will live in `tests/e2e/utils/db.ts` once seeding is wired up.
  });
});
