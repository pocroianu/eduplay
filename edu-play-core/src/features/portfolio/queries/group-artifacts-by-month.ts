import { formatMonthYear } from '@/lib/i18n/formatters';
import type { Artifact } from '../types';

export interface ArtifactMonthGroup {
  /** ISO key of the form `YYYY-MM` so the React key is stable across renders. */
  key: string;
  /** Localized month label, e.g. "mai 2026" (Romanian, lowercase month). */
  label: string;
  artifacts: Artifact[];
}

/**
 * Groups a chronologically-sorted artifact list (most recent first) into
 * month buckets. Input order is preserved within each bucket so callers do
 * not need to re-sort.
 *
 * Pure function — safe to use from server components or unit tests.
 */
export function groupArtifactsByMonth(
  artifacts: readonly Artifact[],
): ArtifactMonthGroup[] {
  const buckets = new Map<string, ArtifactMonthGroup>();

  for (const artifact of artifacts) {
    const date = new Date(artifact.createdAt);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.artifacts.push(artifact);
    } else {
      buckets.set(key, {
        key,
        label: formatMonthYear(date),
        artifacts: [artifact],
      });
    }
  }

  return Array.from(buckets.values());
}
