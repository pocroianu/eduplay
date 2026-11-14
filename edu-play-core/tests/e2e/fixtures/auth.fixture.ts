/* eslint-disable react-hooks/rules-of-hooks */
// Note: ESLint incorrectly flags Playwright's `use` function as a React hook.
// This file contains Playwright test fixtures, not React components.

import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  LoginPage,
  TeacherDashboardPage,
  TeacherAssignmentsPage,
  TeacherAssignmentComposerPage,
  StudentDashboardPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  ParentDashboardPage,
  ParentNotificationsPage,
} from '../pages';
import { testTeacher, testStudent, testParent, testAdmin } from './test-data';

/**
 * Custom test fixtures for authentication scenarios
 * Extends Playwright's base test with pre-configured page objects
 */

// Define custom fixture types
type AuthFixtures = {
  loginPage: LoginPage;
  teacherDashboard: TeacherDashboardPage;
  teacherAssignments: TeacherAssignmentsPage;
  teacherAssignmentComposer: TeacherAssignmentComposerPage;
  studentDashboard: StudentDashboardPage;
  forgotPasswordPage: ForgotPasswordPage;
  resetPasswordPage: ResetPasswordPage;
  parentDashboard: ParentDashboardPage;
  parentNotifications: ParentNotificationsPage;
  authenticatedTeacher: TeacherDashboardPage;
  authenticatedStudent: StudentDashboardPage;
  authenticatedParent: ParentDashboardPage;
  authenticatedAdmin: Page;
};

/**
 * Extended test with auth fixtures
 */
export const test = base.extend<AuthFixtures>({
  // Login page fixture
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },

  // Teacher dashboard fixture (not authenticated)
  teacherDashboard: async ({ page }, use) => {
    const dashboard = new TeacherDashboardPage(page);
    await use(dashboard);
  },

  // Teacher assignments page fixture (not authenticated)
  teacherAssignments: async ({ page }, use) => {
    const assignmentsPage = new TeacherAssignmentsPage(page);
    await use(assignmentsPage);
  },

  // Teacher assignment composer fixture (not authenticated)
  teacherAssignmentComposer: async ({ page }, use) => {
    const composerPage = new TeacherAssignmentComposerPage(page);
    await use(composerPage);
  },

  // Student dashboard fixture (not authenticated)
  studentDashboard: async ({ page }, use) => {
    const dashboard = new StudentDashboardPage(page);
    await use(dashboard);
  },

  // Forgot password page fixture
  forgotPasswordPage: async ({ page }, use) => {
    const forgotPasswordPage = new ForgotPasswordPage(page);
    await use(forgotPasswordPage);
  },

  // Reset password page fixture
  resetPasswordPage: async ({ page }, use) => {
    const resetPasswordPage = new ResetPasswordPage(page);
    await use(resetPasswordPage);
  },

  // Pre-authenticated teacher fixture
  authenticatedTeacher: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    const dashboard = new TeacherDashboardPage(page);

    // Login as teacher
    await loginPage.goto();
    await loginPage.loginAsTeacher(testTeacher.email, testTeacher.password);

    // Wait for redirect to teacher dashboard
    await expect(page).toHaveURL(/\/teacher/, { timeout: 15000 });

    await use(dashboard);
  },

  // Pre-authenticated student fixture
  authenticatedStudent: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    const dashboard = new StudentDashboardPage(page);

    // Login as student
    await loginPage.goto();
    await loginPage.loginAsStudent(testStudent.username, testStudent.pin);

    // Wait for redirect to student dashboard
    await expect(page).toHaveURL(/\/student/, { timeout: 15000 });

    await use(dashboard);
  },

  // Parent dashboard fixture (not authenticated)
  parentDashboard: async ({ page }, use) => {
    const dashboard = new ParentDashboardPage(page);
    await use(dashboard);
  },

  // Parent notifications fixture (not authenticated)
  parentNotifications: async ({ page }, use) => {
    const notifications = new ParentNotificationsPage(page);
    await use(notifications);
  },

  // Pre-authenticated parent fixture
  authenticatedParent: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    const dashboard = new ParentDashboardPage(page);

    await loginPage.goto();
    await loginPage.loginAsParent(testParent.email, testParent.password);

    await expect(page).toHaveURL(/\/parent/, { timeout: 15000 });

    await use(dashboard);
  },

  // Pre-authenticated admin fixture
  authenticatedAdmin: async ({ page }, use) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.loginAsStandardUser(testAdmin.email, testAdmin.password);

    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });

    await use(page);
  },
});

export { expect };
