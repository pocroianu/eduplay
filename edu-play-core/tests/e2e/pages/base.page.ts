import { Page, Locator } from '@playwright/test';

/**
 * Base Page Object Model
 * All page objects should extend this class
 */
export abstract class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigate to this page
   */
  abstract goto(): Promise<void>;

  /**
   * Get the expected URL pattern for this page
   */
  abstract get urlPattern(): string | RegExp;

  /**
   * Wait for the page to be fully loaded
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    return this.page.title();
  }

  /**
   * Check if current URL matches expected pattern
   */
  async isOnPage(): Promise<boolean> {
    const url = this.page.url();
    if (typeof this.urlPattern === 'string') {
      return url.includes(this.urlPattern);
    }
    return this.urlPattern.test(url);
  }

  /**
   * Take a screenshot with a descriptive name
   */
  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `test-results/screenshots/${name}.png` });
  }

  /**
   * Wait for an element to be visible
   */
  async waitForVisible(locator: Locator, timeout = 10000): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout });
  }

  /**
   * Wait for an element to be hidden
   */
  async waitForHidden(locator: Locator, timeout = 10000): Promise<void> {
    await locator.waitFor({ state: 'hidden', timeout });
  }

  /**
   * Click element with retry logic
   */
  async clickWithRetry(locator: Locator, retries = 3): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        await locator.click({ timeout: 5000 });
        return;
      } catch (error) {
        if (i === retries - 1) throw error;
        await this.page.waitForTimeout(1000);
      }
    }
  }

  /**
   * Fill input with clear first
   */
  async fillInput(locator: Locator, value: string): Promise<void> {
    await locator.click();
    await locator.fill('');
    await locator.fill(value);
  }

  /**
   * Get all toast messages on the page (Chakra UI)
   */
  async getToastMessages(): Promise<string[]> {
    const toasts = this.page.locator('[role="alert"]');
    const count = await toasts.count();
    const messages: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await toasts.nth(i).textContent();
      if (text) messages.push(text);
    }

    return messages;
  }

  /**
   * Wait for toast to appear
   */
  async waitForToast(expectedText?: string): Promise<void> {
    const toastSelector = '[role="alert"]';

    if (expectedText) {
      await this.page
        .locator(toastSelector)
        .filter({ hasText: expectedText })
        .waitFor({ state: 'visible' });
    } else {
      await this.page.locator(toastSelector).first().waitFor({ state: 'visible' });
    }
  }
}
