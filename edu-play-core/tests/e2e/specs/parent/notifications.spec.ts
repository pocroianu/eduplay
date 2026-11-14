import { test, expect } from '../../fixtures/auth.fixture';
import { LoginPage } from '../../pages/login.page';
import { ParentDashboardPage } from '../../pages/parent-dashboard.page';
import { ParentNotificationsPage } from '../../pages/parent-notifications.page';
import { seedParentE2EData } from '../../fixtures/parent-seed';
import {
  testTeacher,
  testParent,
  testStudent,
  testGame,
  testRoutes,
  timeouts,
} from '../../fixtures/test-data';

/**
 * E2E: Parent notifications flow (EDU-9 DOD)
 *
 * Covers the four-step Definition of Done from
 * https://github.com/eduplay-org/edu-play-core/pull/82:
 *   1. Teacher creates an assignment for a student.
 *   2. Parent logs in and sees the notification in the bell dropdown.
 *   3. Parent marks the notification as read (single + bulk).
 *   4. Badge count updates correctly across pages and reloads.
 *
 * Prerequisites (seeded data):
 * - Teacher account (teacher@test.eduplay.ro)
 * - Published game (testGame.id)
 * - Class belonging to that teacher with at least one student (testStudent.username)
 * - Parent account (parinte@test.eduplay.ro) linked to that student via parent_children
 *
 * The teacher → assignment leg of the flow is driven through the v1 API rather
 * than UI: the /teacher/assignments composer is owned by EDU-8 (PR #80, still
 * open) and is not yet on main. POST /api/v1/assignments calls the
 * notify_linked_parents RPC, which is the actual code path EDU-9 must verify.
 *
 * Tests that depend on seeded data use the parent E2E seed pipeline from
 * tests/e2e/global-setup.ts.
 */

const ASSIGNMENT_NOTIFICATION_TITLE = /temă nouă/i;

/**
 * Sign the teacher in via the LoginPage POM, then create an assignment by
 * calling POST /api/v1/assignments through the page's shared request context
 * (cookies from the UI login carry over). The assignment creation is the
 * trigger that fires `notify_linked_parents` server-side, which is the code
 * path EDU-9 must verify.
 *
 * The /teacher/assignments UI composer is owned by EDU-8 (PR #80, still open)
 * and is not yet on main, so we exercise the API instead. When the composer
 * lands, the UI flow can replace this helper.
 */
async function createAssignmentAsTeacher(
  page: import('@playwright/test').Page,
  options: {
    email: string;
    password: string;
    activityId: string;
    studentId: string;
  },
): Promise<{ assignmentId: string }> {
  const loginPage = new LoginPage(page);
  await page.context().clearCookies();
  await loginPage.goto();
  await loginPage.loginAsTeacher(options.email, options.password);
  await expect(page).toHaveURL(/\/teacher/, { timeout: timeouts.navigation });

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const createResponse = await page.request.post('/api/v1/assignments', {
    data: {
      activityId: options.activityId,
      studentId: options.studentId,
      dueDate: tomorrow,
      isMandatory: true,
    },
  });
  expect(
    createResponse.ok(),
    `assignment creation must succeed (status=${createResponse.status()})`,
  ).toBeTruthy();

  const body = (await createResponse.json()) as { data: { id: string } };
  return { assignmentId: body.data.id };
}

/**
 * Sign the current page out by clearing cookies — fastest reset between role
 * switches in a single browser context. The LoginPage POM doesn't expose a
 * UI logout (there is no logout link on the public /login route), so this is
 * the recommended Playwright approach.
 */
async function signOut(page: import('@playwright/test').Page): Promise<void> {
  await page.context().clearCookies();
}

