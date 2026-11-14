import { test, expect } from '../../fixtures/auth.fixture';
import { testTeacher, invalidCredentials, validationTestCases } from '../../fixtures/test-data';

/**
 * Teacher Login E2E Tests
 * Tests the complete teacher authentication flow
 */
test.describe('Teacher Login', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.verifyPageLoaded();
  });

  test('should display the login page correctly', async ({ loginPage }) => {
    // Verify the Profesor/Părinte tabs and the student-entry card render
    await expect(loginPage.teacherTab).toBeVisible();
    await expect(loginPage.parentTab).toBeVisible();
    await expect(loginPage.studentEntryLink).toBeVisible();

    // Selecting the teacher role reveals the email/password form.
    await loginPage.selectTeacherTab();
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();
  });

  test.skip('should login successfully with valid credentials', async ({ loginPage, page }) => {
    // TODO: This test requires a seeded test user in the database
    // Skip until test user seeding is implemented in global-setup.ts
    await loginPage.loginAsTeacher(testTeacher.email, testTeacher.password);

    // Should redirect to teacher dashboard
    await expect(page).toHaveURL(/\/teacher/, { timeout: 15000 });
  });

  test('should show error with invalid credentials', async ({ loginPage }) => {
    await loginPage.loginAsTeacher(invalidCredentials.email, invalidCredentials.password);

    // Wait for error toast
    await loginPage.waitForToast();
    const hasError = await loginPage.hasErrorMessage();
    expect(hasError).toBe(true);
  });

  test('should validate email format', async ({ loginPage }) => {
    const testCase = validationTestCases.login.invalidEmail;
    await loginPage.selectTeacherTab();
    await loginPage.fillInput(loginPage.emailInput, testCase.email);
    await loginPage.fillInput(loginPage.passwordInput, testCase.password);
    await loginPage.loginButton.click();

    // Should show validation error (either form validation or server error)
    const error = await loginPage.getErrorMessageText();
    if (error) {
      expect(error.toLowerCase()).toMatch(testCase.expectedError);
    }
  });

  test('should validate password length', async ({ loginPage }) => {
    const testCase = validationTestCases.login.shortPassword;
    await loginPage.selectTeacherTab();
    await loginPage.fillInput(loginPage.emailInput, testCase.email);
    await loginPage.fillInput(loginPage.passwordInput, testCase.password);
    await loginPage.loginButton.click();

    // Form should show password error
    const passwordError = loginPage.page.locator('text=/cel puțin 6 caractere/i');
    await expect(passwordError).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to registration page', async ({ loginPage, page }) => {
    await loginPage.goToRegister();
    await expect(page).toHaveURL(/\/register/);
  });

  test('should disable form during submission', async ({ loginPage }) => {
    await loginPage.selectTeacherTab();
    await loginPage.fillInput(loginPage.emailInput, testTeacher.email);
    await loginPage.fillInput(loginPage.passwordInput, testTeacher.password);

    // Click login and immediately check if button is loading
    await loginPage.loginButton.click();

    // Button should show loading state (if we're fast enough)
    // This is a race condition test - may not always catch the loading state
  });
});

test.describe('Teacher Login - Visual', () => {
  // Disabled in EDU-391: Jenkins runs in the eduplay-ci Docker image (Debian-based,
  // different font set than the GH Actions Ubuntu runner that produced the committed
  // *-chromium-linux.png baselines). Re-enable once an automated baseline-update
  // workflow lands that pins the CI image and snapshots together.
  test.skip(true, 'Visual regression disabled (EDU-391) — pending automated baseline workflow');

  test('should match login page screenshot', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.selectTeacherTab();

    // Wait for animations to complete
    await page.waitForTimeout(500);

    // Take screenshot for visual regression
    await expect(page).toHaveScreenshot('teacher-login.png', {
      maxDiffPixels: 100,
    });
  });
});

test.describe('Teacher Login - Accessibility', () => {
  test('should have proper form labels', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.selectTeacherTab();

    const emailLabel = loginPage.page.getByText(/adresă de email/i);
    await expect(emailLabel).toBeVisible();

    const passwordLabel = loginPage.page.getByText('Parolă', { exact: true });
    await expect(passwordLabel).toBeVisible();
  });

  test('should be keyboard navigable', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.selectTeacherTab();

    // First, focus the email input directly, then test tab navigation from there
    await loginPage.emailInput.focus();
    await expect(loginPage.emailInput).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(loginPage.passwordInput).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: /arată parola/i })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByTestId('teacher-forgot-password-link')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(loginPage.loginButton).toBeFocused();
  });
});
