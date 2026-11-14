import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createClient } from '@/lib/supabase/server'
import { updateFreeResponseDraft } from '../update-free-response-draft'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

const revalidatePathMock = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
}))

type Row = Record<string, unknown>
type Store = Record<string, Row[]>

class Query {
  private filters: Array<[string, unknown, 'eq' | 'is']> = []
  private insertedRows: Row[] | null = null
  private updates: Row | null = null
  private shouldDelete = false
  private executed = false
  private orderColumn: string | null = null

  constructor(
    private readonly store: Store,
    private readonly table: string,
  ) {}

  select() {
    return this
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value, 'eq'])
    return this
  }

  is(column: string, value: unknown) {
    this.filters.push([column, value, 'is'])
    return this
  }

  order(column: string) {
    this.orderColumn = column
    return this.then.bind(this)
  }

  insert(payload: Row | Row[]) {
    const rows = Array.isArray(payload) ? payload : [payload]
    this.insertedRows = rows.map((row, index) => ({
      id: row.id ?? `${this.table}-${index + 1}`,
      ...row,
    }))
    this.store[this.table].push(...this.insertedRows)
    return this
  }

  update(payload: Row) {
    this.updates = payload
    return this
  }

  delete() {
    this.shouldDelete = true
    return this
  }

  single() {
    this.executeMutation()
    const rows = this.rows()
    return Promise.resolve({
      data: rows[0] ?? null,
      error: rows[0] ? null : { message: 'not found' },
    })
  }

  then(resolve: (value: { data: Row[]; error: null }) => unknown) {
    this.executeMutation()
    return Promise.resolve({ data: this.rows(), error: null }).then(resolve)
  }

  private executeMutation() {
    if (this.executed) return
    this.executed = true
    if (this.updates) {
      for (const row of this.store[this.table]) {
        if (this.matches(row)) Object.assign(row, this.updates)
      }
    }
    if (this.shouldDelete) {
      this.store[this.table] = this.store[this.table].filter((row) => !this.matches(row))
    }
  }

  private rows() {
    const rows = this.insertedRows ?? this.store[this.table].filter((row) => this.matches(row))
    if (!this.orderColumn) return rows
    return [...rows].sort((left, right) => Number(left[this.orderColumn!]) - Number(right[this.orderColumn!]))
  }

  private matches(row: Row) {
    return this.filters.every(([column, value]) => row[column] === value)
  }
}

