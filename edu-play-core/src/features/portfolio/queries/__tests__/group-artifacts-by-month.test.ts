import { describe, expect, it } from 'vitest';
import type { Artifact } from '../../types';
import { groupArtifactsByMonth } from '../group-artifacts-by-month';

function makeArtifact(overrides: Partial<Artifact> & { id: string }): Artifact {
  return {
    studentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    classId: null,
    title: 'Pictura',
    artifactType: 'drawing',
    storagePath: 'students/x/y.png',
    visibility: 'family_visible',
    reviewedBy: null,
    reviewedAt: null,
    metadata: {},
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

describe('groupArtifactsByMonth', () => {
  it('returns empty array for empty input', () => {
    expect(groupArtifactsByMonth([])).toEqual([]);
  });

  it('groups artifacts in the same month into one bucket', () => {
    const a = makeArtifact({ id: 'a', createdAt: '2026-05-08T10:00:00Z' });
    const b = makeArtifact({ id: 'b', createdAt: '2026-05-01T10:00:00Z' });

    const groups = groupArtifactsByMonth([a, b]);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('2026-05');
    expect(groups[0].artifacts.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('keeps month order and preserves input ordering inside each bucket', () => {
    const may2 = makeArtifact({ id: 'may-2', createdAt: '2026-05-08T10:00:00Z' });
    const may1 = makeArtifact({ id: 'may-1', createdAt: '2026-05-01T10:00:00Z' });
    const apr2 = makeArtifact({ id: 'apr-2', createdAt: '2026-04-15T10:00:00Z' });

    const groups = groupArtifactsByMonth([may2, may1, apr2]);

    expect(groups.map((g) => g.key)).toEqual(['2026-05', '2026-04']);
    expect(groups[0].artifacts.map((x) => x.id)).toEqual(['may-2', 'may-1']);
    expect(groups[1].artifacts.map((x) => x.id)).toEqual(['apr-2']);
  });

  it('produces a non-empty Romanian month label', () => {
    const artifact = makeArtifact({
      id: 'a',
      createdAt: '2026-05-01T00:00:00Z',
    });

    const [group] = groupArtifactsByMonth([artifact]);

    expect(group.label).toMatch(/2026/);
    // Romanian "mai" appears for May; we only assert non-empty + 4-digit year
    // to avoid coupling the test to ICU output details.
    expect(group.label.length).toBeGreaterThan(0);
  });
});
