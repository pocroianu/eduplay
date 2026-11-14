import { expect, test } from '../../fixtures/auth.fixture';
import { FamilyFeedPage } from '../../pages/family-feed.page';
import { LoginPage } from '../../pages/login.page';
import { seedParentE2EData } from '../../fixtures/parent-seed';
import {
  testParent,
  testStudent,
  testTeacher,
  timeouts,
} from '../../fixtures/test-data';

/**
 * E2E: Parent artifact visibility through the parent_children junction (EDU-283).
 *
 * Background — bug being verified:
 * `get_parent_child_ids(parent_uid)` previously resolved linked children via
 * the legacy `students.parent_id` column. The modern parent invite-code flow
 * (`linkParentToChild`) writes only to `parent_children` — it does NOT
 * backfill `students.parent_id`. So any parent linked through the invite-code
 * flow saw zero rows through the "Parents can view family-visible artifacts"
 * RLS policy on `child_artifacts`. F7 ships nothing without the fix.
 *
 * The migration `20260501100000_fix_parent_artifact_rls.sql` switches the
 * function body to `SELECT student_id FROM parent_children WHERE parent_id =
 * parent_uid AND status = 'active'`. This spec exercises the full flow:
 *
 *   1. Parent (registered via invite-code flow) signs in.
 *   2. Teacher publishes a `family_visible` artifact for the linked child via
 *      `POST /api/v1/portfolio/.../publish` (or the equivalent server action
 *      surface once the F6 review queue ships its API counterpart).
 *   3. Parent navigates to `/parent/children/{childId}` and the parent-side
 *      `getFamilyVisibleArtifactsForChild` query returns the row.
 *
 * Authenticated tests use the test-user + parent_children seed pipeline
 * from `tests/e2e/global-setup.ts`. The route-protection block runs
 * unconditionally and proves /parent/children/{id} redirects unauthenticated
 * traffic to login (defense-in-depth on top of RLS).
 *
 * Prerequisites for the unskipped tests once seeding lands:
 *   - Teacher account `testTeacher.email` with a class containing
 *     `testStudent.username`.
 *   - Parent account `testParent.email` linked to that student via
 *     `parent_children` (status='active', linked_via_code IS NOT NULL),
 *     with `students.parent_id` deliberately left NULL — that NULL is what
 *     the bug caused, and what the migration must defeat.
 *   - At least one `child_artifacts` row for the student that the teacher
 *     can publish via `publishArtifact`.
 */

const TEST_CHILD_ID = '00000000-0000-0000-0000-000000000000';
const CI_NAVIGATION_TIMEOUT = 30000;

test.describe('Parent artifact visibility via parent_children junction (EDU-283)', () => {
  test.describe('Route protection', () => {
    test('redirects unauthenticated traffic from a child detail URL', async ({
      page,
    }) => {
      await page.goto(`/parent/children/${TEST_CHILD_ID}`);
      await expect(page).toHaveURL(/\/login/, { timeout: timeouts.navigation });
    });

    test('redirects unauthenticated traffic from /parent', async ({ page }) => {
      await page.goto('/parent');
      await expect(page).toHaveURL(/\/login/, { timeout: timeouts.navigation });
    });
  });

  test.describe('Junction-linked parent reads published artifact', () => {
    test.beforeEach(async () => {
      await seedParentE2EData();
    });

    test('teacher publishes family_visible artifact, parent sees the row', async ({
      page,
    }) => {
      // Step 1 — teacher signs in and publishes a family_visible artifact.
      // The seed must have created a draft `child_artifacts` row for the
      // linked student. The publish path mutates visibility from 'draft'
      // (or 'internal_teacher_only') to 'family_visible' through the
      // `publishArtifact` server action, which is the same code path the
      // F6 teacher review queue uses.
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAsTeacher(testTeacher.email, testTeacher.password);
      await expect(page).toHaveURL(/\/teacher/, {
        timeout: CI_NAVIGATION_TIMEOUT,
      });

      await page.goto('/teacher/portfolio', {
        waitUntil: 'domcontentloaded',
        timeout: CI_NAVIGATION_TIMEOUT,
      });
      const publishButton = page
        .getByRole('button', { name: /publică/i })
        .first();
      await publishButton.click();
      // Wait for the optimistic mutation to settle.
      await page.waitForLoadState('networkidle');

      // Step 2 — switch to the invite-code-linked parent. Cookie reset is
      // the fastest cross-role swap in a single browser context.
      await page.context().clearCookies();

      await loginPage.goto();
      await loginPage.loginAsParent(testParent.email, testParent.password);
      await expect(page).toHaveURL(/\/parent/, {
        timeout: CI_NAVIGATION_TIMEOUT,
      });

      // Step 3 — filter the family feed to the linked child. The feed queries
      // child_artifacts through the parent's RLS-scoped Supabase client.
      // Pre-fix this returned [] because get_parent_child_ids only consulted
      // students.parent_id (NULL for invite-code parents). Post-fix it must
      // return at least one family-visible artifact for this child.
      const feed = new FamilyFeedPage(page);
      await page.goto(`/parent?child=${testStudent.id}`, {
        waitUntil: 'domcontentloaded',
        timeout: CI_NAVIGATION_TIMEOUT,
      });
      await feed.waitForFeedReady();

      await expect(feed.childPill(testStudent.username)).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(feed.artifactCards.first()).toBeVisible({
        timeout: timeouts.apiCall,
      });
      await expect(feed.artifactCards.first()).toContainText(
        testStudent.username,
      );
    });
  });
});
