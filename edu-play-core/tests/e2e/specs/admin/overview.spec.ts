import { test, expect } from '../../fixtures/auth.fixture';
import { testTeacher } from '../../fixtures/test-data';

/**
 * Admin overview shell E2E tests (EDU-68).
 *
 * The unauthenticated paths exercise the production middleware redirect
 * — that runs against any environment, so they always execute.
 *
 * The authenticated paths require an `admin`-role user in the seeded
 * test database. Until `tests/e2e/global-setup.ts` seeds an admin
 * fixture (matching the existing TODO in `teacher/dashboard.spec.ts`),
 * those test bodies are skipped but kept in place so a future seeding
 * change unlocks them with no edits to this file.
 */
test.describe('Admin Overview', () => {
  test.describe('Unauthenticated User', () => {
    test('redirects to login when visiting /admin', async ({ page }) => {
      await page.goto('/admin');
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    });

    test('redirects to login when visiting any nested admin route', async ({ page }) => {
      const protectedAdminRoutes = [
        '/admin/games',
        '/admin/cms/activities',
        '/admin/users',
        '/admin/flags',
        '/admin/audit',
        '/admin/privacy',
      ];

      for (const route of protectedAdminRoutes) {
        await page.goto(route);
        await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
      }
    });
  });

  test.describe('Authenticated Admin User', () => {
    test.skip(
      true,
      'Authenticated admin tests require seeded admin user in database (mirrors teacher/dashboard.spec.ts)',
    );

    test('renders the overview shell with the admin nav and header', async ({ page }) => {
      // The render assertions below are the contract for EDU-68:
      //   1. Side nav resolves and shows the six admin items.
      //   2. The Romanian eyebrow lands as `PANOU ADMINISTRATIV`.
      //   3. The maintenance CTA is present but disabled with a tooltip.
      await page.goto('/admin');

      await expect(page.getByTestId('admin-overview-page')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('PANOU ADMINISTRATIV')).toBeVisible();

      const maintenanceCta = page.getByRole('button', { name: /Deschide modul întreținere/ });
      await expect(maintenanceCta).toBeVisible();
      await expect(maintenanceCta).toBeDisabled();

      const expectedNavLabels = ['Panou', 'Activități', 'Utilizatori', 'Funcționalități', 'Jurnal audit', 'Confidențialitate'];
      for (const label of expectedNavLabels) {
        await expect(page.getByRole('link', { name: new RegExp(label, 'i') }).first()).toBeVisible();
      }
    });

    test('shows search as unavailable without capturing "/"', async ({ page }) => {
      await page.goto('/admin');
      const search = page.getByRole('searchbox', {
        name: /Căutarea în panoul administrativ nu este disponibilă momentan/,
      });

      await expect(search).toBeVisible({ timeout: 15000 });
      await expect(search).toBeDisabled();
      await page.keyboard.press('/');
      await expect(search).not.toBeFocused();
    });

    test('all six nav items resolve to a 200 page', async ({ page }) => {
      const adminRoutes = [
        '/admin',
        '/admin/cms/activities',
        '/admin/users',
        '/admin/flags',
        '/admin/audit',
        '/admin/privacy',
      ];

      for (const route of adminRoutes) {
        const response = await page.goto(route);
        expect(response?.status(), `Expected ${route} to return 200`).toBe(200);
      }
    });

    test('filters CMS activities and bulk publishes selected drafts', async ({ page }) => {
      test.skip(
        true,
        'Authenticated admin CMS activity flow requires seeded admin user and CMS draft fixtures',
      );

      await page.goto('/admin/cms/activities');
      await expect(page.getByTestId('admin-cms-activities-page')).toBeVisible({ timeout: 15000 });

      await page.getByRole('tab', { name: /^draft/i }).click();
      await page.getByRole('checkbox', { name: /selectează/i }).first().check();
      await page.getByRole('button', { name: /publică selectate/i }).click();

      await expect(page.getByText('Activități publicate')).toBeVisible();
    });
  });

  test.describe('Authenticated non-admin (role gate)', () => {
    test.skip(
      true,
      'Authenticated role-gate tests require seeded teacher user in database',
    );

    test('redirects a teacher away from /admin', async ({ loginPage, page }) => {
      await loginPage.goto();
      await loginPage.loginAsTeacher(testTeacher.email, testTeacher.password);
      await expect(page).toHaveURL(/\/teacher/, { timeout: 15000 });

      await page.goto('/admin');
      // Middleware sends the teacher back to their own dashboard rather than
      // exposing the admin shell.
      await expect(page).not.toHaveURL(/\/admin/);
    });
  });
});
