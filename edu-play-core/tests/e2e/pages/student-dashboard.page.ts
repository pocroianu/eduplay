import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Student Dashboard Page Object Model
 * Handles all interactions with the student-facing UI
 * Note: Student UI has specific requirements (64px+ touch targets, 18px+ fonts, animations)
 */
export class StudentDashboardPage extends BasePage {
  // Navigation (kid-friendly)
  readonly homeButton: Locator;
  readonly gamesButton: Locator;
  readonly achievementsButton: Locator;
  readonly profileButton: Locator;

  // Dashboard content
  readonly welcomeMessage: Locator;
  readonly gameCards: Locator;
  readonly progressIndicator: Locator;
  readonly achievementBadges: Locator;

  // Game selection
  readonly gameGrid: Locator;
  readonly categoryFilters: Locator;

  constructor(page: Page) {
    super(page);

    // Navigation buttons (should be large for kids)
    this.homeButton = page.getByRole('button', { name: /acasă|home/i });
    this.gamesButton = page.getByRole('link', { name: /jocuri|games/i });
    this.achievementsButton = page.getByRole('link', { name: /premii|achievements/i });
    this.profileButton = page.getByRole('button', { name: /profil|profile/i });

    // Dashboard content
    this.welcomeMessage = page.locator('[data-testid="welcome-message"]');
    this.gameCards = page.locator('[data-testid="game-card"]');
    this.progressIndicator = page.locator('[data-testid="progress-indicator"]');
    this.achievementBadges = page.locator('[data-testid="achievement-badge"]');

    // Game selection
    this.gameGrid = page.locator('[data-testid="game-grid"]');
    this.categoryFilters = page.locator('[data-testid="category-filter"]');
  }

  get urlPattern(): string {
    return '/student';
  }

  async goto(): Promise<void> {
    await this.page.goto('/student');
    await this.waitForPageLoad();
  }

  /**
   * Navigate to Games page
   */
  async goToGames(): Promise<void> {
    await this.gamesButton.click();
    await expect(this.page).toHaveURL(/\/student\/games/);
  }

  /**
   * Navigate to Achievements page
   */
  async goToAchievements(): Promise<void> {
    await this.achievementsButton.click();
    await expect(this.page).toHaveURL(/\/student\/achievements/);
  }

  /**
   * Select and start a game by name
   */
  async startGame(gameName: string): Promise<void> {
    const gameCard = this.page.locator('[data-testid="game-card"]').filter({ hasText: gameName });
    await gameCard.click();
    // Wait for game page to load
    await expect(this.page).toHaveURL(/\/games\/\w+/);
  }

  /**
   * Get the count of available games
   */
  async getGameCount(): Promise<number> {
    return this.gameCards.count();
  }

  /**
   * Filter games by category
   */
  async filterByCategory(category: string): Promise<void> {
    const filter = this.categoryFilters.filter({ hasText: category });
    await filter.click();
    await this.page.waitForTimeout(300); // Wait for filter animation
  }

  /**
   * Get the student's current progress (if displayed)
   */
  async getProgress(): Promise<string | null> {
    return this.progressIndicator.textContent();
  }

  /**
   * Get the count of achievement badges
   */
  async getAchievementCount(): Promise<number> {
    return this.achievementBadges.count();
  }

  /**
   * Verify touch targets are at least 64x64px (student UI requirement)
   */
  async verifyTouchTargets(): Promise<void> {
    const buttons = this.page.getByRole('button');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const box = await button.boundingBox();

      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(64);
        expect(box.height).toBeGreaterThanOrEqual(64);
      }
    }
  }

  /**
   * Verify the dashboard is loaded correctly
   */
  async verifyDashboardLoaded(): Promise<void> {
    await expect(this.gamesButton).toBeVisible();
    // Student dashboard should show games or a welcome message
    const hasGames = await this.gameCards.count() > 0;
    const hasWelcome = await this.welcomeMessage.isVisible().catch(() => false);
    expect(hasGames || hasWelcome).toBe(true);
  }

  /**
   * Check if animations are enabled (student UI requirement)
   */
  async hasAnimations(): Promise<boolean> {
    // Check for Framer Motion animation elements
    const animatedElements = this.page.locator('[data-framer-appear-id]');
    return (await animatedElements.count()) > 0;
  }
}
