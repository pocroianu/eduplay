import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Teacher Dashboard Page Object Model
 * Handles all interactions with the teacher dashboard and navigation
 */
export class TeacherDashboardPage extends BasePage {
  // Navigation sidebar
  readonly sidebar: Locator;
  readonly dashboardLink: Locator;
  readonly classesLink: Locator;
  readonly studentsLink: Locator;
  readonly gamesLink: Locator;
  readonly analyticsLink: Locator;
  readonly logoutButton: Locator;

  // Dashboard content
  readonly welcomeHeading: Locator;
  readonly statsCards: Locator;
  readonly recentActivity: Locator;

  // User info
  readonly userAvatar: Locator;
  readonly userName: Locator;

  constructor(page: Page) {
    super(page);

    // Sidebar navigation
    this.sidebar = page.locator('[data-testid="sidebar"]');
    this.dashboardLink = page.getByRole('link', { name: /tablou de bord|dashboard/i });
    this.classesLink = page.getByRole('link', { name: /clase/i });
    this.studentsLink = page.getByRole('link', { name: /elevi/i });
    this.gamesLink = page.getByRole('link', { name: /jocuri/i });
    this.analyticsLink = page.getByRole('link', { name: /statistici|analytics/i });
    this.logoutButton = page.getByRole('button', { name: /deconectare|logout/i });

    // Dashboard content
    this.welcomeHeading = page.getByRole('heading', { level: 1 });
    this.statsCards = page.locator('[data-testid="stats-card"]');
    this.recentActivity = page.locator('[data-testid="recent-activity"]');

    // User info
    this.userAvatar = page.locator('[data-testid="user-avatar"]');
    this.userName = page.locator('[data-testid="user-name"]');
  }

  get urlPattern(): string {
    return '/teacher';
  }

  async goto(): Promise<void> {
    await this.page.goto('/teacher');
    await this.waitForPageLoad();
  }

  /**
   * Navigate to Classes page
   */
  async goToClasses(): Promise<void> {
    await this.classesLink.click();
    await expect(this.page).toHaveURL(/\/teacher\/classes/);
  }

  /**
   * Navigate to Students page
   */
  async goToStudents(): Promise<void> {
    await this.studentsLink.click();
    await expect(this.page).toHaveURL(/\/teacher\/students/);
  }

  /**
   * Navigate to Games page
   */
  async goToGames(): Promise<void> {
    await this.gamesLink.click();
    await expect(this.page).toHaveURL(/\/teacher\/games/);
  }

  /**
   * Navigate to Analytics page
   */
  async goToAnalytics(): Promise<void> {
    await this.analyticsLink.click();
    await expect(this.page).toHaveURL(/\/teacher\/analytics/);
  }

  /**
   * Logout from the application
   */
  async logout(): Promise<void> {
    await this.logoutButton.click();
    await expect(this.page).toHaveURL(/\/login/);
  }

  /**
   * Get the number of stat cards displayed
   */
  async getStatsCardCount(): Promise<number> {
    return this.statsCards.count();
  }

  /**
   * Get stat card value by title
   */
  async getStatValue(title: string): Promise<string | null> {
    const card = this.page.locator('[data-testid="stats-card"]').filter({ hasText: title });
    const value = card.locator('[data-testid="stat-value"]');
    return value.textContent();
  }

  /**
   * Verify the dashboard is loaded correctly
   */
  async verifyDashboardLoaded(): Promise<void> {
    await expect(this.welcomeHeading).toBeVisible();
    // Dashboard should have navigation
    await expect(this.classesLink).toBeVisible();
    await expect(this.studentsLink).toBeVisible();
    await expect(this.gamesLink).toBeVisible();
  }

  /**
   * Check if user is logged in as teacher
   */
  async isTeacherLoggedIn(): Promise<boolean> {
    try {
      await this.page.waitForURL(/\/teacher/, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}