test.describe('Parent notifications: create-assignment → parent-notified flow (EDU-9)', () => {
  test.describe('Unauthenticated access', () => {
    test('redirects /parent to /login without auth', async ({ page }) => {
      await page.goto(testRoutes.parentDashboard);
      await expect(page).toHaveURL(/\/login/, { timeout: timeouts.navigation });
    });

    test('redirects /parent/notifications to /login without auth', async ({ page }) => {
      await page.goto(testRoutes.parentNotifications);
      await expect(page).toHaveURL(/\/login/, { timeout: timeouts.navigation });
    });
  });

  test.describe('Parent dashboard bell (authenticated)', () => {
    test.beforeEach(async () => {
      await seedParentE2EData();
    });

    test('opens the dropdown and renders the empty state when no notifications', async ({
      authenticatedParent,
    }) => {
      await authenticatedParent.verifyDashboardLoaded();
      await authenticatedParent.openNotificationDropdown();
      await expect(authenticatedParent.emptyDropdownState).toBeVisible();
    });

    test('shows the bell with no badge when no unread notifications exist', async ({
      authenticatedParent,
    }) => {
      expect(await authenticatedParent.hasUnreadBadge()).toBe(false);
    });
  });

  test.describe('Notifications list page (authenticated)', () => {
    test('renders the notifications page heading and empty state', async ({
      authenticatedParent,
      parentNotifications,
    }) => {
      await authenticatedParent.verifyDashboardLoaded();
      await parentNotifications.goto();
      await parentNotifications.verifyOnPage();

      const count = await parentNotifications.getNotificationCount();
      if (count === 0) {
        await parentNotifications.verifyEmptyState();
      }
    });

    test('navigates from the bell footer link to the full list', async ({
      authenticatedParent,
      page,
    }) => {
      await authenticatedParent.openNotificationDropdown();
      await authenticatedParent.goToAllNotifications();

      await expect(page).toHaveURL(/\/parent\/notifications/, {
        timeout: timeouts.navigation,
      });
    });
  });

  test.describe('Full DOD flow: create assignment → notification → read → badge', () => {
    test.beforeEach(async () => {
      await seedParentE2EData();
    });

    test('teacher creates assignment, parent sees notification in bell, marks it read, badge clears', async ({
      page,
    }) => {
      // Step 1 — teacher signs in and creates an assignment via the v1 API.
      // notify_linked_parents fires server-side and inserts into
      // parent_notifications for every linked parent of the student.
      await createAssignmentAsTeacher(page, {
        email: testTeacher.email,
        password: testTeacher.password,
        activityId: testGame.id,
        studentId: testStudent.id,
      });
      await signOut(page);

      // Step 2 — parent logs in and lands on the dashboard.
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAsParent(testParent.email, testParent.password);
      await expect(page).toHaveURL(/\/parent/, { timeout: timeouts.navigation });

      const dashboard = new ParentDashboardPage(page);
      await dashboard.verifyDashboardLoaded();

      // Step 3 — bell shows an unread badge with at least one new notification.
      expect(await dashboard.hasUnreadBadge()).toBe(true);
      const initialUnread = Number(await dashboard.getUnreadBadgeCount());
      expect(initialUnread).toBeGreaterThanOrEqual(1);

      // Step 4 — open the dropdown and confirm the "Temă nouă" notification renders.
      await dashboard.openNotificationDropdown();
      await expect(
        dashboard.notificationItem(ASSIGNMENT_NOTIFICATION_TITLE).first(),
      ).toBeVisible();

      // Step 5 — clicking the notification marks it read and closes the dropdown.
      await dashboard.clickNotification(ASSIGNMENT_NOTIFICATION_TITLE);
      await expect(dashboard.notificationDropdown).not.toBeVisible();

      // Step 6 — badge count decremented (or removed) after the optimistic update.
      await page.waitForLoadState('networkidle');
      const afterReadUnread = Number(await dashboard.getUnreadBadgeCount());
      expect(afterReadUnread).toBeLessThan(initialUnread);
    });

    test('full notifications list: row "mark as read" clears the per-row indicator', async ({
      page,
    }) => {
      await createAssignmentAsTeacher(page, {
        email: testTeacher.email,
        password: testTeacher.password,
        activityId: testGame.id,
        studentId: testStudent.id,
      });
      await signOut(page);

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAsParent(testParent.email, testParent.password);
      await expect(page).toHaveURL(/\/parent/, { timeout: timeouts.navigation });

      const notifications = new ParentNotificationsPage(page);
      await notifications.goto();
      await notifications.verifyOnPage();

      const row = notifications.notificationRow(ASSIGNMENT_NOTIFICATION_TITLE);
      await expect(row.first()).toBeVisible();

      await notifications.markRowAsRead(ASSIGNMENT_NOTIFICATION_TITLE);

      // The per-row "mark as read" button is conditional on isUnread, so it
      // must disappear from the row after the server action completes.
      await expect(
        row.first().getByRole('button', { name: /marchează ca citită/i }),
      ).toHaveCount(0, { timeout: timeouts.apiCall });
    });

    test('bulk "mark all as read" clears the badge count to zero', async ({
      page,
    }) => {
      // Generate two assignments so both bell + bulk paths are exercised.
      await createAssignmentAsTeacher(page, {
        email: testTeacher.email,
        password: testTeacher.password,
        activityId: testGame.id,
        studentId: testStudent.id,
      });
      await createAssignmentAsTeacher(page, {
        email: testTeacher.email,
        password: testTeacher.password,
        activityId: testGame.id,
        studentId: testStudent.id,
      });
      await signOut(page);

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAsParent(testParent.email, testParent.password);
      await expect(page).toHaveURL(/\/parent/, { timeout: timeouts.navigation });

      const dashboard = new ParentDashboardPage(page);
      await dashboard.goto();

      // Confirm the unread badge increments past the first round of notifications.
      const before = Number(await dashboard.getUnreadBadgeCount());
      expect(before).toBeGreaterThanOrEqual(2);

      // Bulk mark-all from the dropdown.
      await dashboard.openNotificationDropdown();
      await dashboard.markAllAsRead();

      await page.waitForLoadState('networkidle');
      // Reload — badge state must persist server-side.
      await page.reload();
      await dashboard.waitForPageLoad();

      expect(await dashboard.hasUnreadBadge()).toBe(false);
    });
  });
});
