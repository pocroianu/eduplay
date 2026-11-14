import { describe, expect, it } from 'vitest';
import { decodeCursor } from '@/lib/api/cursor';
import { getDraftArtifactsForTeacher } from '../get-draft-artifacts-for-teacher';
import { fakeClient, makeArtifactRow } from './fake-supabase';

describe('getDraftArtifactsForTeacher', () => {
  it('maps snake_case rows into the camelCase Artifact shape', async () => {
    const row = makeArtifactRow({
      visibility: 'draft',
      title: 'My drawing',
      metadata: { activityTypeId: 'drawing-canvas' },
    });
    const { client } = fakeClient({
      perTable: { child_artifacts: [{ data: [row], error: null }] },
    });

    const result = await getDraftArtifactsForTeacher(client);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: row.id,
      studentId: row.student_id,
      classId: row.class_id,
      title: 'My drawing',
      visibility: 'draft',
      artifactType: 'drawing',
      reviewedBy: null,
      reviewedAt: null,
      metadata: { activityTypeId: 'drawing-canvas' },
    });
  });

  it('filters to draft artifacts so approved responses leave the inbox', async () => {
    const { client, trace } = fakeClient({
      perTable: { child_artifacts: [{ data: [], error: null }] },
    });

    await getDraftArtifactsForTeacher(client);

    const eqCall = trace.calls.find(
      (c) => c.fn === 'eq' && c.args[0] === 'visibility',
    );
    expect(eqCall?.args).toEqual(['visibility', 'draft']);
    expect(trace.calls.find((c) => c.fn === 'in')).toBeUndefined();
  });

  it('scopes by classId when provided', async () => {
    const { client, trace } = fakeClient({
      perTable: { child_artifacts: [{ data: [], error: null }] },
    });

    await getDraftArtifactsForTeacher(client, { classId: 'cls-1' });

    const eq = trace.calls.find(
      (c) => c.fn === 'eq' && c.args[0] === 'class_id',
    );
    expect(eq?.args).toEqual(['class_id', 'cls-1']);
  });

  it('scopes by studentId when provided', async () => {
    const { client, trace } = fakeClient({
      perTable: { child_artifacts: [{ data: [], error: null }] },
    });

    await getDraftArtifactsForTeacher(client, { studentId: 'stu-1' });

    const eq = trace.calls.find(
      (c) => c.fn === 'eq' && c.args[0] === 'student_id',
    );
    expect(eq?.args).toEqual(['student_id', 'stu-1']);
  });

  it('scopes by created_at >= createdAfter when provided', async () => {
    const { client, trace } = fakeClient({
      perTable: { child_artifacts: [{ data: [], error: null }] },
    });

    await getDraftArtifactsForTeacher(client, {
      createdAfter: '2026-04-01T00:00:00.000Z',
    });

    const gte = trace.calls.find((c) => c.fn === 'gte');
    expect(gte?.args).toEqual(['created_at', '2026-04-01T00:00:00.000Z']);
  });

  it('scopes by created_at <= createdBefore when provided', async () => {
    const { client, trace } = fakeClient({
      perTable: { child_artifacts: [{ data: [], error: null }] },
    });

    await getDraftArtifactsForTeacher(client, {
      createdBefore: '2026-04-30T23:59:59.999Z',
    });

    const lte = trace.calls.find((c) => c.fn === 'lte');
    expect(lte?.args).toEqual(['created_at', '2026-04-30T23:59:59.999Z']);
  });

  it('combines all filters in a single query', async () => {
    const { client, trace } = fakeClient({
      perTable: { child_artifacts: [{ data: [], error: null }] },
    });

    await getDraftArtifactsForTeacher(client, {
      classId: 'cls-1',
      studentId: 'stu-1',
      createdAfter: '2026-04-01T00:00:00.000Z',
      createdBefore: '2026-04-30T23:59:59.999Z',
      limit: 10,
    });

    const eqs = trace.calls.filter((c) => c.fn === 'eq');
    expect(eqs.map((c) => c.args[0])).toEqual(
      expect.arrayContaining(['class_id', 'student_id']),
    );
    expect(trace.calls.find((c) => c.fn === 'gte')?.args).toEqual([
      'created_at',
      '2026-04-01T00:00:00.000Z',
    ]);
    expect(trace.calls.find((c) => c.fn === 'lte')?.args).toEqual([
      'created_at',
      '2026-04-30T23:59:59.999Z',
    ]);
    expect(trace.calls.find((c) => c.fn === 'limit')?.args).toEqual([11]);
  });

  it('throws when the underlying query errors', async () => {
    const { client } = fakeClient({
      perTable: {
        child_artifacts: [{ data: null, error: { message: 'rls denied' } }],
      },
    });
    await expect(getDraftArtifactsForTeacher(client)).rejects.toThrow(/rls denied/);
  });

  it('returns an empty array when no rows match', async () => {
    const { client } = fakeClient({
      perTable: { child_artifacts: [{ data: [], error: null }] },
    });
    expect(await getDraftArtifactsForTeacher(client)).toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it('keeps same-created_at rows reachable with a created_at/id cursor', async () => {
    const createdAt = '2026-05-03T10:15:30.000Z';
    const boundaryRow = makeArtifactRow({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      created_at: createdAt,
    });
    const nextSameSecondRow = makeArtifactRow({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      created_at: createdAt,
    });

    const firstPageClient = fakeClient({
      perTable: {
        child_artifacts: [
          { data: [boundaryRow, nextSameSecondRow], error: null },
        ],
      },
    });

    const firstPage = await getDraftArtifactsForTeacher(firstPageClient.client, {
      limit: 1,
    });

    expect(firstPage.items.map((artifact) => artifact.id)).toEqual([
      boundaryRow.id,
    ]);
    expect(decodeCursor(firstPage.nextCursor!)).toEqual({
      createdAt,
      id: boundaryRow.id,
    });

    const secondPageClient = fakeClient({
      perTable: {
        child_artifacts: [{ data: [nextSameSecondRow], error: null }],
      },
    });

    const secondPage = await getDraftArtifactsForTeacher(
      secondPageClient.client,
      {
        cursor: firstPage.nextCursor,
        limit: 1,
      },
    );

    expect(
      secondPageClient.trace.calls.find((call) => call.fn === 'or')?.args,
    ).toEqual([
      `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${boundaryRow.id})`,
    ]);
    expect(secondPage.items.map((artifact) => artifact.id)).toEqual([
      nextSameSecondRow.id,
    ]);
    expect(secondPage.nextCursor).toBeNull();
  });
});
