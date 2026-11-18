import { test, expect } from '../../fixtures/auth.fixture';
import {
  testAdmin,
  testClass,
  testGame,
  testParent,
  testStudent,
  testTeacher,
} from '../../fixtures/test-data';
import { LoginPage } from '../../pages/login.page';

type AuthMode = 'public' | 'teacher' | 'student' | 'parent' | 'admin';
type TargetMode = 'public' | 'standard' | 'kid';

interface RouteScenario {
  slug: string;
  path: string;
  auth: AuthMode;
  expectedUrl: RegExp;
  expectOneMain: boolean;
  targetMode: TargetMode;
}

const VIEWPORTS = [
  { name: 'w320', width: 320, height: 900 },
  { name: 'w390', width: 390, height: 900 },
  { name: 'w768', width: 768, height: 900 },
  { name: 'w1280', width: 1280, height: 900 },
  { name: 'w1440', width: 1440, height: 900 },
] as const;

const MOTION_MODES = [
  { name: 'normal', reducedMotion: 'no-preference' as const },
  { name: 'reduced-motion', reducedMotion: 'reduce' as const },
] as const;

const ROUTES: RouteScenario[] = [
  {
    slug: 'login',
    path: '/login',
    auth: 'public',
    expectedUrl: /\/login$/,
    expectOneMain: true,
    targetMode: 'public',
  },
  {
    slug: 'student-login',
    path: '/login/elev',
    auth: 'public',
    expectedUrl: /\/login\/elev$/,
    expectOneMain: true,
    targetMode: 'kid',
  },
  {
    slug: 'teacher-home',
    path: '/teacher',
    auth: 'teacher',
    expectedUrl: /\/teacher$/,
    expectOneMain: true,
    targetMode: 'standard',
  },
  {
    slug: 'teacher-library',
    path: '/teacher/library',
    auth: 'teacher',
    expectedUrl: /\/teacher\/library$/,
    expectOneMain: true,
    targetMode: 'standard',
  },
  {
    slug: 'teacher-libraries-explore',
    path: '/teacher/libraries/explore',
    auth: 'teacher',
    expectedUrl: /\/teacher\/libraries\/explore/,
    expectOneMain: true,
    targetMode: 'standard',
  },
  {
    slug: 'teacher-class',
    path: `/teacher/classes/${testClass.id}`,
    auth: 'teacher',
    expectedUrl: new RegExp(`/teacher/classes/${testClass.id}$`),
    expectOneMain: true,
    targetMode: 'standard',
  },
  {
    slug: 'student-home',
    path: '/student',
    auth: 'student',
    expectedUrl: /\/student$/,
    expectOneMain: true,
    targetMode: 'kid',
  },
  {
    slug: 'student-map',
    path: '/student/map',
    auth: 'student',
    expectedUrl: /\/student\/map$/,
    expectOneMain: true,
    targetMode: 'kid',
  },
  {
    slug: 'parent-home',
    path: '/parent',
    auth: 'parent',
    expectedUrl: /\/parent$/,
    expectOneMain: true,
    targetMode: 'standard',
  },
  {
    slug: 'parent-child',
    path: `/parent/children/${testStudent.id}`,
    auth: 'parent',
    expectedUrl: new RegExp(`/parent/children/${testStudent.id}$`),
    expectOneMain: true,
    targetMode: 'standard',
  },
  {
    slug: 'parent-link-child',
    path: '/parent/link-child',
    auth: 'parent',
    expectedUrl: /\/parent\/link-child$/,
    expectOneMain: true,
    targetMode: 'standard',
  },
  {
    slug: 'admin-home',
    path: '/admin',
    auth: 'admin',
    expectedUrl: /\/admin$/,
    expectOneMain: true,
    targetMode: 'standard',
  },
  {
    slug: 'admin-users',
    path: '/admin/users',
    auth: 'admin',
    expectedUrl: /\/admin\/users$/,
    expectOneMain: true,
    targetMode: 'standard',
  },
  {
    slug: 'admin-audit',
    path: '/admin/audit',
    auth: 'admin',
    expectedUrl: /\/admin\/audit$/,
    expectOneMain: true,
    targetMode: 'standard',
  },
  {
    slug: 'admin-cms-activities',
    path: '/admin/cms/activities',
    auth: 'admin',
    expectedUrl: /\/admin\/cms\/activities$/,
    expectOneMain: true,
    targetMode: 'standard',
  },
  {
    slug: 'play-activity',
    path: `/play/${testGame.id}`,
    auth: 'student',
    expectedUrl: new RegExp(`/play/${testGame.id}`),
    expectOneMain: true,
    targetMode: 'kid',
  },
];

