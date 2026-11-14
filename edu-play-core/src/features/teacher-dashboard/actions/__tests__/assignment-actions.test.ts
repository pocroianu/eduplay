import { beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveLatestPublishedActivityAssignmentTarget } from '@/features/activities/server'
import { createClient } from '@/lib/supabase/server'
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
      id: row.id ?? `assignment-${index + 1}`,
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
    profiles: [{ id: 'teacher-1', role: 'teacher' }],
    classes: [{ id: CLASS_ID, teacher_id: 'teacher-1' }],
    students: [
      { id: STUDENT_ONE_ID, class_id: CLASS_ID },
      { id: STUDENT_TWO_ID, class_id: CLASS_ID },
    ],
    assignments: [],
    ...overrides,
  }

  return {
    store,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'teacher-1' } } }),
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
      data: { id: 'assignment-1', ids: ['assignment-1', 'assignment-2'] },
    })
    expect(resolveTargetMock).toHaveBeenCalledWith(expect.anything(), ACTIVITY_ID)
    expect(supabase.store.assignments).toEqual([
      expect.objectContaining({
        teacher_id: 'teacher-1',
        activity_id: ACTIVITY_ID,
        version_id: VERSION_ID,
        class_id: null,
        student_id: STUDENT_ONE_ID,
        due_date: null,
        is_mandatory: true,
      }),
      expect.objectContaining({
        teacher_id: 'teacher-1',
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
