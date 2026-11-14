import { expect, test } from '../../fixtures/auth.fixture';
import { LoginPage } from '../../pages/login.page';
import {
  testParent,
  testStudent,
  testTeacher,
  timeouts,
} from '../../fixtures/test-data';

/**
 * E2E: Phase 1E artifact_published feed integration (EDU-275).
 *
 * Verifies the end-to-end story:
 *   1. Teacher signs in and publishes a draft artifact via the review queue.
 *   2. The publish flow inserts a `parent_notifications` row with type
 *      `artifact_published` for every parent linked to the student.
 *   3. The parent's recent-activity feed surfaces the published artifact in
 *      the same session, interleaved with game progress.
 *   4. The parent's notification dropdown shows the matching unread entry.
 *
 * Authenticated tests are skipped pending the test-user + draft-artifact seed
 * pipeline (matches the convention in tests/e2e/specs/parent/notifications.spec.ts
 * and tests/e2e/specs/teacher/portfolio-review-queue.spec.ts). Route protection
 * runs unconditionally and proves /parent prefixes redirect unauthenticated
 * traffic to login (defense-in-depth on top of the middleware role gate).
 *
 * Prerequisites for the unskipped tests once seeding lands:
 *   - Teacher account `testTeacher.email` with a class containing
 *     `testStudent.username`.
 *   - Parent account `testParent.email` linked to that student via
 *     `parent_children` (status='active').
 *   - At least one `child_artifacts` row in `draft` or `internal_teacher_only`
 *     visibility, owned by the linked student.
 *   - DB-level access (service-role client or a test-only API surface) so the
 *     spec can assert the `parent_notifications` row was inserted.
 */

const ARTIFACT_NOTIFICATION_TITLE = /^lucrare nouă publicată$/i;

test.describe('Parent feed: artifact_published end-to-end (EDU-275)', () => {
  test.describe('Route protection', () => {
    test('redirects /parent to /login without auth', async ({ page }) => {
      await page.goto('/parent');
      await expect(page).toHaveURL(/\/login/, { timeout: timeouts.navigation });
    });

    test('redirects /parent/notifications to /login without auth', async ({
      page,
    }) => {
      await page.goto('/parent/notifications');
      await expect(page).toHaveURL(/\/login/, { timeout: timeouts.navigation });
    });
  });

  test.describe('Publish → parent feed → notification (full flow)', () => {
    test.skip(
      true,
      'Requires seeded teacher + parent + linked student + draft artifact in test DB',
    );

    test('teacher publishes draft, parent sees feed entry + notification', async ({
      page,
    }) => {
      // Step 1 — teacher signs in and publishes a draft artifact through the
      // review queue UI. The publish flow runs runVisibilityChange which
      // dispatches notify_linked_parents('artifact_published', ...) after the
      // visibility update succeeds.
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAsTeacher(testTeacher.email, testTeacher.password);
      await expect(page).toHaveURL(/\/teacher/, {
        timeout: timeouts.navigation,
      });

      await page.goto('/teacher/portfolio');
      const card = page
        .locator('[aria-label="Lista artefactelor de revizuit"] li')
        .first();
      await expect(card).toBeVisible({ timeout: timeouts.apiCall });

      const publishButton = card.getByRole('button', {
        name: /publică pentru familie/i,
      });
      await publishButton.click();

      // The card disappears once the visibility flips off the queue surface.
      await expect(card).toHaveCount(0, { timeout: timeouts.apiCall });

      // Step 2 — switch to the linked parent. Cookie reset is the cheapest
      // role swap inside a single browser context.
      await page.context().clearCookies();
      await loginPage.goto();
      await loginPage.loginAsParent(testParent.email, testParent.password);
      await expect(page).toHaveURL(/\/parent/, {
        timeout: timeouts.navigation,
      });

      // Step 3 — the parent dashboard renders the artifact card variant with
      // the child's name and the artifact title (or media-type fallback).
      await page.goto('/parent');
      const artifactRow = page.getByTestId('activity-feed-artifact').first();
      await expect(artifactRow).toBeVisible({ timeout: timeouts.apiCall });
      await expect(artifactRow).toContainText(testStudent.name);

      // Step 4 — the notification dropdown lists the unread
      // `artifact_published` entry with the Vulpița-voiced copy.
      const notificationBell = page.getByRole('button', {
        name: /notificări/i,
      });
      await notificationBell.click();
      const notification = page
        .getByRole('button')
        .filter({ hasText: ARTIFACT_NOTIFICATION_TITLE })
        .first();
      await expect(notification).toBeVisible({ timeout: timeouts.apiCall });
      await expect(notification).toContainText(/vulpița a publicat/i);
    });
  });
});
