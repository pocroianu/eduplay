import { describe, expect, it } from 'vitest';

import {
  buildParentSeedRows,
  buildTeacherInsertableArtifactRows,
} from '../e2e/fixtures/parent-seed';

describe('parent E2E seed rows', () => {
  it('links every child through parent_children without backfilling students.parent_id', () => {
    const rows = buildParentSeedRows({
      teacherId: '11111111-1111-4111-8111-111111111111',
      parentId: '22222222-2222-4222-8222-222222222222',
      classId: '33333333-3333-4333-8333-333333333333',
      gameId: '44444444-4444-4444-8444-444444444444',
      now: new Date('2026-05-12T10:00:00.000Z'),
      contentChildCount: 2,
      children: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          username: 'e2e.child.a',
          fullName: 'Copil A',
          pin: '1234',
        },
        {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          username: 'e2e.child.b',
          fullName: 'Copil B',
          pin: '1234',
        },
        {
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          username: 'e2e.child.c',
          fullName: 'Copil C',
          pin: '1234',
        },
      ],
    });

    expect(rows.students).toHaveLength(3);
    expect(rows.students.map((row) => row.parent_id)).toEqual([
      null,
      null,
      null,
    ]);
    expect(rows.parentChildren).toHaveLength(3);
    expect(rows.parentChildren).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parent_id: '22222222-2222-4222-8222-222222222222',
          student_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          status: 'active',
          linked_via_code: expect.any(String),
        }),
      ]),
    );
    expect(rows.inviteCodes.map((row) => row.used_by)).toEqual([
      '22222222-2222-4222-8222-222222222222',
      '22222222-2222-4222-8222-222222222222',
      '22222222-2222-4222-8222-222222222222',
    ]);
  });

  it('creates a public published activity with a pinned version for assignment creation', () => {
    const rows = buildParentSeedRows({
      teacherId: '11111111-1111-4111-8111-111111111111',
      parentId: '22222222-2222-4222-8222-222222222222',
      classId: '33333333-3333-4333-8333-333333333333',
      gameId: '44444444-4444-4444-8444-444444444444',
      now: new Date('2026-05-12T10:00:00.000Z'),
      contentChildCount: 0,
      children: [],
    });

    expect(rows.activityRow).toMatchObject({
      status: 'published',
      is_published: true,
      visibility_scope: 'public',
    });
    expect(rows.activityVersionRow).toMatchObject({
      activity_id: rows.activityRow.id,
      activity_type_id: rows.activityRow.template,
      version_number: 1,
      config_data: {},
      config_schema_version: 1,
      published_by_user_id: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('creates artifacts and completed progress only for requested content children', () => {
    const rows = buildParentSeedRows({
      teacherId: '11111111-1111-4111-8111-111111111111',
      parentId: '22222222-2222-4222-8222-222222222222',
      classId: '33333333-3333-4333-8333-333333333333',
      gameId: '44444444-4444-4444-8444-444444444444',
      now: new Date('2026-05-12T10:00:00.000Z'),
      contentChildCount: 2,
      children: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          username: 'e2e.child.a',
          fullName: 'Copil A',
          pin: '1234',
        },
        {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          username: 'e2e.child.b',
          fullName: 'Copil B',
          pin: '1234',
        },
        {
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          username: 'e2e.child.c',
          fullName: 'Copil C',
          pin: '1234',
        },
      ],
    });

    expect(rows.familyArtifacts).toHaveLength(2);
    expect(rows.activityProgress).toHaveLength(2);
    expect(rows.familyArtifacts.map((row) => row.student_id)).toEqual([
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    ]);
    expect(rows.familyArtifacts.map((row) => row.visibility)).toEqual([
      'family_visible',
      'family_visible',
    ]);
    expect(rows.activityProgress.map((row) => row.status)).toEqual([
      'completed',
      'completed',
    ]);
  });

  it('converts published artifact fixtures to draft rows for teacher inserts', () => {
    const rows = buildParentSeedRows({
      teacherId: '11111111-1111-4111-8111-111111111111',
      parentId: '22222222-2222-4222-8222-222222222222',
      classId: '33333333-3333-4333-8333-333333333333',
      gameId: '44444444-4444-4444-8444-444444444444',
      now: new Date('2026-05-12T10:00:00.000Z'),
      contentChildCount: 1,
      children: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          username: 'e2e.child.a',
          fullName: 'Copil A',
          pin: '1234',
        },
      ],
    });

    const insertableRows = buildTeacherInsertableArtifactRows([
      ...rows.familyArtifacts,
      ...rows.draftArtifacts,
    ]);

    expect(rows.familyArtifacts[0]).toMatchObject({
      visibility: 'family_visible',
      reviewed_by: '11111111-1111-4111-8111-111111111111',
      reviewed_at: expect.any(String),
    });
    expect(insertableRows).toHaveLength(2);
    expect(insertableRows.map((row) => row.visibility)).toEqual([
      'draft',
      'draft',
    ]);
    expect(insertableRows[0]).toMatchObject({
      id: rows.familyArtifacts[0].id,
      reviewed_by: null,
      reviewed_at: null,
    });
  });
});
