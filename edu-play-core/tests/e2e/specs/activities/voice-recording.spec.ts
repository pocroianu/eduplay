import { expect, test } from '../../fixtures/auth.fixture';
import { timeouts } from '../../fixtures/test-data';

/**
 * E2E: Voice-recording activity gating + capture (EDU-295, F9 Phase 1C).
 *
 * Acceptance criteria from the issue:
 *   1. Browser mic permission only requested on a user click.
 *   2. Per-child parent consent toggle exists, defaults off, gates the
 *      renderer.
 *   3. Audio file uploaded → `child_artifacts` row with `artifact_type='audio'`
 *      only when consent is granted.
 *   4. Reduced-motion guard respected (mic visualization stays static).
 *
 * Authenticated paths are skipped pending the activity-instance seed pipeline
 * (parallel to the convention in
 * `tests/e2e/specs/parent/notifications.spec.ts` and `parent/artifact-visibility.spec.ts`).
 * The route-protection assertion runs unconditionally — it proves the play
 * route is gated by the student role-prefix middleware before any RLS or
 * gate-hook logic kicks in.
 *
 * Prerequisites for the unskipped tests once seeding lands:
 *   - A `voice-recording` `activity_instances` row assigned to
 *     `testStudent.id` with a known `instanceId`.
 *   - A `parent_children` link between `testParent.id` and `testStudent.id`
 *     (status='active') so the parent can flip the consent toggle.
 *   - Browser launched with
 *     `--use-fake-device-for-media-stream --use-file-for-fake-audio-capture`
 *     pointing at `tests/e2e/fixtures/audio/voice-sample.webm` so the renderer
 *     records deterministic bytes that pass the `recordChildArtifact` audio
 *     allow-list.
 */

const FAKE_INSTANCE_ID = '00000000-0000-4000-8000-000000000295';

test.describe('Voice-recording activity (EDU-295)', () => {
  test.describe('Route protection', () => {
    test('redirects unauthenticated traffic from the play route to login', async ({
      page,
    }) => {
      await page.goto(
        `/student/activities/${FAKE_INSTANCE_ID}/play`,
      );
      await expect(page).toHaveURL(/\/login/, {
        timeout: timeouts.navigation,
      });
    });
  });

  test.describe('Consent gate', () => {
    test.skip(
      true,
      'Requires seeded voice-recording activity_instances row + parent_children link in test DB',
    );

    test('consent off → student sees the kid-mode permission empty state and no MediaRecorder is constructed', async () => {
      // Step 1 — student signs in and navigates to the play route for the
      // seeded voice-recording instance with `students.consents` having
      // `audio_recording !== true`.
      // Step 2 — assert the `Avem nevoie de permisiune` empty state renders
      // and the `Înapoi la tabloul de bord` CTA is visible.
      // Step 3 — instrument `MediaRecorder` via page.addInitScript and assert
      // the constructor was never invoked.
    });

    test('consent on → student records a fake clip and a draft child_artifacts row appears', async () => {
      // Step 1 — parent signs in, navigates to /parent/children/[id], flips
      // the `audio_recording` toggle on (uses the consent-toggle UI).
      // Step 2 — student signs in, opens the seeded instance's play route.
      // Step 3 — click "Înregistrează" → assert MediaRecorder is started
      // with the fake mic stream → wait ~3s → click "Oprește".
      // Step 4 — playback is visible; click "Trimite".
      // Step 5 — query `child_artifacts` via the v1 API or service-role
      // helper and assert exactly one new row exists with
      // `artifact_type='audio'`, `visibility='draft'`,
      // `student_id = testStudent.id`.
    });

    test('parent toggles consent on → student can submit on next visit', async () => {
      // Step 1 — student visits play route while consent is off; sees empty
      // state.
      // Step 2 — parent flips the toggle on in another browser context.
      // Step 3 — student reloads the play route and now sees the recorder
      // CTA (no longer the empty state).
    });
  });
});
