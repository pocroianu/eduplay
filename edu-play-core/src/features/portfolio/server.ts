// Portfolio Feature - Server-Only Exports
// Only import from this file in Server Components, Server Actions, and Route Handlers.
// NEVER import from this file in Client Components.

export {
  getDraftArtifactsForTeacher,
  getFamilyVisibleArtifactsForChild,
  getFamilyVisibleArtifactsForChildren,
  getArtifactById,
  getArtifactsForChild,
  getSignedUrlsForArtifacts,
  groupArtifactsByMonth,
  parseTeacherPortfolioFilters,
  filtersToQueryOptions,
  type DraftArtifactsPage,
  type GetDraftArtifactsOptions,
  type GetFamilyVisibleArtifactsOptions,
  type GetFamilyVisibleArtifactsForChildrenOptions,
  type GetArtifactsForChildOptions,
  type ChildPortfolioRole,
  type ArtifactMonthGroup,
  type TeacherPortfolioRawFilters,
  type TeacherPortfolioFilterSet,
} from './queries';

// Server actions (each file is `'use server'` so these are RPC endpoints).
export { recordChildArtifact } from './actions/record-child-artifact';
export { decodeArtifactPayload } from './actions/internal/run-record-artifact';
export { withArtifactMedia } from './queries/with-artifact-media';
