import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page Object Model for the Reset Password page.
 * Handles all interactions with /reset-password
 */
export class ResetPasswordPage extends BasePage {
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly loginLink: Locator;
  readonly requestNewLinkButton: Locator;
  readonly pageHeading: Locator;
  readonly passwordStrengthLabel: Locator;
  readonly showPasswordButton: Locator;
  readonly showConfirmPasswordButton: Locator;

  constructor(page: Page) {
    super(page);

    this.passwordInput = page.getByTestId('password-input');
    this.confirmPasswordInput = page.getByTestId('confirm-password-input');
    this.submitButton = page.getByTestId('submit-button');
    this.errorMessage = page.getByTestId('error-message');
    this.loginLink = page.getByRole('link', { name: /autentificare/i });
    this.requestNewLinkButton = page.getByTestId('request-new-link');
    // AuthShell renders the page title as h2; the error card renders its own h3.
    this.pageHeading = page.getByRole('heading', { level: 2 });
    this.passwordStrengthLabel = page.locator('text=Puterea parolei').locator('..').locator('p').last();
    this.showPasswordButton = page.getByLabel(/arată parola/i).first();
    this.showConfirmPasswordButton = page.getByLabel(/arată parola/i).last();
  }

  get urlPattern(): string {
    return '/reset-password';
  }

  async goto(): Promise<void> {
    await this.page.goto('/reset-password');
    await this.waitForPageLoad();
  }

  /**
   * Navigate with error params (simulates expired/invalid token)
   */
  async gotoWithError(errorDescription?: string): Promise<void> {
    const params = new URLSearchParams();
    params.set('error', 'access_denied');
    if (errorDescription) {
      params.set('error_description', errorDescription);
    }
    await this.page.goto(`/reset-password?${params.toString()}`);
    await this.waitForPageLoad();
  }

  /**
   * Fill the password input
   */
  async fillPassword(password: string): Promise<void> {
    await this.fillInput(this.passwordInput, password);
  }

  /**
   * Fill the confirm password input
   */
  async fillConfirmPassword(password: string): Promise<void> {
    await this.fillInput(this.confirmPasswordInput, password);
  }

  /**
   * Submit the reset password form
   */
  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  /**
   * Complete the reset password flow
   */
  async resetPassword(password: string): Promise<void> {
    await this.fillPassword(password);
    await this.fillConfirmPassword(password);
    await this.submit();
  }

  /**
   * Get the password strength label text
   */
  async getPasswordStrength(): Promise<string | null> {
    return this.passwordStrengthLabel.textContent();
  }

  /**
   * Check if the error message is visible
   */
  async isErrorVisible(): Promise<boolean> {
    return this.errorMessage.isVisible();
  }

  /**
   * Check if "Request New Link" button is visible
   */
  async isRequestNewLinkVisible(): Promise<boolean> {
    return this.requestNewLinkButton.isVisible();
  }

  /**
   * Click "Request New Link" button
   */
  async clickRequestNewLink(): Promise<void> {
    await this.requestNewLinkButton.click();
  }

  /**
   * Toggle password visibility
   */
  async togglePasswordVisibility(): Promise<void> {
    await this.showPasswordButton.click();
  }

  /**
   * Get requirement check status
   */
  async getRequirementStatus(requirementKey: string): Promise<boolean> {
    const requirement = this.page.getByTestId(`requirement-${requirementKey}`);
    const met = await requirement.getAttribute('data-met');
    return met === 'true';
  }

  /**
   * Get all requirement statuses
   */
  async getAllRequirementStatuses(): Promise<Record<string, boolean>> {
    const requirements = ['minLength', 'hasUppercase', 'hasLowercase', 'hasNumber', 'hasSpecial'];
    const statuses: Record<string, boolean> = {};

    for (const req of requirements) {
      statuses[req] = await this.getRequirementStatus(req);
    }

    return statuses;
  }

  /**
   * Verify the page shows the error state for invalid/expired tokens
   */
  async verifyErrorState(): Promise<void> {
    // The error card renders an h3 with "Link invalid sau expirat".
    const errorHeading = this.page.getByRole('heading', { level: 3 });
    await expect(errorHeading).toContainText(/invalid|expirat/i);
    await expect(this.requestNewLinkButton).toBeVisible();
  }

  /**
   * Verify the page shows the reset form
   */
  async verifyFormLoaded(): Promise<void> {
    await expect(this.pageHeading).toContainText(/parolă/i);
    await expect(this.passwordInput).toBeVisible();
    await expect(this.confirmPasswordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }
}
