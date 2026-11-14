import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createClient } from '@/lib/supabase/server'
import { saveFreeResponseDraft } from '../save-free-response-draft'

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
  private filters: Array<[string, unknown]> = []
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

  insert(payload: Row | Row[]) {
    const rows = Array.isArray(payload) ? payload : [payload]
    this.insertedRows = rows.map((row, index) => ({
      id: row.id ?? `created-${index + 1}`,
      ...row,
    }))
    this.store[this.table].push(...this.insertedRows)
    return this
  }

  single() {
    const rows = this.insertedRows ?? this.store[this.table].filter((row) => this.matches(row))
    return Promise.resolve({
      data: rows[0] ?? null,
      error: rows[0] ? null : { message: 'not found' },
    })
  }

  private matches(row: Row) {
    return this.filters.every(([column, value]) => row[column] === value)
  }
}

function makeSupabase(overrides: Partial<Store> = {}) {
  const store: Store = {
    profiles: [{ id: 'teacher-1', role: 'teacher' }],
    activity_types: [{ type_id: 'free-response', version: 1, authoring_mode: 'teacher-simple' }],
    activities: [],
    activity_resources: [],
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

describe('saveFreeResponseDraft', () => {
  it('validates title, prompt, and at least one allowed tool before writing', async () => {
    const supabase = makeSupabase()
    createClientMock.mockResolvedValue(supabase as never)

    const result = await saveFreeResponseDraft({
      title: ' ',
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
    expect(supabase.store.activities).toHaveLength(0)
  })

  it('rejects invalid link resources before writing', async () => {
    const supabase = makeSupabase()
    createClientMock.mockResolvedValue(supabase as never)

    const result = await saveFreeResponseDraft({
      title: 'Povestea mea',
      prompt: 'Scrie, desenează și povestește.',
      allowedTools: { text: true, drawing: true, voice: false },
      shareWithFamilyOnApproval: true,
      resources: [{ title: 'Video', url: 'ftp://example.test/video' }],
    })

    expect(result.success).toBe(false)
    expect(result.fieldErrors).toMatchObject({ resources: expect.any(String) })
    expect(supabase.store.activities).toHaveLength(0)
    expect(supabase.store.activity_resources).toHaveLength(0)
  })

  it('creates a private free-response activity draft with reusable config and ordered link resources', async () => {
    const supabase = makeSupabase()
    createClientMock.mockResolvedValue(supabase as never)

    const result = await saveFreeResponseDraft({
      title: 'Povestea mea',
      prompt: 'Scrie, desenează și povestește.',
      allowedTools: { text: true, drawing: true, voice: false },
      shareWithFamilyOnApproval: true,
      resources: [
        { title: 'Cântec de inspirație', url: 'https://example.test/cantec' },
        { title: 'Imagine model', url: 'https://example.test/model' },
      ],
    })

    expect(result).toEqual({ success: true, data: { id: 'created-1' } })
    expect(supabase.store.activities[0]).toMatchObject({
      template: 'free-response',
      title: 'Povestea mea',
      description: 'Scrie, desenează și povestește.',
      status: 'draft',
      is_published: false,
      visibility_scope: 'private',
      config_schema_version: 1,
      created_by: 'teacher-1',
      config_data: {
        prompt: 'Scrie, desenează și povestește.',
        allowedTools: { text: true, drawing: true, voice: false },
        shareWithFamilyOnApproval: true,
      },
    })
    expect(supabase.store.activity_resources).toEqual([
      expect.objectContaining({
        activity_id: 'created-1',
        version_id: null,
        resource_type: 'link',
        title: 'Cântec de inspirație',
        url: 'https://example.test/cantec',
        sort_order: 1,
        created_by: 'teacher-1',
      }),
      expect.objectContaining({
        activity_id: 'created-1',
        version_id: null,
        resource_type: 'link',
        title: 'Imagine model',
        url: 'https://example.test/model',
        sort_order: 2,
        created_by: 'teacher-1',
      }),
    ])
    expect(revalidatePathMock).toHaveBeenCalledWith('/teacher/activities')
    expect(revalidatePathMock).toHaveBeenCalledWith('/teacher/activities/create')
  })
})
