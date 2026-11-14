import { test, expect } from '../../fixtures/auth.fixture';
import { TeacherAssignmentsPage } from '../../pages/teacher-assignments.page';
import { TeacherAssignmentComposerPage } from '../../pages/teacher-assignment-composer.page';
import { testTeacher, testStudent, testClass, testGame, testRoutes, timeouts } from '../../fixtures/test-data';

test.describe('Assignments: create-assign-launch flow', () => {
  test.describe('Unauthenticated access', () => {
    test('redirects to /login when visiting assignments page without auth', async ({ page }) => {
      await page.goto(testRoutes.teacherAssignments);
      await expect(page).toHaveURL(/\/login/, { timeout: timeouts.navigation });
    });

    test('redirects to /login when visiting new assignment page without auth', async ({ page }) => {
      await page.goto(testRoutes.teacherAssignmentNew);
      await expect(page).toHaveURL(/\/login/, { timeout: timeouts.navigation });
    });
  });

  test.describe('Assignments list page (authenticated)', () => {
    test.skip(true, 'Requires seeded teacher account in database');

    test('loads and displays the assignments page', async ({ authenticatedTeacher: _auth, page }) => {
      const assignmentsPage = new TeacherAssignmentsPage(page);
      await assignmentsPage.goto();
      await expect(page).toHaveURL(/\/teacher\/assignments/);
    });

    test('shows stat cards for total, active, overdue, and mandatory', async ({
      authenticatedTeacher: _auth,
      page,
    }) => {
      const assignmentsPage = new TeacherAssignmentsPage(page);
      await assignmentsPage.goto();

      await expect(page.getByText(/total assignments|total teme/i)).toBeVisible();
      await expect(page.getByText(/^active$/i)).toBeVisible();
      await expect(page.getByText(/^(overdue|expirate)$/i)).toBeVisible();
    });

    test('shows empty state when no assignments exist', async ({
      authenticatedTeacher: _auth,
      page,
    }) => {
      const assignmentsPage = new TeacherAssignmentsPage(page);
      await assignmentsPage.goto();

      const emptyOrCards = await assignmentsPage.getAssignmentCount();
      if (emptyOrCards === 0) {
        await expect(
          page.getByText(/no assignments created|nicio temă creată/i),
        ).toBeVisible();
      }
    });

    test('filter pills toggle the visible assignment list', async ({
      authenticatedTeacher: _auth,
      page,
    }) => {
      const assignmentsPage = new TeacherAssignmentsPage(page);
      await assignmentsPage.goto();

      await assignmentsPage.applyFilter('mandatory');
      await page.waitForTimeout(timeouts.animation);
      await assignmentsPage.applyFilter('all');
      await page.waitForTimeout(timeouts.animation);
    });
  });

  test.describe('Create new assignment (authenticated)', () => {
    test.skip(true, 'Requires seeded teacher account with classes and published games');

    test('navigates to new assignment form', async ({ authenticatedTeacher: _auth, page }) => {
      const assignmentsPage = new TeacherAssignmentsPage(page);
      await assignmentsPage.goto();

      await assignmentsPage.createNewButton.click();
      await expect(page).toHaveURL(/\/teacher\/assignments\/new/, {
        timeout: timeouts.navigation,
      });

      const composer = new TeacherAssignmentComposerPage(page);
      await composer.verifyOnComposerPage();
    });

    test('shows composer form with required fields', async ({ authenticatedTeacher: _auth, page }) => {
      const composer = new TeacherAssignmentComposerPage(page);
      await composer.goto();

      await expect(composer.activitySelect).toBeVisible();
      await expect(composer.classSelect).toBeVisible();
      await expect(composer.dueDateInput).toBeVisible();
      await expect(composer.mandatoryCheckbox).toBeVisible();
      await expect(composer.wholeClassButton).toBeVisible();
      await expect(composer.individualStudentButton).toBeVisible();
      await expect(composer.submitButton).toBeVisible();
      await expect(composer.cancelButton).toBeVisible();
    });

    test('cancel returns to assignments list', async ({ authenticatedTeacher: _auth, page }) => {
      const composer = new TeacherAssignmentComposerPage(page);
      await composer.goto();
      await composer.cancel();

      await expect(page).toHaveURL(/\/teacher\/assignments$/, {
        timeout: timeouts.navigation,
      });
    });

    test('creates a class assignment and verifies it appears in the list', async ({
      authenticatedTeacher: _auth,
      page,
    }) => {
      const composer = new TeacherAssignmentComposerPage(page);
      await composer.goto();

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dueDateStr = tomorrow.toISOString().slice(0, 16);

      await composer.createAssignment({
        activityTitle: testGame.name,
        className: testClass.name,
        dueDate: dueDateStr,
        mandatory: true,
      });

      await expect(page).toHaveURL(/\/teacher\/assignments$/, {
        timeout: timeouts.navigation,
      });

      const assignmentsPage = new TeacherAssignmentsPage(page);
      await assignmentsPage.verifyAssignmentExists(testGame.name);
    });
  });

  test.describe('Student sees assignment on dashboard', () => {
    test.skip(true, 'Requires seeded student in a class with an active assignment');

    test('student dashboard shows assigned game as a mission', async ({ page }) => {
      const { LoginPage } = await import('../../pages/login.page');
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAsStudent(testStudent.username, testStudent.pin);
      await expect(page).toHaveURL(/\/student/, { timeout: timeouts.navigation });

      await expect(
        page.getByText(/teme astazi|today.s assignments/i),
      ).toBeVisible({ timeout: timeouts.apiCall });
    });

    test('student can launch the assigned game', async ({ page }) => {
      const { LoginPage } = await import('../../pages/login.page');
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAsStudent(testStudent.username, testStudent.pin);
      await expect(page).toHaveURL(/\/student/, { timeout: timeouts.navigation });

      const missionCard = page.locator('[data-testid="mission-card"]').filter({
        hasText: new RegExp(testGame.name, 'i'),
      });

      await expect(missionCard.first()).toBeVisible({ timeout: timeouts.apiCall });
      await missionCard.first().click();
      await expect(page).toHaveURL(/\/games\//, { timeout: timeouts.navigation });
    });
  });

  test.describe('Edit assignment (authenticated teacher)', () => {
    test.skip(true, 'Requires seeded teacher account with an existing assignment');

    test('navigates to edit form and shows game select as disabled', async ({
      authenticatedTeacher: _auth,
      page,
    }) => {
      const assignmentsPage = new TeacherAssignmentsPage(page);
      await assignmentsPage.goto();

      await assignmentsPage.clickEditOnAssignment(testGame.name);
      await expect(page).toHaveURL(/\/teacher\/assignments\/[0-9a-f-]+/, {
        timeout: timeouts.navigation,
      });

      const composer = new TeacherAssignmentComposerPage(page);
      await composer.verifyEditMode();
    });

    test('updates due date and saves successfully', async ({
      authenticatedTeacher: _auth,
      page,
    }) => {
      const assignmentsPage = new TeacherAssignmentsPage(page);
      await assignmentsPage.goto();

      await assignmentsPage.clickEditOnAssignment(testGame.name);

      const composer = new TeacherAssignmentComposerPage(page);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const newDueDateStr = nextWeek.toISOString().slice(0, 16);

      await composer.setDueDate(newDueDateStr);
      await composer.submit();

      await expect(page).toHaveURL(/\/teacher\/assignments$/, {
        timeout: timeouts.navigation,
      });
    });
  });

  test.describe('Delete assignment (authenticated teacher)', () => {
    test.skip(true, 'Requires seeded teacher account with an existing assignment');

    test('shows delete confirmation dialog', async ({ authenticatedTeacher: _auth, page }) => {
      const assignmentsPage = new TeacherAssignmentsPage(page);
      await assignmentsPage.goto();

      await assignmentsPage.clickDeleteOnAssignment(testGame.name);

      const dialog = page.locator('[role="dialog"], [role="alertdialog"]');
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByText(/sigur|delete|șterge/i),
      ).toBeVisible();
    });

    test('cancel dismisses the dialog without deleting', async ({
      authenticatedTeacher: _auth,
      page,
    }) => {
      const assignmentsPage = new TeacherAssignmentsPage(page);
      await assignmentsPage.goto();

      await assignmentsPage.clickDeleteOnAssignment(testGame.name);
      await assignmentsPage.cancelDelete();

      const dialog = page.locator('[role="dialog"], [role="alertdialog"]');
      await expect(dialog).toBeHidden();

      await assignmentsPage.verifyAssignmentExists(testGame.name);
    });

    test('confirm deletes the assignment and removes it from the list', async ({
      authenticatedTeacher: _auth,
      page,
    }) => {
      const assignmentsPage = new TeacherAssignmentsPage(page);
      await assignmentsPage.goto();

      await assignmentsPage.clickDeleteOnAssignment(testGame.name);
      await assignmentsPage.confirmDelete();

      await page.waitForTimeout(timeouts.animation);
      await assignmentsPage.verifyAssignmentNotExists(testGame.name);
    });
  });

  test.describe('Full create-assign-launch lifecycle', () => {
    test.skip(
      true,
      'Requires seeded teacher + student in same class + published game',
    );

    test('teacher creates assignment → student sees it → teacher edits → teacher deletes', async ({
      page,
    }) => {
      const { LoginPage } = await import('../../pages/login.page');

      // Step 1: Teacher logs in and creates an assignment
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAsTeacher(testTeacher.email, testTeacher.password);
      await expect(page).toHaveURL(/\/teacher/, { timeout: timeouts.navigation });

      const assignmentsPage = new TeacherAssignmentsPage(page);
      await assignmentsPage.goto();

      await assignmentsPage.createNewButton.click();
      await expect(page).toHaveURL(/\/teacher\/assignments\/new/);

      const composer = new TeacherAssignmentComposerPage(page);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dueDateStr = tomorrow.toISOString().slice(0, 16);

      await composer.createAssignment({
        activityTitle: testGame.name,
        className: testClass.name,
        dueDate: dueDateStr,
      });

      await expect(page).toHaveURL(/\/teacher\/assignments$/, {
        timeout: timeouts.navigation,
      });

      // Step 2: Verify assignment appears in list
      await assignmentsPage.verifyAssignmentExists(testGame.name);

      // Step 3: Student logs in and sees the assignment
      await page.goto('/login');
      await loginPage.loginAsStudent(testStudent.username, testStudent.pin);
      await expect(page).toHaveURL(/\/student/, { timeout: timeouts.navigation });

      // Step 4: Student launches the assigned game
      const missionCard = page.locator('[data-testid="mission-card"]').filter({
        hasText: new RegExp(testGame.name, 'i'),
      });
      await expect(missionCard.first()).toBeVisible({ timeout: timeouts.apiCall });
      await missionCard.first().click();
      await expect(page).toHaveURL(/\/games\//, { timeout: timeouts.navigation });
      await page.goBack();

      // Step 5: Teacher logs back in and edits the assignment
      await page.goto('/login');
      await loginPage.loginAsTeacher(testTeacher.email, testTeacher.password);
      await expect(page).toHaveURL(/\/teacher/, { timeout: timeouts.navigation });

      await assignmentsPage.goto();
      await assignmentsPage.clickEditOnAssignment(testGame.name);

      const editComposer = new TeacherAssignmentComposerPage(page);
      await editComposer.verifyEditMode();

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      await editComposer.setDueDate(nextWeek.toISOString().slice(0, 16));
      await editComposer.submit();

      await expect(page).toHaveURL(/\/teacher\/assignments$/, {
        timeout: timeouts.navigation,
      });

      // Step 6: Teacher deletes the assignment
      await assignmentsPage.clickDeleteOnAssignment(testGame.name);
      await assignmentsPage.confirmDelete();

      await page.waitForTimeout(timeouts.animation);
      await assignmentsPage.verifyAssignmentNotExists(testGame.name);
    });
  });
});