function makeSupabase(overrides: Partial<Store> = {}) {
  const store: Store = {
    profiles: [{ id: 'teacher-1', role: 'teacher' }],
    activity_types: [{ type_id: 'free-response', version: 2, authoring_mode: 'teacher-simple' }],
    activities: [
      {
        id: 'activity-1',
        created_by: 'teacher-1',
        visibility_scope: 'private',
        template: 'free-response',
        status: 'draft',
        title: 'Veche',
        description: 'Veche',
        config_data: {
          prompt: 'Veche',
          allowedTools: { text: true, drawing: false, voice: false },
          shareWithFamilyOnApproval: false,
        },
      },
    ],
    activity_resources: [
      {
        id: 'resource-old',
        activity_id: 'activity-1',
        version_id: null,
        resource_type: 'link',
        title: 'Vechi',
        url: 'https://example.test/old',
        sort_order: 1,
        created_by: 'teacher-1',
      },
      {
        id: 'resource-version',
        activity_id: 'activity-1',
        version_id: 'version-1',
        resource_type: 'link',
        title: 'Snapshot',
        url: 'https://example.test/snapshot',
        sort_order: 1,
        created_by: 'teacher-1',
      },
    ],
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

beforeEach(() => {
  vi.clearAllMocks()
})

describe('updateFreeResponseDraft', () => {
  it('validates input before updating the activity', async () => {
    const supabase = makeSupabase()
    createClientMock.mockResolvedValue(supabase as never)

    const result = await updateFreeResponseDraft('activity-1', {
      title: '',
      prompt: '',
      allowedTools: { text: false, drawing: false, voice: false },
      shareWithFamilyOnApproval: false,
    })

    expect(result.success).toBe(false)
    expect(result.fieldErrors).toMatchObject({
      title: expect.any(String),
      prompt: expect.any(String),
      allowedTools: expect.any(String),
    })
    expect(supabase.store.activities[0]?.title).toBe('Veche')
  })

  it('denies edits to activities the teacher does not own', async () => {
    const supabase = makeSupabase({
      activities: [
        {
          id: 'activity-1',
          created_by: 'teacher-2',
          visibility_scope: 'private',
          template: 'free-response',
          status: 'draft',
        },
      ],
    })
    createClientMock.mockResolvedValue(supabase as never)

    const result = await updateFreeResponseDraft('activity-1', {
      title: 'Nouă',
      prompt: 'Instrucțiuni',
      allowedTools: { text: true, drawing: false, voice: false },
      shareWithFamilyOnApproval: false,
      resources: [],
    })

    expect(result).toMatchObject({ success: false, error: expect.stringMatching(/doar activitățile tale/i) })
    expect(supabase.store.activities[0]?.title).toBeUndefined()
  })

  it('denies edits to ready activities so existing version pins keep their visible content', async () => {
    const supabase = makeSupabase({
      activities: [
        {
          id: 'activity-1',
          created_by: 'teacher-1',
          visibility_scope: 'private',
          template: 'free-response',
          status: 'published',
          title: 'Gata',
        },
      ],
    })
    createClientMock.mockResolvedValue(supabase as never)

    const result = await updateFreeResponseDraft('activity-1', {
      title: 'Nouă',
      prompt: 'Instrucțiuni',
      allowedTools: { text: true, drawing: false, voice: false },
      shareWithFamilyOnApproval: false,
      resources: [],
    })

    expect(result).toMatchObject({ success: false, error: expect.stringMatching(/doar ciorne/i) })
    expect(supabase.store.activities[0]?.title).toBe('Gata')
  })

  it('updates the editable activity config and replaces only live resources', async () => {
    const supabase = makeSupabase()
    createClientMock.mockResolvedValue(supabase as never)

    const result = await updateFreeResponseDraft('activity-1', {
      title: 'Poveste actualizată',
      prompt: 'Scrie și desenează.',
      allowedTools: { text: true, drawing: true, voice: false },
      shareWithFamilyOnApproval: true,
      resources: [
        { title: 'Model', url: 'https://example.test/model' },
        { title: 'Cântec', url: 'https://example.test/cantec' },
      ],
    })

    expect(result).toEqual({ success: true, data: { id: 'activity-1' } })
    expect(supabase.store.activities[0]).toMatchObject({
      title: 'Poveste actualizată',
      description: 'Scrie și desenează.',
      config_schema_version: 2,
      config_data: {
        prompt: 'Scrie și desenează.',
        allowedTools: { text: true, drawing: true, voice: false },
        shareWithFamilyOnApproval: true,
      },
    })
    expect(supabase.store.activity_resources).toEqual([
      expect.objectContaining({
        id: 'resource-version',
        version_id: 'version-1',
        title: 'Snapshot',
      }),
      expect.objectContaining({
        activity_id: 'activity-1',
        version_id: null,
        title: 'Model',
        url: 'https://example.test/model',
        sort_order: 1,
        created_by: 'teacher-1',
      }),
      expect.objectContaining({
        activity_id: 'activity-1',
        version_id: null,
        title: 'Cântec',
        url: 'https://example.test/cantec',
        sort_order: 2,
        created_by: 'teacher-1',
      }),
    ])
    expect(revalidatePathMock).toHaveBeenCalledWith('/teacher/activities')
    expect(revalidatePathMock).toHaveBeenCalledWith('/teacher/activities/activity-1/edit')
    expect(revalidatePathMock).toHaveBeenCalledWith('/play/activity-1')
  })
})
