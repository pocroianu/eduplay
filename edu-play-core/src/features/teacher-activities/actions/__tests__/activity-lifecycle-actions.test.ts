import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { archiveTeacherActivity } from '../archive-teacher-activity'
import { duplicateTeacherActivity } from '../duplicate-teacher-activity'
import { restoreTeacherActivity } from '../restore-teacher-activity'

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
}))

const revalidatePathMock = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
}))

type Row = Record<string, unknown>
type Store = Record<string, Row[]>

class Query {
  private filters: Array<[string, unknown]> = []

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

  single() {
    const row = (this.store[this.table] ?? []).find((candidate) =>
      this.filters.every(([column, value]) => candidate[column] === value),
    )
    return Promise.resolve({ data: row ?? null, error: row ? null : { message: 'not found' } })
  }
}

function makeSupabase(store: Store = { profiles: [{ id: 'teacher-1', role: 'teacher' }] }) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'teacher-1' } } }),
    },
    from: (table: string) => new Query(store, table),
  }
}

const createClientMock = vi.mocked(createClient)
const createAdminClientMock = vi.mocked(createAdminClient)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('teacher activity lifecycle actions', () => {
  it('duplicates through the owner-checked service-role RPC', async () => {
    createClientMock.mockResolvedValue(makeSupabase() as never)
    const rpc = vi.fn().mockResolvedValue({
      data: { activity: { id: 'duplicate-1' } },
      error: null,
    })
    createAdminClientMock.mockReturnValue({ rpc } as never)

    await expect(duplicateTeacherActivity('activity-1')).resolves.toEqual({
      success: true,
      data: { activityId: 'duplicate-1' },
    })

    expect(rpc).toHaveBeenCalledWith('duplicate_teacher_activity_atomically', {
      p_activity_id: 'activity-1',
      p_actor_id: 'teacher-1',
    })
    expect(revalidatePathMock).toHaveBeenCalledWith('/teacher/activities')
  })

  it('archives through the owner-checked service-role RPC', async () => {
    createClientMock.mockResolvedValue(makeSupabase() as never)
    const rpc = vi.fn().mockResolvedValue({
      data: { activity: { id: 'activity-1' } },
      error: null,
    })
    createAdminClientMock.mockReturnValue({ rpc } as never)

    await expect(archiveTeacherActivity('activity-1')).resolves.toEqual({
      success: true,
      data: { activityId: 'activity-1' },
    })

    expect(rpc).toHaveBeenCalledWith('archive_teacher_activity_atomically', {
      p_activity_id: 'activity-1',
      p_actor_id: 'teacher-1',
    })
    expect(revalidatePathMock).toHaveBeenCalledWith('/teacher/activities')
    expect(revalidatePathMock).toHaveBeenCalledWith('/teacher/assignments/new')
  })

  it('restores through the owner-checked service-role RPC', async () => {
    createClientMock.mockResolvedValue(makeSupabase() as never)
    const rpc = vi.fn().mockResolvedValue({
      data: { activity: { id: 'activity-1' } },
      error: null,
    })
    createAdminClientMock.mockReturnValue({ rpc } as never)

    await expect(restoreTeacherActivity('activity-1')).resolves.toEqual({
      success: true,
      data: { activityId: 'activity-1' },
    })

    expect(rpc).toHaveBeenCalledWith('restore_teacher_activity_atomically', {
      p_activity_id: 'activity-1',
      p_actor_id: 'teacher-1',
    })
    expect(revalidatePathMock).toHaveBeenCalledWith('/teacher/activities')
    expect(revalidatePathMock).toHaveBeenCalledWith('/teacher/assignments/new')
  })

  it('does not use service role when the caller is not a teacher', async () => {
    createClientMock.mockResolvedValue(makeSupabase({ profiles: [{ id: 'teacher-1', role: 'student' }] }) as never)
    const rpc = vi.fn()
    createAdminClientMock.mockReturnValue({ rpc } as never)

    await expect(duplicateTeacherActivity('activity-1')).resolves.toMatchObject({
      success: false,
      error: 'Nu ești autentificat ca profesor.',
    })
    await expect(archiveTeacherActivity('activity-1')).resolves.toMatchObject({
      success: false,
      error: 'Nu ești autentificat ca profesor.',
    })
    await expect(restoreTeacherActivity('activity-1')).resolves.toMatchObject({
      success: false,
      error: 'Nu ești autentificat ca profesor.',
    })
    expect(rpc).not.toHaveBeenCalled()
  })
})
