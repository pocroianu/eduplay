// Family Feed Queries
// Wrapped in React `cache()` so a layout + page composition that calls the
// same query in one render doesn't fan-out into multiple DB round-trips.

import { cache } from 'react';
import { getFamilyFeed as _getFamilyFeed } from './get-family-feed';

export const getFamilyFeed = cache(_getFamilyFeed);

export type { GetFamilyFeedOptions, GetFamilyFeedResult } from './types';

export { enrichFeedItemsWithSignedUrls } from './enrich-feed-with-signed-urls';
