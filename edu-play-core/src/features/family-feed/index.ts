// Family Feed Feature Module - Public API
// Client-safe exports only. Query functions live in `./server` per
// CLAUDE.md § Server/Client Code Separation.

// Types
export type {
  FeedItem,
  FeedItemBase,
  ArtifactPublishedFeedItem,
  GameCompletedFeedItem,
  FamilyFeedPage,
  EnrichedFeedItem,
} from './types';

// Components
export {
  FeedTimeline,
  type FeedTimelineProps,
  ChildSelector,
  type ChildSelectorProps,
  type ChildOption,
  FeedEmptyState,
  type FeedEmptyStateProps,
} from './components';
