import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class TeacherAssignmentsPage extends BasePage {
  readonly assignmentsNavLink: Locator;
  readonly createNewButton: Locator;
  readonly createFirstButton: Locator;

  readonly filterAll: Locator;
  readonly filterActive: Locator;
  readonly filterOverdue: Locator;
  readonly filterMandatory: Locator;

  readonly assignmentCards: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    super(page);

    this.assignmentsNavLink = page.getByRole('link', { name: /teme|assignments/i });
    this.createNewButton = page.getByRole('link', { name: /new assignment|temă nouă/i });
    this.createFirstButton = page.getByRole('link', {
      name: /create first assignment|creează prima temă/i,
    });

    this.filterAll = page.getByRole('button', { name: /^(all|toate)$/i });
    this.filterActive = page.getByRole('button', { name: /^(active|active)$/i });
    this.filterOverdue = page.getByRole('button', { name: /^(overdue|expirate)$/i });
    this.filterMandatory = page.getByRole('button', { name: /^(mandatory|obligatorii)$/i });

    this.assignmentCards = page.locator('[data-testid="assignment-card"]');
    this.emptyState = page.locator('[data-testid="empty-state"]');
  }

  get urlPattern(): string {
    return '/teacher/assignments';
  }

  async goto(): Promise<void> {
    await this.page.goto('/teacher/assignments');
    await this.waitForPageLoad();
  }

  async getAssignmentCount(): Promise<number> {
    return this.assignmentCards.count();
  }

  async getAssignmentByGameTitle(title: string): Promise<Locator> {
    return this.assignmentCards.filter({ hasText: title });
  }

  async clickEditOnAssignment(gameTitle: string): Promise<void> {
    const card = this.assignmentCards.filter({ hasText: gameTitle });
    await card.getByRole('link', { name: /edit|editează/i }).click();
  }

  async clickDeleteOnAssignment(gameTitle: string): Promise<void> {
    const card = this.assignmentCards.filter({ hasText: gameTitle });
    await card.getByRole('button', { name: /delete|sterge|șterge/i }).click();
  }

  private getConfirmDialog() {
    return this.page.locator('[role="dialog"], [role="alertdialog"]');
  }

  async confirmDelete(): Promise<void> {
    const dialog = this.getConfirmDialog();
    await dialog.getByRole('button', { name: /^(delete|sterge|șterge)$/i }).click();
  }

  async cancelDelete(): Promise<void> {
    const dialog = this.getConfirmDialog();
    await dialog.getByRole('button', { name: /^(cancel|anulează)$/i }).click();
  }

  async verifyAssignmentExists(gameTitle: string): Promise<void> {
    const card = await this.getAssignmentByGameTitle(gameTitle);
    await expect(card).toBeVisible();
  }

  async verifyAssignmentNotExists(gameTitle: string): Promise<void> {
    const card = await this.getAssignmentByGameTitle(gameTitle);
    await expect(card).toHaveCount(0);
  }

  async applyFilter(filter: 'all' | 'active' | 'overdue' | 'mandatory'): Promise<void> {
    const filterMap = {
      all: this.filterAll,
      active: this.filterActive,
      overdue: this.filterOverdue,
      mandatory: this.filterMandatory,
    };
    await filterMap[filter].click();
  }
}