async function authenticateForRoute(page: import('@playwright/test').Page, auth: AuthMode) {
  if (auth === 'public') return;

  const loginPage = new LoginPage(page);
  await loginPage.goto();

  if (auth === 'teacher') {
    await loginPage.loginAsTeacher(testTeacher.email, testTeacher.password);
    await expect(page).toHaveURL(/\/teacher/, { timeout: 15000 });
    return;
  }

  if (auth === 'student') {
    await loginPage.loginAsStudent(testStudent.username, testStudent.pin);
    await expect(page).toHaveURL(/\/student/, { timeout: 15000 });
    return;
  }

  if (auth === 'parent') {
    await loginPage.loginAsParent(testParent.email, testParent.password);
    await expect(page).toHaveURL(/\/parent/, { timeout: 15000 });
    return;
  }

  await loginPage.loginAsStandardUser(testAdmin.email, testAdmin.password);
  await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return Math.ceil(root.scrollWidth - root.clientWidth);
  });

  expect(overflow).toBeLessThanOrEqual(2);
}

async function expectOneMainLandmark(page: import('@playwright/test').Page) {
  const mainCount = await page.locator('main, [role="main"]').count();

  expect(mainCount).toBe(1);
}

async function expectTargetSizes(
  page: import('@playwright/test').Page,
  targetMode: TargetMode,
) {
  const minimum = targetMode === 'kid' ? 64 : 44;
  const selectors =
    targetMode === 'kid'
      ? ['nav a', 'nav button', 'main button', 'main a', '[data-testid*="bottom"] a']
      : targetMode === 'standard'
        ? [
            '[data-testid="sidebar"] a',
            '[data-testid="sidebar"] button',
            'input[type="search"]',
            'button[aria-label*="meniul"]',
          ]
        : [
            'form input',
            'form button',
            '[role="group"] button',
            '[data-testid="student-login-entry"]',
          ];

  const violations = await page.evaluate(
    ({ selectors, minimum }) => {
      const candidates = selectors.flatMap((selector) =>
        Array.from(document.querySelectorAll<HTMLElement>(selector)),
      );
      const uniqueCandidates = Array.from(new Set(candidates));

      return uniqueCandidates
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          const visible =
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden';

          if (!visible) return null;

          const label =
            element.getAttribute('aria-label') ||
            element.textContent?.trim().replace(/\s+/g, ' ') ||
            element.getAttribute('href') ||
            element.tagName.toLowerCase();

          if (rect.width >= minimum && rect.height >= minimum) return null;

          return {
            label,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        })
        .filter(Boolean);
    },
    { selectors, minimum },
  );

  expect(violations).toEqual([]);
}

test.describe('EduPlay + Mantine P1 design matrix', () => {
  for (const route of ROUTES) {
    for (const motion of MOTION_MODES) {
      test(`${route.slug} ${motion.name} captures route matrix artifacts`, async ({
        page,
      }, testInfo) => {
        await page.emulateMedia({ reducedMotion: motion.reducedMotion });
        await authenticateForRoute(page, route.auth);

        for (const viewport of VIEWPORTS) {
          await page.setViewportSize({
            width: viewport.width,
            height: viewport.height,
          });
          await page.goto(route.path, { waitUntil: 'networkidle' });
          await expect(page).toHaveURL(route.expectedUrl, { timeout: 15000 });
          await expectNoHorizontalOverflow(page);
          if (route.expectOneMain) {
            await expectOneMainLandmark(page);
          }
          await expectTargetSizes(page, route.targetMode);
          await page.screenshot({
            path: testInfo.outputPath(
              `${route.slug}-${motion.name}-${viewport.name}.png`,
            ),
            fullPage: true,
          });
        }
      });
    }
  }
});
