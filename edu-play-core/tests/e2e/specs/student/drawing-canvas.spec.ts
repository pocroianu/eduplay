import { test, expect } from '../../fixtures/auth.fixture';
import { testStudent } from '../../fixtures/test-data';
import { DrawingCanvasPage } from '../../pages/drawing-canvas.page';

/**
 * Drawing Canvas E2E (EDU-294 / F9 Phase 1B)
 *
 * Drives the student-facing path that an EduPlay child takes when they play
 * a drawing-canvas activity instance: log in → open the play URL → draw with
 * pointer events → submit → land on the kid-mode reward modal. Verifies that
 * `recordChildArtifact` ran by asserting the matching `child_artifacts` draft
 * row in Supabase.
 *
 * NOTE: Skipped until test user + activity-instance seeding lands in
 * `tests/e2e/global-setup.ts` — same gate as `game-artifact.spec.ts`. Once
 * seeding inserts a `drawing-canvas` instance assigned to the test student,
 * drop the `test.skip` line and these tests will run end-to-end.
 *
 * Manual reproduction (for now):
 *   1. `npm run dev:full`
 *   2. Log in as a seeded student.
 *   3. Insert an activity_instances row with
 *      `type_id='drawing-canvas'`, `assigned_to=<student>`, `class_id=<class>`.
 *   4. Visit `/student/activities/<row id>/play`, draw a few strokes,
 *      tap "Trimite desenul".
 *   5. Verify in Supabase Studio that a draft `child_artifacts` row exists
 *      with `student_id=<student>`, `artifact_type='drawing'`,
 *      `visibility='draft'`, and that the matching PNG lives in the
 *      `child-artifacts` storage bucket.
 */
test.describe('Student drawing-canvas activity → draft artifact', () => {
  test.skip(
    true,
    'Requires seeded student + drawing-canvas activity_instance (see tests/e2e/global-setup.ts TODO)',
  );

  let drawingCanvas: DrawingCanvasPage;

  test.beforeEach(async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.loginAsStudent(testStudent.username, testStudent.pin);
    await expect(page).toHaveURL(/\/student/, { timeout: 15000 });
    drawingCanvas = new DrawingCanvasPage(page);
  });

  test('drawing then submitting persists a draft child_artifacts row', async ({
    page,
  }) => {
    // Seeded instance id — the seed step decides the exact UUID.
    const instanceId = '00000000-0000-0000-0000-000000000d01';
    await page.goto(`/student/activities/${instanceId}/play`);

    await expect(drawingCanvas.canvas).toBeVisible();
    await expect(drawingCanvas.submitAction).toBeDisabled();

    await drawingCanvas.pickColor('coral');
    await drawingCanvas.drawStroke({ x: 60, y: 80 }, { x: 240, y: 200 });
    await drawingCanvas.drawStroke({ x: 60, y: 200 }, { x: 240, y: 80 });

    await expect(drawingCanvas.submitAction).toBeEnabled();
    await drawingCanvas.submit();

    // RewardModal copy lands once the action resolves.
    await expect(
      page.getByText(/frumos desen/i, { exact: false }),
    ).toBeVisible({ timeout: 10000 });

    // TODO: query Supabase via service-role client and assert that a draft
    // `child_artifacts` row exists for the seeded student with
    // `artifact_type='drawing'` and the upload landed in storage.
  });

  test('clear-confirm flow wipes the canvas and re-disables submit', async ({
    page,
  }) => {
    const instanceId = '00000000-0000-0000-0000-000000000d01';
    await page.goto(`/student/activities/${instanceId}/play`);

    await drawingCanvas.drawStroke({ x: 50, y: 50 }, { x: 200, y: 200 });
    await expect(drawingCanvas.submitAction).toBeEnabled();

    await drawingCanvas.clearAction.click();
    await page.getByRole('button', { name: /da, șterge/i }).click();

    await expect(drawingCanvas.submitAction).toBeDisabled();
    await expect(drawingCanvas.undoAction).toBeDisabled();
  });
});
