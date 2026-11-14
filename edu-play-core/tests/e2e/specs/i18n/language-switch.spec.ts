import { test, expect } from '../../fixtures/auth.fixture';
import { testTeacher } from '../../fixtures/test-data';

const COOKIE_NAME = 'NEXT_LOCALE';

const switcherButton = (page: import('@playwright/test').Page) =>
  page.getByTestId('language-switcher').getByRole('button');

async function selectLanguage(page: import('@playwright/test').Page, language: 'ro' | 'en') {
  const optionName = language === 'en' ? /EN\s*·\s*English/i : /RO\s*·\s*Română/i;

  await switcherButton(page).click();
  await page.getByRole('option', { name: optionName }).click();
}

test.describe('Language Switch — Anonymous User', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
  });

  test('should default to Romanian', async ({ page }) => {
    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBe('ro');

    const switcher = switcherButton(page);
    await expect(switcher).toBeVisible();
    await expect(switcher).toContainText(/RO\s*·\s*Română/i);
  });

  test('should switch to English and update <html lang>', async ({ page }) => {
    await selectLanguage(page, 'en');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en', {
      timeout: 10000,
    });
  });

  test('should set NEXT_LOCALE cookie on switch', async ({ page, context }) => {
    await selectLanguage(page, 'en');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en', {
      timeout: 10000,
    });

    const cookies = await context.cookies();
    const localeCookie = cookies.find((c) => c.name === COOKIE_NAME);
    expect(localeCookie).toBeDefined();
    expect(localeCookie!.value).toBe('en');
  });

  test('should persist language choice across reload', async ({ page }) => {
    await selectLanguage(page, 'en');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en', {
      timeout: 10000,
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(switcherButton(page)).toContainText(/EN\s*·\s*English/i);
  });

  test('should render English copy from common namespace after SSR round-trip', async ({ page }) => {
    await expect(switcherButton(page)).toHaveAttribute('aria-label', 'Schimbă limba');

    await selectLanguage(page, 'en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en', {
      timeout: 10000,
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(switcherButton(page)).toHaveAttribute(
      'aria-label',
      'Change language',
    );
  });
});

test.describe('Language Switch — Authenticated Teacher', () => {
  // Requires seeded test teacher — skip until global-setup seeds test users
  test.skip('should switch language via TopAppBar switcher', async ({
    authenticatedTeacher: _authenticatedTeacher,
    page,
  }) => {
    const switcher = switcherButton(page);
    await expect(switcher).toBeVisible();
    await expect(switcher).toContainText(/RO\s*·\s*Română/i);

    await selectLanguage(page, 'en');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en', {
      timeout: 10000,
    });
  });

  test.skip('should persist preference via profiles.preferred_language across logout/login', async ({
    authenticatedTeacher: _authenticatedTeacher,
    page,
  }) => {
    await selectLanguage(page, 'en');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en', {
      timeout: 10000,
    });

    const logoutButton = page.getByRole('button', {
      name: /deconectare|logout/i,
    });
    await logoutButton.click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });

    await page.waitForLoadState('networkidle');

    // Reset cookie to RO to prove DB preference wins for authenticated users
    await selectLanguage(page, 'ro');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ro', {
      timeout: 10000,
    });

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]').first();
    const teacherTab = page.getByRole('button', { name: /Profesor/i });

    await teacherTab.click();
    await emailInput.fill(testTeacher.email);
    await passwordInput.fill(testTeacher.password);
    await page.getByRole('button', { name: /autentificare/i }).click();

    await expect(page).toHaveURL(/\/teacher/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // profiles.preferred_language = 'en' should override the RO cookie
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(switcherButton(page)).toContainText(/EN\s*·\s*English/i);
  });
});
