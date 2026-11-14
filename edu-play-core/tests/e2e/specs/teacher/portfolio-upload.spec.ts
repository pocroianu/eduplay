import { expect, test } from '../../fixtures/auth.fixture';
import { LoginPage } from '../../pages/login.page';
import {
  testParent,
  testStudent,
  testTeacher,
  timeouts,
} from '../../fixtures/test-data';

test.describe('Teacher · Portfolio upload', () => {
  test('teacher uploads a JPEG draft, publishes it, and parent sees the feed entry', async ({
    page,
  }) => {
    const title = `Poză E2E ${Date.now()}`;
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.loginAsTeacher(testTeacher.email, testTeacher.password);
    await expect(page).toHaveURL(/\/teacher/, { timeout: timeouts.navigation });

    await page.goto('/teacher/portfolio');
    await page.getByRole('button', { name: /adaugă dovadă/i }).click();
    await page.getByLabel(/alege elevul/i).selectOption(testStudent.id);
    await page.getByLabel(/titlu opțional/i).fill(title);
    await page.getByLabel(/alege fotografia/i).setInputFiles({
      name: 'portfolio-e2e.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]),
    });
    await page.getByRole('button', { name: /adaugă dovada/i }).click();

    const uploadedCard = page.locator('li').filter({
      has: page.getByRole('heading', { name: title }),
    });
    await expect(uploadedCard).toBeVisible({ timeout: timeouts.apiCall });

    await uploadedCard
      .getByRole('button', { name: /publică pentru familie/i })
      .click();
    await expect(uploadedCard).toHaveCount(0, { timeout: timeouts.apiCall });

    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await loginPage.goto();
    await loginPage.loginAsParent(testParent.email, testParent.password);
    await expect(page).toHaveURL(/\/parent/, { timeout: timeouts.navigation });

    await page.goto('/parent');
    const feedEntry = page
      .locator('[data-feed-kind="artifact_published"]')
      .filter({ hasText: title })
      .first();
    await expect(feedEntry).toBeVisible({ timeout: timeouts.apiCall });
    await expect(feedEntry).toContainText(testStudent.name);
  });
});
