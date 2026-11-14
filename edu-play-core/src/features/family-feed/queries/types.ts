// Shared types for family-feed queries.
// 33.C will introduce real DB rows; this file currently only houses the
// pagination cursor contract so the stub query and downstream UI agree on
// the envelope shape.

import type { FamilyFeedPage } from '../types';

/**
 * Options accepted by `getFamilyFeed`. `childId` narrows to a single child
 * (used by the child-selector), otherwise the feed is the union of every
 * child the parent is linked to.
 */
export interface GetFamilyFeedOptions {
  childId?: string;
  /** Page size. Defaults to 20. */
  limit?: number;
  /** Opaque cursor returned by a prior page. */
  cursor?: string | null;
}

export type GetFamilyFeedResult = FamilyFeedPage;
