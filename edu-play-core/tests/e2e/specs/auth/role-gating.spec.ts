import { test, expect } from '../../fixtures/auth.fixture';
import { testStudent, testTeacher } from '../../fixtures/test-data';

/**
 * Middleware role-gating E2E (EDU-310)
 *
 * Verifies the defense-in-depth role gate enforced by `updateSession` in
 * `src/lib/supabase/middleware.ts`, composed into the Next.js root middleware
 * at `src/middleware.ts`. EDU-310 fixed a regression where `updateSession`
 * was never invoked, so unauth + cross-role redirects silently fell through
 * to the layout-level `requireAuth` checks (or worse, RLS only).
 *
 * The unauth specs always run — they prove middleware composition is wired.
 * The cross-role specs require seeded test users and are gated on EDU-5
 * (test fixture seeding).
 */

const ROLE_GATED_PATHS = [
  { path: '/teacher', label: 'teacher' },
  { path: '/student', label: 'student' },
  { path: '/parent', label: 'parent' },
  { path: '/admin', label: 'admin' },
] as const;

test.describe('Role gating — unauthenticated', () => {
  for (const { path, label } of ROLE_GATED_PATHS) {
    test(`anonymous request to ${path} is redirected to /login`, async ({ page }) => {
      const response = await page.goto(path);

      // Final URL after middleware redirect → /login
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

      // Guard against the regression: if `updateSession` weren't being called,
      // the request might still surface a non-null response (any successful
      // navigation does), and a client-side redirect could later pass the URL
      // check. We assert at the network level that a redirect *actually*
      // happened from the original dashboard path.
      expect(
        response,
        `navigation to ${label} dashboard should produce a response`,
      ).not.toBeNull();
      const redirectChain: string[] = [];
      let upstream = response!.request().redirectedFrom();
      while (upstream) {
        redirectChain.push(upstream.url());
        upstream = upstream.redirectedFrom();
      }
      expect(
        redirectChain.some((url) => new URL(url).pathname.startsWith(path)),
        `${label}: middleware should redirect from ${path}, got chain: [${redirectChain.join(' -> ')}]`,
      ).toBe(true);
    });
  }
});

test.describe('Role gating — cross-role redirect', () => {
  // TODO(EDU-5): seed test users in global-setup so these run in CI. The
  // cross-role redirect is the primary acceptance criterion of EDU-310 —
  // these specs are kept wired so they activate the moment seeding lands.
  test.skip('student requesting /teacher is redirected to /student', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.loginAsStudent(testStudent.username, testStudent.pin);
    await expect(page).toHaveURL(/\/student/, { timeout: 15000 });

    await page.goto('/teacher');
    await expect(page).toHaveURL(/\/student(?!\/)/, { timeout: 10000 });
  });

  test.skip('teacher requesting /student is redirected to /teacher', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.loginAsTeacher(testTeacher.email, testTeacher.password);
    await expect(page).toHaveURL(/\/teacher/, { timeout: 15000 });

    await page.goto('/student');
    await expect(page).toHaveURL(/\/teacher(?!\/)/, { timeout: 10000 });
  });

  test.skip('teacher requesting /admin is redirected to /teacher', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.loginAsTeacher(testTeacher.email, testTeacher.password);
    await expect(page).toHaveURL(/\/teacher/, { timeout: 15000 });

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/teacher(?!\/)/, { timeout: 10000 });
  });
});
