import { expect, test } from '../../fixtures/auth.fixture';
import { testParent, testTeacher, timeouts } from '../../fixtures/test-data';

/**
 * E2E: per-child portfolio timeline routes (EDU-558 / F6 Phase 2C).
 *
 * Two surfaces:
 *   - `/teacher/students/{studentId}/portfolio`
 *   - `/parent/children/{childId}/portfolio`
 *
 * Both validate ownership server-side (teacher → assertTeacherOwnsStudent,
 * parent → parent_children active link) and render a monthly-grouped
 * timeline of `child_artifacts`. Teacher sees every visibility (draft +
 * family_visible + internal_teacher_only), parent sees only `family_visible`.
 *
 * Authenticated tests are skipped until the test-user + child_artifacts
 * seeding pipeline lands (same blocker as the existing F6 specs in
 * `tests/e2e/specs/teacher/portfolio-review-queue.spec.ts` and
 * `tests/e2e/specs/parent/artifact-visibility.spec.ts`). The route-protection
 * block runs unconditionally and proves both prefixes redirect
 * unauthenticated traffic to login (defense-in-depth on top of the
 * middleware role gate).
 */

const TEST_STUDENT_ID = '00000000-0000-0000-0000-000000000000';

test.describe('Per-child portfolio timeline (EDU-558)', () => {
  test.describe('Route protection', () => {
    test('redirects unauthenticated traffic from the teacher portfolio route', async ({
      page,
    }) => {
      await page.goto(`/teacher/students/${TEST_STUDENT_ID}/portfolio`);
      await expect(page).toHaveURL(/\/login/, {
        timeout: timeouts.navigation,
      });
    });

    test('redirects unauthenticated traffic from the parent portfolio route', async ({
      page,
    }) => {
      await page.goto(`/parent/children/${TEST_STUDENT_ID}/portfolio`);
      await expect(page).toHaveURL(/\/login/, {
        timeout: timeouts.navigation,
      });
    });
  });

  test.describe('Authenticated golden path', () => {
    test.skip(
      true,
      'Requires seeded test teacher/parent + linked child + child_artifacts rows',
    );

    test('teacher sees draft + family_visible artifacts on the per-child timeline', async ({
      loginPage,
      page,
    }) => {
      await loginPage.goto();
      await loginPage.loginAsTeacher(testTeacher.email, testTeacher.password);
      await expect(page).toHaveURL(/\/teacher/, {
        timeout: timeouts.navigation,
      });

      // Replace TEST_STUDENT_ID with the seeded student id once seeds land.
      await page.goto(`/teacher/students/${TEST_STUDENT_ID}/portfolio`);

      const timeline = page.getByTestId('teacher-portfolio-timeline');
      await expect(timeline).toBeVisible({ timeout: timeouts.apiCall });

      // The teacher timeline surfaces visibility chips so reviewers can tell
      // draft / published / archived apart at a glance.
      await expect(timeline.getByText('În revizuire').first()).toBeVisible();

      // Inline publish/archive forms must remain available on the teacher
      // timeline (action gating is per-card, never per-route).
      await expect(
        timeline.getByRole('button', { name: /publică pentru familie/i }).first(),
      ).toBeVisible();
    });

    test('parent only sees family_visible artifacts on the per-child timeline', async ({
      loginPage,
      page,
    }) => {
      await loginPage.goto();
      await loginPage.loginAsParent(testParent.email, testParent.password);
      await expect(page).toHaveURL(/\/parent/, {
        timeout: timeouts.navigation,
      });

      await page.goto(`/parent/children/${TEST_STUDENT_ID}/portfolio`);

      const timeline = page.getByTestId('parent-portfolio-timeline');
      await expect(timeline).toBeVisible({ timeout: timeouts.apiCall });

      // Parents must never see the teacher publish/archive controls — those
      // are gated behind the readOnly prop on TeacherPortfolioCard.
      await expect(
        timeline.getByRole('button', { name: /publică pentru familie/i }),
      ).toHaveCount(0);
      await expect(
        timeline.getByRole('button', { name: /arhivează/i }),
      ).toHaveCount(0);
    });
  });
});
