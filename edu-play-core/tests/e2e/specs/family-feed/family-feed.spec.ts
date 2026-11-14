import { expect, test } from '../../fixtures/auth.fixture';
import { FamilyFeedPage } from '../../pages/family-feed.page';
import { testRoutes, timeouts } from '../../fixtures/test-data';

/**
 * E2E: Family learning feed (EDU-287, F7 Phase 2E).
 *
 * Verifies the merged parent feed surface that ships with EDU-285 (server
 * merge) + EDU-286 (UI). Three flows from the ticket:
 *
 *   1. Feed renders mixed cards (artifact + game) sorted newest-first.
 *   2. Child selector toggles `?child=<id>` and filters the rendered cards.
 *   3. Filtering by a child with no published items renders `FeedEmptyState`.
 *
 * Seeding contract for the authenticated flows (matches the convention in
 * `tests/e2e/specs/parent/notifications.spec.ts` and
 * `tests/e2e/specs/parent/artifact-visibility.spec.ts`):
 *
 *   - Parent account `testParent.email` exists in `auth.users` with
 *     `profiles.role = 'parent'`.
 *   - Parent is linked to at least three students through the
 *     `parent_children` junction with `status = 'active'` and a non-NULL
 *     `linked_via_code` (i.e., the invite-code flow path that EDU-283
 *     repaired). `students.parent_id` is intentionally left NULL.
 *   - Two of those children (Child A and Child B) each have:
 *       · ≥1 row in `child_artifacts` with `visibility = 'family_visible'`
 *         that the parent's RLS policy returns (`storage_path` resolvable
 *         via the child-artifacts bucket).
 *       · ≥1 row in `game_progress` with a completion timestamp surfaced by
 *         `getRecentMilestonesForChildren`.
 *   - Child C is linked but has zero family-visible artifacts and zero
 *     completed games — it is the fixture for the empty-state branch.
 *
 * The parent E2E seed pipeline (EDU-426) wires this contract through
 * `tests/e2e/global-setup.ts`. The spec intentionally avoids hard-coded
 * child names / artifact titles so it keeps working when the seed evolves.
 */

