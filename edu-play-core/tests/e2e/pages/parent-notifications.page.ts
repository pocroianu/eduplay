import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Parent Notifications Page Object Model.
 *
 * The /parent/notifications page lists every notification with full body
 * copy, a per-row "mark as read" button (icon-only, aria-label="Marchează ca citită"),
 * and a bulk "Marchează toate ca citite" button when at least one is unread.
 */
export class ParentNotificationsPage extends BasePage {
  readonly heading: Locator;
  readonly summaryCount: Locator;
  readonly markAllAsReadButton: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    super(page);

    this.heading = page.getByRole('main').getByRole('heading', {
      level: 1,
      name: /^notificări$/i,
    });
    this.summaryCount = page
      .locator('h1:has-text("Notificări")')
      .locator('..')
      .locator('p')
      .first();
    this.markAllAsReadButton = page.getByRole('button', {
      name: /marchează toate ca citite/i,
    });
    this.emptyState = page.getByRole('heading', {
      name: /nu ai notificări încă/i,
    });
  }

  get urlPattern(): string {
    return '/parent/notifications';
  }

  async goto(): Promise<void> {
    await this.page.goto('/parent/notifications');
    await this.waitForPageLoad();
  }

  /**
   * Locate a notification row by its title text.
   * Each row is the framer-motion wrapper that contains the title, message,
   * student chip, and per-row actions.
   */
  notificationRow(title: string | RegExp): Locator {
    return this.page.getByTestId('parent-notification-row').filter({
      has: this.page.getByText(title),
    });
  }

  /**
   * Click the per-row "mark as read" icon button on the matching notification.
   * The button only renders for unread items.
   */
  async markRowAsRead(title: string | RegExp): Promise<void> {
    const row = this.notificationRow(title);
    await row.getByRole('button', { name: /marchează ca citită/i }).click();
  }

  /**
   * Click the bulk "Marchează toate ca citite" button.
   */
  async markAllAsRead(): Promise<void> {
    await this.markAllAsReadButton.click();
  }

  async getNotificationCount(): Promise<number> {
    return this.page.getByTestId('parent-notification-row').count();
  }

  async verifyOnPage(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }

  async verifyEmptyState(): Promise<void> {
    await expect(this.emptyState).toBeVisible();
  }
}
