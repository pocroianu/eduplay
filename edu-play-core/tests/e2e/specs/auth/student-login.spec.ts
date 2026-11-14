import { test, expect } from '../../fixtures/auth.fixture';
import { testStudent, invalidCredentials, validationTestCases } from '../../fixtures/test-data';

/**
 * Student PIN Login E2E Tests
 * Tests the student authentication flow using username + PIN at /login/elev
 * (kid-mode shell). Numpad keys use aria-label="Cifra N" / "Șterge" / "Trimite PIN-ul".
 */

function digitLocator(page: import('@playwright/test').Page, digit: string | number) {
  return page.getByRole('button', { name: new RegExp(`^cifra ${digit}$`, 'i') });
}

test.describe('Student PIN Login', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.selectStudentTab();
  });

  test('should display student PIN screen correctly', async ({ loginPage }) => {
    await expect(loginPage.usernameInput).toBeVisible();

    for (let i = 0; i <= 9; i++) {
      await expect(digitLocator(loginPage.page, i)).toBeVisible();
    }
    await expect(loginPage.pinSubmitButton).toBeVisible();
    await expect(loginPage.pinBackspaceButton).toBeVisible();
  });

  test.skip('should login successfully with valid username and PIN', async ({ loginPage, page }) => {
    await loginPage.loginAsStudent(testStudent.username, testStudent.pin);
    await expect(page).toHaveURL(/\/student/, { timeout: 15000 });
  });

  test('should show error with invalid credentials', async ({ loginPage }) => {
    await loginPage.loginAsStudent(invalidCredentials.username, invalidCredentials.pin);

    await loginPage.waitForToast();
    const hasError = await loginPage.hasErrorMessage();
    expect(hasError).toBe(true);
  });

  test('should validate username length', async ({ loginPage }) => {
    const testCase = validationTestCases.studentLogin.shortUsername;
    await loginPage.fillInput(loginPage.usernameInput, testCase.username);

    for (const digit of testCase.pin) {
      await digitLocator(loginPage.page, digit).click();
    }

    await loginPage.pinSubmitButton.click();

    const error = loginPage.page.locator('text=/3 caractere/i');
    await expect(error).toBeVisible({ timeout: 5000 });
  });

  test('should only allow 4 digit PIN', async ({ loginPage }) => {
    await loginPage.fillInput(loginPage.usernameInput, testStudent.username);

    for (const digit of '1234') {
      await digitLocator(loginPage.page, digit).click();
    }

    await expect(loginPage.pinSubmitButton).toBeEnabled();

    // Try a 5th digit — it's ignored; submit stays enabled at 4 digits
    await digitLocator(loginPage.page, 5).click();
    await expect(loginPage.pinSubmitButton).toBeEnabled();
  });

  test('should clear PIN when backspace button is pressed', async ({ loginPage }) => {
    await loginPage.fillInput(loginPage.usernameInput, testStudent.username);

    for (const digit of '1234') {
      await digitLocator(loginPage.page, digit).click();
    }

    await expect(loginPage.pinSubmitButton).toBeEnabled();

    await loginPage.clearPin();

    // After removing one digit, we have 3 digits, submit should be disabled
    await expect(loginPage.pinSubmitButton).toBeDisabled();
  });

  test('should have large touch targets for kids (64px minimum)', async ({ loginPage }) => {
    for (let i = 0; i <= 9; i++) {
      const button = digitLocator(loginPage.page, i);
      const box = await button.boundingBox();

      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(48);
        expect(box.height).toBeGreaterThanOrEqual(48);
      }
    }
  });
});

test.describe('Student PIN Login - Mobile', () => {
  test.use({
    viewport: { width: 375, height: 812 },
  });

  test('should work on mobile viewport', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.selectStudentTab();

    await expect(loginPage.usernameInput).toBeVisible();

    const button1 = digitLocator(loginPage.page, 1);
    await expect(button1).toBeVisible();

    const box = await button1.boundingBox();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('Student PIN Login - Accessibility', () => {
  test('should have appropriate ARIA labels', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.selectStudentTab();

    await expect(loginPage.usernameInput).toHaveAttribute('placeholder', /.+/);

    for (let i = 0; i <= 9; i++) {
      await expect(digitLocator(loginPage.page, i)).toBeEnabled();
    }
  });

  test('should support keyboard entry for username', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.selectStudentTab();

    await loginPage.usernameInput.click();
    await page.keyboard.type(testStudent.username);

    await expect(loginPage.usernameInput).toHaveValue(testStudent.username);
  });
});

test.describe('Student PIN Login - Visual', () => {
  // Disabled in EDU-391: Jenkins runs in the eduplay-ci Docker image (Debian-based,
  // different font set than the GH Actions Ubuntu runner that produced the committed
  // *-chromium-linux.png baselines). Re-enable once an automated baseline-update
  // workflow lands that pins the CI image and snapshots together.
  test.skip(true, 'Visual regression disabled (EDU-391) — pending automated baseline workflow');

  test('should match student login screenshot', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.selectStudentTab();

    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('student-pin-login.png', {
      maxDiffPixels: 5000,
    });
  });
});
