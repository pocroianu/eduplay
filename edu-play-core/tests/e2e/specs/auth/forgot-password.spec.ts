import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Forgot Password E2E Tests
 *
 * Tests the complete password reset flow:
 * - Forgot password form (request reset)
 * - Reset password form (set new password)
 * - Rate limiting
 * - Error handling (expired/invalid tokens)
 * - Password strength indicator
 * - Navigation links from login page
 */

test.describe('Forgot Password - Navigation', () => {
  test('should display "Forgot Password?" link on teacher login tab', async ({
    loginPage,
  }) => {
    await loginPage.goto();
    await loginPage.selectTeacherTab();

    const forgotPasswordLink = loginPage.page.getByTestId(
      'teacher-forgot-password-link'
    );
    await expect(forgotPasswordLink).toBeVisible();
    await expect(forgotPasswordLink).toHaveText('Am uitat parola');
  });

  test('should display "Forgot Password?" link on parent login tab', async ({
    loginPage,
  }) => {
    await loginPage.goto();
    await loginPage.selectParentTab();

    const forgotPasswordLink = loginPage.page.getByTestId(
      'parent-forgot-password-link'
    );
    await expect(forgotPasswordLink).toBeVisible();
    await expect(forgotPasswordLink).toHaveText('Am uitat parola');
  });

  test('should NOT display "Forgot Password?" link on student PIN screen', async ({
    loginPage,
  }) => {
    await loginPage.goto();
    await loginPage.selectStudentTab();

    // The student PIN screen lives at /login/elev and has no forgot-password link
    const forgotPasswordLink = loginPage.page.getByText('Am uitat parola');
    await expect(forgotPasswordLink).not.toBeVisible();
  });

  test('should navigate to forgot password page from teacher login', async ({
    loginPage,
    page,
  }) => {
    await loginPage.goto();
    await loginPage.selectTeacherTab();

    const forgotPasswordLink = loginPage.page.getByTestId(
      'teacher-forgot-password-link'
    );
    await forgotPasswordLink.click();

    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test('should navigate to forgot password page from parent login', async ({
    loginPage,
    page,
  }) => {
    await loginPage.goto();
    await loginPage.selectParentTab();

    const forgotPasswordLink = loginPage.page.getByTestId(
      'parent-forgot-password-link'
    );
    await forgotPasswordLink.click();

    await expect(page).toHaveURL(/\/forgot-password/);
  });
});

test.describe('Forgot Password - Form', () => {
  test.beforeEach(async ({ forgotPasswordPage }) => {
    await forgotPasswordPage.goto();
  });

  test('should display the forgot password form correctly', async ({
    forgotPasswordPage,
  }) => {
    await forgotPasswordPage.verifyPageLoaded();
  });

  test('should validate empty email', async ({ forgotPasswordPage }) => {
    // Submit without entering email
    await forgotPasswordPage.submit();

    // Should show validation error
    const errorText = forgotPasswordPage.page.locator(
      'text=/email.*obligatorie/i'
    );
    await expect(errorText).toBeVisible({ timeout: 5000 });
  });

  test('should validate invalid email format', async ({
    forgotPasswordPage,
  }) => {
    await forgotPasswordPage.fillEmail('not-an-email');
    await forgotPasswordPage.submit();

    // Should show email validation error
    const errorText = forgotPasswordPage.page.locator(
      'text=/email.*valid/i'
    );
    await expect(errorText).toBeVisible({ timeout: 5000 });
  });

  test('should show success message for valid email', async ({
    forgotPasswordPage,
  }) => {
    await forgotPasswordPage.requestPasswordReset(`valid-${Date.now()}@example.com`);
    await forgotPasswordPage.waitForSuccess();

    // Success message should not reveal if email exists
    const successMessage = forgotPasswordPage.successMessage;
    await expect(successMessage).toContainText('Verifică-ți email-ul');
  });

  test('should show same success message for non-existent email', async ({
    forgotPasswordPage,
  }) => {
    // Should show same success even for non-existent email (security: no enumeration)
    await forgotPasswordPage.requestPasswordReset(
      `nonexistent-${Date.now()}@example.com`
    );
    await forgotPasswordPage.waitForSuccess();

    const successMessage = forgotPasswordPage.successMessage;
    await expect(successMessage).toContainText('Verifică-ți email-ul');
  });

  test('should pre-fill email from URL query parameter', async ({
    forgotPasswordPage,
  }) => {
    const testEmail = 'prefilled@example.com';
    await forgotPasswordPage.gotoWithEmail(testEmail);

    const emailValue = await forgotPasswordPage.getEmailValue();
    expect(emailValue).toBe(testEmail);
  });

  test('should allow sending reset again after success', async ({
    forgotPasswordPage,
  }) => {
    await forgotPasswordPage.requestPasswordReset(`resend-${Date.now()}@example.com`);
    await forgotPasswordPage.waitForSuccess();

    // Click "Send Again"
    await forgotPasswordPage.clickSendAgain();

    // Form should be visible again
    await expect(forgotPasswordPage.emailInput).toBeVisible();
  });

  test('should have link back to login page', async ({
    forgotPasswordPage,
    page,
  }) => {
    await expect(forgotPasswordPage.loginLink).toBeVisible();
    await forgotPasswordPage.loginLink.click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Forgot Password - Rate Limiting', () => {
  test('should block after 3 reset requests within 1 hour', async ({
    forgotPasswordPage,
  }) => {
    const email = `ratelimit-${Date.now()}@example.com`;
    await forgotPasswordPage.goto();

    // Make 3 successful requests
    for (let i = 0; i < 3; i++) {
      await forgotPasswordPage.requestPasswordReset(email);
      await forgotPasswordPage.waitForSuccess();
      // Go back to form for next attempt
      await forgotPasswordPage.clickSendAgain();
    }

    // 4th request should be rate limited
    await forgotPasswordPage.requestPasswordReset(email);
    await forgotPasswordPage.waitForError();

    const errorText = await forgotPasswordPage.getErrorText();
    expect(errorText).toMatch(/prea multe încercări/i);
  });
});

test.describe('Reset Password - Error States', () => {
  test('should show error page for expired/invalid token', async ({
    resetPasswordPage,
  }) => {
    await resetPasswordPage.gotoWithError('Token expired');
    await resetPasswordPage.verifyErrorState();
  });

  test('should display "Request New Link" button on error', async ({
    resetPasswordPage,
  }) => {
    await resetPasswordPage.gotoWithError('Token expired');
    await expect(resetPasswordPage.requestNewLinkButton).toBeVisible();
  });

  test('should navigate to forgot password when clicking "Request New Link"', async ({
    resetPasswordPage,
    page,
  }) => {
    await resetPasswordPage.gotoWithError('Token expired');
    await resetPasswordPage.clickRequestNewLink();
    await expect(page).toHaveURL(/\/forgot-password/);
  });
});

test.describe('Reset Password - Password Strength Indicator', () => {
  /**
   * Note: These tests navigate to /reset-password without a valid Supabase session.
   * The form will render but password update will fail (no auth session).
   * This is fine for testing the UI behavior of the password strength indicator.
   */
  test.beforeEach(async ({ resetPasswordPage }) => {
    // Navigate directly to reset password page (no error params = shows form)
    await resetPasswordPage.goto();
  });

  test('should show password strength indicator when typing', async ({
    resetPasswordPage,
  }) => {
    await resetPasswordPage.fillPassword('a');

    // Strength indicator should appear
    const strengthText = resetPasswordPage.page.locator(
      'text=Puterea parolei'
    );
    await expect(strengthText).toBeVisible();
  });

  test('should show requirement checklist', async ({
    resetPasswordPage,
  }) => {
    await resetPasswordPage.fillPassword('Test');

    // Check that requirement indicators are visible
    const statuses = await resetPasswordPage.getAllRequirementStatuses();

    // "Test" meets hasUppercase and hasLowercase but not minLength, hasNumber, hasSpecial
    expect(statuses.hasUppercase).toBe(true);
    expect(statuses.hasLowercase).toBe(true);
    expect(statuses.minLength).toBe(false);
    expect(statuses.hasNumber).toBe(false);
    expect(statuses.hasSpecial).toBe(false);
  });

  test('should mark all requirements as met for strong password', async ({
    resetPasswordPage,
  }) => {
    await resetPasswordPage.fillPassword('StrongPass1!');

    const statuses = await resetPasswordPage.getAllRequirementStatuses();

    expect(statuses.minLength).toBe(true);
    expect(statuses.hasUppercase).toBe(true);
    expect(statuses.hasLowercase).toBe(true);
    expect(statuses.hasNumber).toBe(true);
    expect(statuses.hasSpecial).toBe(true);
  });

  test('should show password mismatch error', async ({
    resetPasswordPage,
  }) => {
    await resetPasswordPage.fillPassword('StrongPass1!');
    await resetPasswordPage.fillConfirmPassword('DifferentPass1!');
    await resetPasswordPage.submit();

    // Should show password mismatch error
    const mismatchError = resetPasswordPage.page.locator(
      'text=/parolele nu se potrivesc/i'
    );
    await expect(mismatchError).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Reset Password - Form Validation', () => {
  test.beforeEach(async ({ resetPasswordPage }) => {
    await resetPasswordPage.goto();
  });

  test('should validate weak password', async ({ resetPasswordPage }) => {
    await resetPasswordPage.fillPassword('weak');
    await resetPasswordPage.fillConfirmPassword('weak');
    await resetPasswordPage.submit();

    // Should show validation errors for unmet requirements
    const errorText = resetPasswordPage.page.locator(
      'text=/cel puțin 8 caractere/i'
    ).first();
    await expect(errorText).toBeVisible({ timeout: 5000 });
  });

  test('should toggle password visibility', async ({
    resetPasswordPage,
  }) => {
    await resetPasswordPage.fillPassword('TestPassword1!');

    // Password should be hidden by default
    await expect(resetPasswordPage.passwordInput).toHaveAttribute(
      'type',
      'password'
    );

    // Toggle visibility
    await resetPasswordPage.togglePasswordVisibility();

    // Password should now be visible
    await expect(resetPasswordPage.passwordInput).toHaveAttribute(
      'type',
      'text'
    );
  });
});

test.describe('Forgot Password - Accessibility', () => {
  test('should have proper heading structure', async ({
    forgotPasswordPage,
  }) => {
    await forgotPasswordPage.goto();

    const heading = forgotPasswordPage.page.getByRole('heading', {
      name: /ai uitat parola/i,
    });
    await expect(heading).toBeVisible();
  });

  test('should be keyboard navigable', async ({
    forgotPasswordPage,
    page,
  }) => {
    await forgotPasswordPage.goto();

    // Focus email input
    await forgotPasswordPage.emailInput.focus();
    await expect(forgotPasswordPage.emailInput).toBeFocused();

    // Tab to submit button
    await page.keyboard.press('Tab');
    await expect(forgotPasswordPage.submitButton).toBeFocused();
  });

  test('should submit form with Enter key', async ({
    forgotPasswordPage,
  }) => {
    await forgotPasswordPage.goto();
    await forgotPasswordPage.fillEmail(`enter-${Date.now()}@example.com`);

    // Press Enter to submit
    await forgotPasswordPage.page.keyboard.press('Enter');

    // Should show success message
    await forgotPasswordPage.waitForSuccess();
  });
});
