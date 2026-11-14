import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class TeacherAssignmentComposerPage extends BasePage {
  readonly activitySelect: Locator;
  readonly classSelect: Locator;
  readonly studentSelect: Locator;
  readonly dueDateInput: Locator;
  readonly mandatoryCheckbox: Locator;

  readonly wholeClassButton: Locator;
  readonly individualStudentButton: Locator;

  readonly submitButton: Locator;
  readonly cancelButton: Locator;
  readonly errorAlert: Locator;

  constructor(page: Page) {
    super(page);

    this.activitySelect = page.locator('#activityId');
    this.classSelect = page.locator('#classId');
    this.studentSelect = page.locator('#studentId');
    this.dueDateInput = page.locator('#dueDate');
    this.mandatoryCheckbox = page.locator('input[type="checkbox"]');

    this.wholeClassButton = page.getByRole('button', {
      name: /whole class|toată clasa/i,
    });
    this.individualStudentButton = page.getByRole('button', {
      name: /individual student|elev individual/i,
    });

    this.submitButton = page.getByRole('button', {
      name: /create assignment|save changes|creează tema|salvează/i,
    });
    this.cancelButton = page.getByRole('button', { name: /cancel|anulează/i });
    this.errorAlert = page.locator('[role="alert"]');
  }

  get urlPattern(): string | RegExp {
    return /\/teacher\/assignments\/(new|[0-9a-f-]+)/;
  }

  async goto(): Promise<void> {
    await this.page.goto('/teacher/assignments/new');
    await this.waitForPageLoad();
  }

  async selectActivity(activityTitle: string): Promise<void> {
    await this.chooseOption(this.activitySelect, activityTitle);
  }

  async selectActivityByValue(activityId: string): Promise<void> {
    await this.activitySelect.click();
    await this.page
      .locator(`[role="option"][value="${activityId}"], [data-combobox-option][value="${activityId}"]`)
      .first()
      .click();
  }

  async selectClass(className: string): Promise<void> {
    await this.chooseOption(this.classSelect, className);
  }

  async selectTargetWholeClass(): Promise<void> {
    await this.wholeClassButton.click();
  }

  async selectTargetIndividualStudent(): Promise<void> {
    await this.individualStudentButton.click();
  }

  async selectStudent(studentName: string): Promise<void> {
    await this.studentSelect.waitFor({ state: 'visible', timeout: 10000 });
    await this.chooseOption(this.studentSelect, studentName);
  }

  private async chooseOption(target: Locator, textMatch: string): Promise<void> {
    await target.click();
    await this.page.getByRole('option', { name: new RegExp(escapeRegExp(textMatch), 'i') }).first().click();
  }

  async setDueDate(dateTimeLocal: string): Promise<void> {
    await this.dueDateInput.fill(dateTimeLocal);
  }

  async toggleMandatory(): Promise<void> {
    await this.mandatoryCheckbox.click();
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }

  async createAssignment(options: {
    activityTitle: string;
    className: string;
    dueDate?: string;
    mandatory?: boolean;
  }): Promise<void> {
    await this.selectActivity(options.activityTitle);
    await this.selectClass(options.className);
    if (options.dueDate) {
      await this.setDueDate(options.dueDate);
    }
    if (options.mandatory) {
      await this.toggleMandatory();
    }
    await this.submit();
  }

  async verifyOnComposerPage(): Promise<void> {
    await expect(this.activitySelect).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  async verifyEditMode(): Promise<void> {
    await expect(this.activitySelect).toBeDisabled();
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
