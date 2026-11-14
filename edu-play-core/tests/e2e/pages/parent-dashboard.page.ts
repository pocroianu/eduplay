import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Parent Dashboard Page Object Model.
 *
 * The /parent dashboard hosts the standard dashboard shell with a notification
 * bell in the shell header that opens a dropdown of recent notifications.
 */
export class ParentDashboardPage extends BasePage {
  readonly welcomeHeading: Locator;
  readonly notificationBell: Locator;
  readonly notificationDropdown: Locator;
  readonly viewAllNotificationsLink: Locator;
  readonly markAllAsReadButton: Locator;
  readonly emptyDropdownState: Locator;

  constructor(page: Page) {
    super(page);

    this.welcomeHeading = page.getByRole('heading', {
      level: 1,
      name: /bună/i,
    });
    this.notificationBell = page.getByRole('button', { name: /notificări/i });
    this.notificationDropdown = page.getByRole('heading', {
      name: /notificări recente/i,
    });
    this.viewAllNotificationsLink = page.getByRole('link', {
      name: /vezi toate notificările/i,
    });
    this.markAllAsReadButton = page.getByRole('button', {
      name: /marchează toate ca citite/i,
    });
    this.emptyDropdownState = page.getByText(/nicio notificare nouă/i);
  }

  get urlPattern(): string {
    return '/parent';
  }

  async goto(): Promise<void> {
    await this.page.goto('/parent');
    await this.waitForPageLoad();
  }

  /**
   * Click the notification bell to open the dropdown.
   */
  async openNotificationDropdown(): Promise<void> {
    await this.notificationBell.click();
    await expect(this.notificationDropdown).toBeVisible();
  }

  /**
   * Read the unread badge count from the bell. Returns 0 when the badge is absent.
   * The badge displays "99+" when count exceeds 99 — that's surfaced verbatim.
   */
  async getUnreadBadgeCount(): Promise<string> {
    const ariaLabel = (await this.notificationBell.getAttribute('aria-label')) ?? '';
    const match = ariaLabel.match(/\((\d+)\s+necitite\)/i);
    return match ? match[1] : '0';
  }

  /**
   * Returns true when the bell shows an unread badge marker.
   */
  async hasUnreadBadge(): Promise<boolean> {
    const ariaLabel = (await this.notificationBell.getAttribute('aria-label')) ?? '';
    return /necitite/i.test(ariaLabel);
  }

  /**
   * Locate a notification row inside the dropdown by its title text.
   */
  notificationItem(title: string | RegExp): Locator {
    return this.page.getByRole('button').filter({ hasText: title });
  }

  /**
   * Click a notification inside the dropdown — server-marks it as read and closes the dropdown.
   */
  async clickNotification(title: string | RegExp): Promise<void> {
    await this.notificationItem(title).first().click();
  }

  /**
   * Click the "Marchează toate ca citite" button inside the dropdown.
   */
  async markAllAsRead(): Promise<void> {
    await this.markAllAsReadButton.click();
  }

  /**
   * Click the "Vezi toate notificările" footer link.
   */
  async goToAllNotifications(): Promise<void> {
    await this.viewAllNotificationsLink.click();
    await this.page.waitForURL(/\/parent\/notifications/);
  }

  /**
   * Confirm the parent dashboard rendered with the bell visible.
   */
  async verifyDashboardLoaded(): Promise<void> {
    await expect(this.welcomeHeading).toBeVisible();
    await expect(this.notificationBell).toBeVisible();
  }
}
