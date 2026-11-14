import { expect, test } from '../../fixtures/auth.fixture';
import { testTeacher } from '../../fixtures/test-data';

/**
 * Teacher portfolio review queue (EDU-274 / F6 Phase 1D).
 *
 * Authenticated golden-path tests are skipped until the test-user + draft
 * artifact seeding pipeline lands. Once the seeding helper exists, drop the
 * `test.skip(...)` line and wire the spec to seed a `draft` artifact, drive
 * the approve flow, and assert visibility flipped to `internal_teacher_only`.
 *
 * The route-protection block runs unconditionally and proves the
 * `/teacher/portfolio` prefix redirects unauthenticated traffic to the login
 * page (defense-in-depth on top of the middleware role gate).
 */
test.describe('Teacher · Portfolio review queue', () => {
  test.describe('Authenticated golden path', () => {
    test.skip(true, 'Authenticated tests require seeded test teacher + draft artifact');

    test('teacher approves a draft response and visibility flips to internal_teacher_only', async ({
      loginPage,
      page,
    }) => {
      await loginPage.goto();
      await loginPage.loginAsTeacher(testTeacher.email, testTeacher.password);
      await expect(page).toHaveURL(/\/teacher/, { timeout: 15000 });

      // Visit the review queue. The seed harness must have inserted at least
      // one draft artifact attached to one of the test teacher's classes.
      await page.goto('/teacher/portfolio');
      await expect(page).toHaveURL(/\/teacher\/portfolio$/);

      const card = page
        .locator('[aria-label="Lista răspunsurilor de revizuit"] li')
        .first();
      await expect(card).toBeVisible();

      const approveButton = card.getByRole('button', {
        name: /aprobă/i,
      });
      await approveButton.click();

      // After revalidatePath, the card should disappear from the queue because
      // the inbox only shows draft responses.
      await expect(card).toHaveCount(0, { timeout: 10000 });

      // Empty-state copy renders when no drafts remain (assuming the seed
      // only inserted one draft for this teacher).
      await expect(
        page.getByText('Nu ai răspunsuri de revizuit. Bună treabă!'),
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Route protection', () => {
    test('redirects unauthenticated users from /teacher/portfolio', async ({
      page,
    }) => {
      await page.goto('/teacher/portfolio');
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    });

    test('redirects unauthenticated users when filters are present in the URL', async ({
      page,
    }) => {
      await page.goto(
        '/teacher/portfolio?classId=11111111-1111-1111-1111-111111111111&from=2026-04-01',
      );
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    });
  });
});
