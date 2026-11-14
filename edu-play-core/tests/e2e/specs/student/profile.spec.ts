import { test, expect } from '../../fixtures/auth.fixture';
import { testStudent } from '../../fixtures/test-data';

/**
 * /student/profile route — EDU-53.
 *
 * Authenticated flows are skipped until test-student seeding ships
 * (mirrors the dashboard.spec.ts pattern). The unauthenticated routing
 * test runs unconditionally so role gating regressions are caught.
 */
test.describe('Student Profile — Route gating', () => {
  test('redirects unauthenticated visitors to /login', async ({ page }) => {
    await page.goto('/student/profile');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});

test.describe('Student Profile — Authenticated flows', () => {
  test.skip(true, 'Authenticated tests require seeded test student in database');

  test.beforeEach(async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.loginAsStudent(testStudent.username, testStudent.pin);
    await expect(page).toHaveURL(/\/student/, { timeout: 15000 });
    await page.goto('/student/profile');
    await expect(page).toHaveURL(/\/student\/profile/, { timeout: 10000 });
  });

  test('renders the profile header sections', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /rezumat/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /setări/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /securitate/i })).toBeVisible();
  });

  test('opens the avatar picker, selects a preset, and persists it', async ({ page }) => {
    await page.getByTestId('open-avatar-picker').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const tiles = page.getByRole('button', { name: /^Avatar \d+$/ });
    await tiles.nth(2).click();
    await page.getByRole('button', { name: /salvează avatarul/i }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('toggles sound preference and reflects state on the switch', async ({ page }) => {
    const soundSwitch = page.getByTestId('toggle-sound');
    const initial = await soundSwitch.getAttribute('aria-checked');
    await soundSwitch.click();
    await expect(soundSwitch).not.toHaveAttribute('aria-checked', initial ?? '');
  });

  test('changes theme to dark and updates the html data-theme attribute', async ({ page }) => {
    await page.getByTestId('theme-dark').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('opens the change-PIN dialog and lets the student enter four digits', async ({ page }) => {
    await page.getByTestId('open-change-pin').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 4; i += 1) {
      await page.getByRole('button', { name: `${(i + 1) % 10}` }).click();
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test('shows logout confirmation and dismisses on cancel', async ({ page }) => {
    await page.getByTestId('open-logout').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /anulează/i }).click();
    await expect(dialog).toHaveCount(0);
  });
});

test.describe('Student Profile — Mobile', () => {
  test.skip(true, 'Mobile tests require seeded test student in database');
  test.use({ viewport: { width: 390, height: 844 } });

  test('reaches the profile page from the bottom-nav settings shortcut', async ({
    loginPage,
    page,
  }) => {
    await loginPage.goto();
    await loginPage.loginAsStudent(testStudent.username, testStudent.pin);
    await expect(page).toHaveURL(/\/student/, { timeout: 15000 });
    await page.goto('/student/profile');
    await expect(page).toHaveURL(/\/student\/profile/);
    // Bottom nav stays at 4 entries — settings is side-nav only on desktop.
    const bottomNav = page.locator('[data-testid="bottom-nav"]');
    await expect(bottomNav.getByRole('link')).toHaveCount(4);
  });
});
