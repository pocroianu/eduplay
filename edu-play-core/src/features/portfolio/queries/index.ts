// Portfolio Queries
// Wrapped in React `cache()` so a layout + page composition that calls the
// same query in one render doesn't fan-out into multiple DB round-trips.

import { cache } from 'react';
import { getDraftArtifactsForTeacher as _getDraftArtifactsForTeacher } from './get-draft-artifacts-for-teacher';
import { getFamilyVisibleArtifactsForChild as _getFamilyVisibleArtifactsForChild } from './get-family-visible-artifacts-for-child';
import { getFamilyVisibleArtifactsForChildren as _getFamilyVisibleArtifactsForChildren } from './get-family-visible-artifacts-for-children';
import { getArtifactById as _getArtifactById } from './get-artifact-by-id';
import { getArtifactsForChild as _getArtifactsForChild } from './get-artifacts-for-child';
import { getSignedUrlsForArtifacts as _getSignedUrlsForArtifacts } from './get-signed-urls-for-artifacts';

export const getDraftArtifactsForTeacher = cache(_getDraftArtifactsForTeacher);
export const getFamilyVisibleArtifactsForChild = cache(
  _getFamilyVisibleArtifactsForChild,
);
export const getFamilyVisibleArtifactsForChildren = cache(
  _getFamilyVisibleArtifactsForChildren,
);
export const getArtifactById = cache(_getArtifactById);
export const getArtifactsForChild = cache(_getArtifactsForChild);
export const getSignedUrlsForArtifacts = cache(_getSignedUrlsForArtifacts);

export type {
  DraftArtifactsPage,
  GetDraftArtifactsOptions,
} from './get-draft-artifacts-for-teacher';
export type { GetFamilyVisibleArtifactsOptions } from './get-family-visible-artifacts-for-child';
export type { GetFamilyVisibleArtifactsForChildrenOptions } from './get-family-visible-artifacts-for-children';
export type {
  GetArtifactsForChildOptions,
  ChildPortfolioRole,
} from './get-artifacts-for-child';
export { type ArtifactRow } from './types';
export {
  parseTeacherPortfolioFilters,
  filtersToQueryOptions,
  type TeacherPortfolioRawFilters,
  type TeacherPortfolioFilterSet,
} from './parse-teacher-portfolio-filters';
export {
  groupArtifactsByMonth,
  type ArtifactMonthGroup,
} from './group-artifacts-by-month';