test.describe('Family learning feed (EDU-287)', () => {
  test.describe('Unauthenticated access', () => {
    test('redirects /parent to /login', async ({ page }) => {
      await page.goto(testRoutes.parentDashboard);
      await expect(page).toHaveURL(/\/login/, { timeout: timeouts.navigation });
    });

    test('redirects /parent?child=<id> to /login (the child filter is parent-only)', async ({
      page,
    }) => {
      await page.goto(
        `${testRoutes.parentDashboard}?child=00000000-0000-0000-0000-000000000000`,
      );
      await expect(page).toHaveURL(/\/login/, { timeout: timeouts.navigation });
    });
  });

  test.describe('Authenticated parent flows', () => {
    test('1. feed renders mixed cards (artifact + game) sorted newest-first', async ({
      authenticatedParent: _auth,
      page,
    }) => {
      const feed = new FamilyFeedPage(page);
      await feed.goto();
      await feed.waitForFeedReady();

      // Cross-child view: both kinds must surface.
      await expect(feed.timeline).toBeVisible();
      await expect(feed.artifactCards.first()).toBeVisible();
      await expect(feed.gameCards.first()).toBeVisible();

      // The merge step in `getFamilyFeed` orders DESC by `(timestamp, id)`.
      // Assert the rendered timestamps directly so a grouped/ascending feed
      // cannot pass just by containing both supported card kinds.
      const kinds = await feed.getRenderedKindsInOrder();
      expect(kinds.length).toBeGreaterThanOrEqual(2);
      expect(
        kinds.every(
          (k) => k === 'artifact_published' || k === 'game_completed',
        ),
      ).toBe(true);
      const timestamps = await feed.getRenderedTimestampsInOrder();
      expect(timestamps).toHaveLength(kinds.length);
      for (let i = 1; i < timestamps.length; i += 1) {
        expect(Date.parse(timestamps[i - 1]!)).toBeGreaterThanOrEqual(
          Date.parse(timestamps[i]!),
        );
      }
    });

    test('2. child selector toggles ?child=<id> and filters the timeline', async ({
      authenticatedParent: _auth,
      page,
    }) => {
      const feed = new FamilyFeedPage(page);
      await feed.goto();
      await feed.waitForFeedReady();

      // Child pills are everything inside the selector except "Toți copiii".
      const childNames = (await feed.childPills.allTextContents()).map((n) =>
        n.trim(),
      );
      expect(childNames.length).toBeGreaterThanOrEqual(2);

      // Probe to find a content-bearing child. The seed only guarantees one
      // empty child; link order isn't pinned (`getLinkedChildren` orders by
      // `linked_at DESC`), so the first pill in the row could be the empty
      // one. Filtering and counting `feedItems` is the cheapest deterministic
      // signal — `filterByChild` already waits for `aria-pressed` + render.
      let contentChildName: string | null = null;
      let contentChildId: string | null = null;
      for (const name of childNames) {
        const id = await feed.filterByChild(name);
        if ((await feed.feedItems.count()) > 0) {
          contentChildName = name;
          contentChildId = id;
          break;
        }
        await feed.clearChildFilter();
      }
      expect(
        contentChildName,
        'Seed contract violated: at least one linked child must have feed content',
      ).toBeTruthy();
      expect(contentChildId!).toMatch(/^[0-9a-f-]{36}$/i);
      await expect(feed.childPill(contentChildName!)).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      // Every visible card belongs to the filtered child — the card header
      // renders the student's name. The assertion is structural: at least
      // one card visible, all cards reference the same name.
      await expect(feed.feedItems.first()).toBeVisible();
      const visibleCards = await feed.feedItems.count();
      for (let i = 0; i < visibleCards; i += 1) {
        await expect(feed.feedItems.nth(i)).toContainText(contentChildName!);
      }

      // Clearing the filter restores the cross-child view.
      await feed.clearChildFilter();
      expect(feed.getActiveChildIdFromUrl()).toBeNull();
      await expect(feed.allChildrenPill).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(feed.artifactCards.first()).toBeVisible();
      await expect(feed.gameCards.first()).toBeVisible();
    });

    test('3. filtering by a child with no published items renders the empty state', async ({
      authenticatedParent: _auth,
      page,
    }) => {
      const feed = new FamilyFeedPage(page);
      await feed.goto();
      await feed.waitForFeedReady();

      // Probe each linked child by filtering to them in turn. The first one
      // whose filtered feed shows `FeedEmptyState` is our empty child.
      // Probing instead of inferring from the cross-child page is robust
      // against pagination drift — `getFamilyFeed` defaults to a 20-item
      // page, so a child whose only items fall on page 2+ would otherwise
      // look "empty" by absence on page 1.
      const childNames = (await feed.childPills.allTextContents()).map((n) =>
        n.trim(),
      );
      expect(childNames.length).toBeGreaterThanOrEqual(2);

      // `filterByChild` already waits for `aria-pressed` + render before
      // returning, so the empty-state visibility check sees the post-render
      // state, not the stale cross-child view.
      let emptyChildName: string | null = null;
      for (const name of childNames) {
        await feed.filterByChild(name);
        if (await feed.emptyState.isVisible()) {
          emptyChildName = name;
          break;
        }
      }
      expect(
        emptyChildName,
        'Seed must include at least one linked child with no family-visible artifacts and no completed games',
      ).toBeTruthy();

      await expect(feed.emptyState).toBeVisible();
      await expect(feed.timeline).toHaveCount(0);
      // Empty-state copy is personalised to the filtered child's first name.
      const firstName = emptyChildName!.split(' ')[0];
      await expect(feed.emptyState).toContainText(firstName);
    });
  });
});
