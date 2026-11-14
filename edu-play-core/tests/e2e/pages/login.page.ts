import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Login Page Object Model.
 *
 * The /login page (standard mode) hosts Profesor + Părinte tabs and a card
 * linking out to /login/elev (kid mode) where the student PIN pad lives.
 */
export class LoginPage extends BasePage {
  // Segmented tabs on /login
  readonly teacherTab: Locator;
  readonly parentTab: Locator;

  // Teacher login form
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly registerLink: Locator;

  // Parent login form (same component instance, different idPrefix)
  readonly parentEmailInput: Locator;
  readonly parentPasswordInput: Locator;
  readonly parentLoginButton: Locator;

  // Card linking to /login/elev
  readonly studentEntryLink: Locator;

  // Student PIN pad (present on /login/elev)
  readonly usernameInput: Locator;
  readonly pinSubmitButton: Locator;
  readonly pinBackspaceButton: Locator;

  // Common elements
  readonly pageTitle: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);

    this.teacherTab = page.getByRole('button', { name: /Profesor/i });
    this.parentTab = page.getByRole('button', { name: /Părinte/i });

    this.emailInput = page.locator('input[type="email"]');
    this.passwordInput = page.locator('input[type="password"]').first();
    this.loginButton = page.getByRole('button', { name: /autentificare/i });
    this.registerLink = page.getByRole('link', { name: /creează unul/i });

    this.parentEmailInput = this.emailInput;
    this.parentPasswordInput = this.passwordInput;
    this.parentLoginButton = this.loginButton;

    this.studentEntryLink = page.getByTestId('student-login-entry');

    this.usernameInput = page.getByPlaceholder(/ex: andrei_m/i);
    this.pinSubmitButton = page.getByRole('button', { name: /trimite pin-ul/i });
    this.pinBackspaceButton = page.getByRole('button', { name: /șterge/i });

    this.pageTitle = page.getByRole('heading', { name: /Bun venit/i });
    this.errorMessage = page.locator('[role="alert"]');
  }

  get urlPattern(): string {
    return '/login';
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
    await this.waitForPageLoad();
  }

  async selectTeacherTab(): Promise<void> {
    await this.teacherTab.click();
    await expect(this.emailInput).toBeVisible();
  }

  async selectParentTab(): Promise<void> {
    await this.parentTab.click();
    await expect(this.parentEmailInput).toBeVisible();
  }

  /**
   * Navigate to the kid-mode student PIN screen at /login/elev.
   */
  async selectStudentTab(): Promise<void> {
    await this.studentEntryLink.click();
    await this.page.waitForURL(/\/login\/elev/, { timeout: 5000 });
  }

  async loginAsTeacher(email: string, password: string): Promise<void> {
    await this.selectTeacherTab();
    await this.loginAsStandardUser(email, password);
  }

  async loginAsStandardUser(email: string, password: string): Promise<void> {
    if (!(await this.emailInput.isVisible())) {
      await this.teacherTab.click();
      await expect(this.emailInput).toBeVisible();
    }

    await this.fillInput(this.emailInput, email);
    await this.fillInput(this.passwordInput, password);
    await this.loginButton.click();
  }

  async loginAsStudent(username: string, pin: string): Promise<void> {
    if (!this.page.url().includes('/login/elev')) {
      await this.selectStudentTab();
    }
    await this.fillInput(this.usernameInput, username);

    for (const digit of pin) {
      await this.page.getByRole('button', { name: new RegExp(`^cifra ${digit}$`, 'i') }).click();
    }

    await this.pinSubmitButton.click();
  }

  async clearPin(): Promise<void> {
    await this.pinBackspaceButton.click();
  }

  async loginAsParent(email: string, password: string): Promise<void> {
    await this.selectParentTab();
    await this.loginAsStandardUser(email, password);
  }

  async goToRegister(): Promise<void> {
    await this.registerLink.click();
  }

  async hasErrorMessage(): Promise<boolean> {
    return this.errorMessage.isVisible();
  }

  async getErrorMessageText(): Promise<string | null> {
    if (await this.hasErrorMessage()) {
      return this.errorMessage.textContent();
    }
    return null;
  }

  async waitForLoginSuccess(expectedPath: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(expectedPath), { timeout: 15000 });
  }

  async verifyPageLoaded(): Promise<void> {
    await expect(this.pageTitle).toBeVisible();
    await expect(this.teacherTab).toBeVisible();
    await expect(this.parentTab).toBeVisible();
    await expect(this.studentEntryLink).toBeVisible();
  }
}
