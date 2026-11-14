import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page Object Model for the Forgot Password page.
 * Handles all interactions with /forgot-password
 */
export class ForgotPasswordPage extends BasePage {
  readonly emailInput: Locator;
  readonly submitButton: Locator;
  readonly successMessage: Locator;
  readonly errorMessage: Locator;
  readonly loginLink: Locator;
  readonly sendAgainButton: Locator;
  readonly pageHeading: Locator;

  constructor(page: Page) {
    super(page);

    this.emailInput = page.getByTestId('email-input');
    this.submitButton = page.getByTestId('submit-button');
    this.successMessage = page.getByTestId('success-message');
    this.errorMessage = page.getByTestId('error-message');
    this.loginLink = page.getByRole('link', { name: /autentificare/i });
    this.sendAgainButton = page.getByRole('button', { name: /trimite din nou/i });
    this.pageHeading = page.getByRole('heading', { name: /ai uitat parola/i });
  }

  get urlPattern(): string {
    return '/forgot-password';
  }

  async goto(): Promise<void> {
    await this.page.goto('/forgot-password');
    await this.waitForPageLoad();
  }

  /**
   * Navigate with email pre-filled (as if redirected from expired token page)
   */
  async gotoWithEmail(email: string): Promise<void> {
    await this.page.goto(`/forgot-password?email=${encodeURIComponent(email)}`);
    await this.waitForPageLoad();
  }

  /**
   * Fill the email input
   */
  async fillEmail(email: string): Promise<void> {
    await this.fillInput(this.emailInput, email);
  }

  /**
   * Submit the forgot password form
   */
  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  /**
   * Complete the forgot password flow (fill email + submit)
   */
  async requestPasswordReset(email: string): Promise<void> {
    await this.fillEmail(email);
    await this.submit();
  }

  /**
   * Get the current email input value
   */
  async getEmailValue(): Promise<string> {
    return this.emailInput.inputValue();
  }

  /**
   * Check if the success message is visible
   */
  async isSuccessVisible(): Promise<boolean> {
    return this.successMessage.isVisible();
  }

  /**
   * Check if the error message is visible
   */
  async isErrorVisible(): Promise<boolean> {
    return this.errorMessage.isVisible();
  }

  /**
   * Get the error message text
   */
  async getErrorText(): Promise<string | null> {
    if (await this.isErrorVisible()) {
      return this.errorMessage.textContent();
    }
    return null;
  }

  /**
   * Click "Send Again" after success
   */
  async clickSendAgain(): Promise<void> {
    await this.sendAgainButton.click();
  }

  /**
   * Verify the page is loaded correctly
   */
  async verifyPageLoaded(): Promise<void> {
    await expect(this.pageHeading).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  /**
   * Wait for the success state
   */
  async waitForSuccess(): Promise<void> {
    await expect(this.successMessage).toBeVisible({ timeout: 10000 });
  }

  /**
   * Wait for the error state
   */
  async waitForError(): Promise<void> {
    await expect(this.errorMessage).toBeVisible({ timeout: 10000 });
  }
}
