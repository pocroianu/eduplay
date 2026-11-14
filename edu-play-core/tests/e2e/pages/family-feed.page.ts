import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Family learning feed Page Object Model — `/parent` (EDU-287).
 *
 * The feed surface ships with EDU-286 and renders one of three things:
 *   - The cross-child timeline (no `?child` param).
 *   - A child-filtered timeline (`?child=<id>` mapping to a linked child).
 *   - The empty state when the merged feed is empty.
 *
 * Locators are anchored on stable `data-testid` attributes published by the
 * feature components rather than visual text, except for the "Toți copiii"
 * all-children pill — that copy is the public contract of the selector.
 *
 * The pill row is a `role="group"` of `<button type="button" aria-pressed>`
 * elements (not a tablist). Filter pills are toggle buttons, not tabs — see
 * EDU-286 / PR #146 for the rationale.
 */
export class FamilyFeedPage extends BasePage {
  readonly childSelector: Locator;
  readonly allChildrenPill: Locator;
  readonly timeline: Locator;
  readonly emptyState: Locator;
  readonly feedItems: Locator;
  readonly artifactCards: Locator;
  readonly gameCards: Locator;

  constructor(page: Page) {
    super(page);

    this.childSelector = page.getByTestId('family-feed-child-selector');
    this.allChildrenPill = this.childSelector.getByRole('button', {
      name: /^toți copiii$/i,
    });
    this.timeline = page.getByTestId('family-feed-timeline');
    this.emptyState = page.getByTestId('family-feed-empty-state');
    this.feedItems = this.timeline.locator('[data-feed-kind]');
    this.artifactCards = this.timeline.locator(
      '[data-feed-kind="artifact_published"]',
    );
    this.gameCards = this.timeline.locator('[data-feed-kind="game_completed"]');
  }

  get urlPattern(): string {
    return '/parent';
  }

  async goto(): Promise<void> {
    await this.page.goto('/parent');
    await this.waitForPageLoad();
  }

  /**
   * Locate a child pill by its display name. Used to assert presence and to
   * drive the per-child filter.
   */
  childPill(name: string | RegExp): Locator {
    if (typeof name === 'string') {
      return this.childSelector.getByRole('button', { name, exact: true });
    }
    return this.childSelector.getByRole('button', { name });
  }

  /**
   * All per-child pills (excludes the "Toți copiii" all-children pill).
   * Used to enumerate linked children for the spec without hard-coding
   * names from the seed.
   */
  get childPills(): Locator {
    return this.childSelector.getByRole('button').filter({
      hasNotText: /^toți copiii$/i,
    });
  }

  /**
   * Click a per-child pill and wait until the active filter is fully applied:
   * the URL has `?child=<id>`, the clicked pill flips to `aria-pressed='true'`,
   * and the feed surface (timeline or empty state) is visible again.
   *
   * `ChildSelector` calls `router.replace` inside `useTransition`, so the URL
   * change resolves before the server-component payload swap completes.
   * Waiting on `aria-pressed` (mirrored client-side from the new
   * `selectedChildId`) plus `waitForFeedReady` pins us to the post-render
   * state, so card assertions can't run against the stale cross-child view.
   */
  async filterByChild(name: string | RegExp): Promise<string> {
    const pill = this.childPill(name);
    await pill.click();
    await this.page.waitForURL(/[?&]child=[^&]+/, { timeout: 5000 });
    await expect(pill).toHaveAttribute('aria-pressed', 'true');
    await this.waitForFeedReady();
    const id = this.getActiveChildIdFromUrl();
    if (!id) {
      throw new Error(
        `Expected ?child=<id> after clicking pill "${String(name)}"`,
      );
    }
    return id;
  }

  /**
   * Click "Toți copiii" and wait until the cross-child view is fully applied:
   * the `child` query param is gone, the all-children pill is
   * `aria-pressed='true'`, and the feed surface is visible. Same render-race
   * caveat as `filterByChild`.
   */
  async clearChildFilter(): Promise<void> {
    await this.allChildrenPill.click();
    await this.page.waitForURL((url) => !url.searchParams.has('child'), {
      timeout: 5000,
    });
    await expect(this.allChildrenPill).toHaveAttribute('aria-pressed', 'true');
    await this.waitForFeedReady();
  }

  /**
   * Read the `child` query param from the current URL. Returns `null` when
   * the cross-child filter is active.
   */
  getActiveChildIdFromUrl(): string | null {
    return new URL(this.page.url()).searchParams.get('child');
  }

  /**
   * Returns the `data-feed-kind` value for each item rendered in the feed,
   * top-to-bottom — useful for asserting newest-first ordering.
   */
  async getRenderedKindsInOrder(): Promise<string[]> {
    const handles = await this.feedItems.elementHandles();
    const kinds = await Promise.all(
      handles.map((handle) => handle.getAttribute('data-feed-kind')),
    );
    return kinds.filter((k): k is string => k !== null);
  }

  /**
   * Returns each card's feed timestamp in rendered order. The component
   * exposes the raw ISO value as a test hook because visible relative-time
   * copy is intentionally locale/time dependent.
   */
  async getRenderedTimestampsInOrder(): Promise<string[]> {
    const handles = await this.feedItems.elementHandles();
    const timestamps = await Promise.all(
      handles.map((handle) => handle.getAttribute('data-feed-timestamp')),
    );
    return timestamps.filter((ts): ts is string => ts !== null);
  }

  /**
   * Wait for the feed surface to settle into either the timeline or the
   * empty state. Either branch is a successful render.
   */
  async waitForFeedReady(): Promise<void> {
    await expect(this.timeline.or(this.emptyState)).toBeVisible();
  }
}
