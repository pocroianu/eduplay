import { beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveLatestPublishedActivityAssignmentTarget } from '@/features/activities/server'
import { createClient } from '@/lib/supabase/server'
import { createTeacherAssignment } from '../../assignments/create-assignment'
import { createAssignment } from '../assignment-actions'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/features/activities/server', () => ({
  resolveLatestPublishedActivityAssignmentTarget: vi.fn(),
}))

const revalidatePathMock = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
}))

const ACTIVITY_ID = '550e8400-e29b-41d4-a716-446655440000'
const VERSION_ID = '660e8400-e29b-41d4-a716-446655440000'
const CLASS_ID = '770e8400-e29b-41d4-a716-446655440000'
const STUDENT_ONE_ID = '11111111-1111-4111-8111-111111111111'
const STUDENT_TWO_ID = '22222222-2222-4222-8222-222222222222'

type Row = Record<string, unknown>
type Store = Record<string, Row[]>

class Query {
  private filters: Array<[string, unknown]> = []
  private inFilters: Array<[string, unknown[]]> = []
  private insertedRows: Row[] | null = null

  constructor(
    private readonly store: Store,
    private readonly table: string,
  ) {}

  select() {
    return this
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value])
    return this
  }

  in(column: string, values: unknown[]) {
    this.inFilters.push([column, values])
    return this
  }

  insert(payload: Row | Row[]) {
    const rows = Array.isArray(payload) ? payload : [payload]
    this.insertedRows = rows.map((row, index) => ({
      id: row.id ?? `90000000-0000-4000-8000-00000000000${index + 1}`,
      created_at: null, updated_at: null,
      ...row,
    }))
    this.store[this.table].push(...this.insertedRows)
    return this
  }

  single() {
    const rows = this.execute()
    return Promise.resolve({
      data: rows[0] ?? null,
      error: rows[0] ? null : { message: 'not found' },
    })
  }

  then(resolve: (value: { data: Row[]; error: null }) => void) {
    resolve({ data: this.execute(), error: null })
  }

  private execute() {
    if (this.insertedRows) return this.insertedRows

    return (this.store[this.table] ?? []).filter((row) =>
      this.filters.every(([column, value]) => row[column] === value) &&
      this.inFilters.every(([column, values]) => values.includes(row[column])),
    )
  }
}

function makeSupabase(overrides: Partial<Store> = {}) {
  const store: Store = {
    profiles: [{ id: '88888888-8888-4888-8888-888888888888', role: 'teacher' }],
    classes: [{ id: CLASS_ID, teacher_id: '88888888-8888-4888-8888-888888888888' }],
    students: [
      { id: STUDENT_ONE_ID, class_id: CLASS_ID },
      { id: STUDENT_TWO_ID, class_id: CLASS_ID },
    ],
    assignments: [],
    ...overrides,
  }

  return {
    store,
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: '88888888-8888-4888-8888-888888888888' } } }),
    },
    from: (table: string) => new Query(store, table),
  }
}

const createClientMock = vi.mocked(createClient)
const resolveTargetMock = vi.mocked(resolveLatestPublishedActivityAssignmentTarget)

beforeEach(() => {
  vi.clearAllMocks()
  resolveTargetMock.mockResolvedValue({
    activityId: ACTIVITY_ID,
    versionId: VERSION_ID,
    title: 'Activitate gata',
  })
})

describe('createAssignment', () => {
  it('creates one latest-version assignment row per selected student without a class target', async () => {
    const supabase = makeSupabase()
    createClientMock.mockResolvedValue(supabase as never)

    const result = await createAssignment({
      activityId: ACTIVITY_ID,
      studentIds: [STUDENT_ONE_ID, STUDENT_TWO_ID],
      isMandatory: true,
    })

    expect(result).toEqual({
      success: true,
      data: { id: '90000000-0000-4000-8000-000000000001', ids: ['90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002'] },
    })
    expect(resolveTargetMock).toHaveBeenCalledWith(expect.anything(), ACTIVITY_ID)
    expect(supabase.store.assignments).toEqual([
      expect.objectContaining({
        teacher_id: '88888888-8888-4888-8888-888888888888',
        activity_id: ACTIVITY_ID,
        version_id: VERSION_ID,
        class_id: null,
        student_id: STUDENT_ONE_ID,
        due_date: null,
        is_mandatory: true,
      }),
      expect.objectContaining({
        teacher_id: '88888888-8888-4888-8888-888888888888',
        activity_id: ACTIVITY_ID,
        version_id: VERSION_ID,
        class_id: null,
        student_id: STUDENT_TWO_ID,
        due_date: null,
        is_mandatory: true,
      }),
    ])
    expect(revalidatePathMock).toHaveBeenCalledWith('/teacher/assignments')
    expect(revalidatePathMock).toHaveBeenCalledWith(`/teacher/classes/${CLASS_ID}`)
  })

  it('creates a class assignment with optional due date omitted', async () => {
    const supabase = makeSupabase()
    createClientMock.mockResolvedValue(supabase as never)

    await expect(
      createAssignment({
        activityId: ACTIVITY_ID,
        classId: CLASS_ID,
      }),
    ).resolves.toMatchObject({ success: true })

    expect(supabase.store.assignments[0]).toMatchObject({
      activity_id: ACTIVITY_ID,
      version_id: VERSION_ID,
      class_id: CLASS_ID,
      student_id: null,
      due_date: null,
      is_mandatory: false,
    })
  })
})


it('shared workflow rejects foreign students before inserting Assignments', async () => {
  const client = makeSupabase({ students: [] });
  await expect(createTeacherAssignment(client as never, '88888888-8888-4888-8888-888888888888', {
    activityId: ACTIVITY_ID, studentIds: [STUDENT_ONE_ID], isMandatory: false,
  })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  expect(client.store.assignments).toHaveLength(0);
});
it('shared workflow rejects an Activity without a published version before writing', async () => {
  const client = makeSupabase();
  resolveTargetMock.mockResolvedValue(null);
  await expect(createTeacherAssignment(client as never, '88888888-8888-4888-8888-888888888888', {
    activityId: ACTIVITY_ID, classId: CLASS_ID, isMandatory: false,
  })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  expect(client.store.assignments).toHaveLength(0);
});
it('notifies each target parent after commit and preserves success if notification fails', async () => {
  const client = makeSupabase();
  createClientMock.mockResolvedValue(client as never);
  client.rpc.mockResolvedValue({ data: null, error: { message: 'offline' } });
  const result = await createAssignment({ activityId: ACTIVITY_ID, classId: CLASS_ID });
  expect(result.success).toBe(true);
  expect(client.store.assignments).toHaveLength(1);
  expect(client.rpc).toHaveBeenCalledTimes(2);
  expect(client.rpc).toHaveBeenCalledWith('notify_linked_parents', expect.objectContaining({ p_student_id: STUDENT_ONE_ID }));
});
