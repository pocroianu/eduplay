import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { makeActivityReady } from '../make-activity-ready'

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

const freeResponseSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['prompt', 'allowedTools', 'shareWithFamilyOnApproval'],
  additionalProperties: false,
  properties: {
    prompt: { type: 'string', minLength: 1, pattern: '\\S' },
    allowedTools: {
      type: 'object',
      required: ['text', 'drawing', 'voice'],
      additionalProperties: false,
      properties: {
        text: { type: 'boolean' },
        drawing: { type: 'boolean' },
        voice: { type: 'boolean' },
      },
    },
    shareWithFamilyOnApproval: { type: 'boolean' },
  },
  anyOf: [
    { properties: { allowedTools: { properties: { text: { const: true } } } } },
    { properties: { allowedTools: { properties: { drawing: { const: true } } } } },
    { properties: { allowedTools: { properties: { voice: { const: true } } } } },
  ],
}

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
    const row = this.execute()[0] ?? null
    return Promise.resolve({ data: row, error: row ? null : { message: 'not found' } })
  }

  maybeSingle() {
    const row = this.execute()[0] ?? null
    return Promise.resolve({ data: row, error: null })
  }

  private execute() {
    return (this.store[this.table] ?? []).filter((row) =>
      this.filters.every(([column, value]) => row[column] === value),
    )
  }
}

function activity(overrides: Row = {}): Row {
  return {
    id: 'activity-1',
    template: 'free-response',
    status: 'draft',
    is_published: false,
    visibility_scope: 'private',
    config_data: {
      prompt: 'Scrie un răspuns.',
      allowedTools: { text: true, drawing: false, voice: false },
      shareWithFamilyOnApproval: false,
    },
    config_schema_version: 1,
    created_by: 'teacher-1',
    ...overrides,
  }
}

function typeRow(overrides: Row = {}): Row {
  return {
    type_id: 'free-response',
    display_name: 'Free response',
    category: 'creative',
    config_schema: freeResponseSchema,
    renderer_key: 'free-response',
    renderer_kind: 'react',
    authoring_mode: 'teacher-simple',
    produces_submission: true,
    supports_review: true,
    is_auto_scored: false,
    version: 1,
    created_at: '2026-05-19T00:00:00.000Z',
    updated_at: '2026-05-19T00:00:00.000Z',
    ...overrides,
  }
}

function makeSupabase(store: Store) {
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

describe('makeActivityReady', () => {
  it('validates the owned private config and snapshots it through the private-ready RPC', async () => {
    const supabase = makeSupabase({
      profiles: [{ id: 'teacher-1', role: 'teacher' }],
      activities: [activity()],
      activity_types: [typeRow()],
    })
    const rpc = vi.fn().mockResolvedValue({
      data: { version: { id: 'version-1', version_number: 1 } },
      error: null,
    })
    createClientMock.mockResolvedValue(supabase as never)
    createAdminClientMock.mockReturnValue({ rpc } as never)

    await expect(makeActivityReady('activity-1')).resolves.toEqual({
      success: true,
      data: { activityId: 'activity-1', versionId: 'version-1', versionNumber: 1 },
    })

    expect(rpc).toHaveBeenCalledWith('make_teacher_activity_ready_atomically', {
      p_activity_id: 'activity-1',
      p_activity_type_id: 'free-response',
      p_actor_id: 'teacher-1',
      p_before_config_schema_version: 1,
      p_before_is_published: false,
      p_before_status: 'draft',
      p_config_data: {
        prompt: 'Scrie un răspuns.',
        allowedTools: { text: true, drawing: false, voice: false },
        shareWithFamilyOnApproval: false,
      },
      p_config_schema_version: 1,
    })
    expect(revalidatePathMock).toHaveBeenCalledWith('/teacher/activities')
  })

  it('rejects activities that are not owned by the teacher before using service role', async () => {
    const supabase = makeSupabase({
      profiles: [{ id: 'teacher-1', role: 'teacher' }],
      activities: [activity({ created_by: 'teacher-2' })],
      activity_types: [typeRow()],
    })
    const rpc = vi.fn()
    createClientMock.mockResolvedValue(supabase as never)
    createAdminClientMock.mockReturnValue({ rpc } as never)

    await expect(makeActivityReady('activity-1')).resolves.toMatchObject({
      success: false,
      error: 'Nu am găsit activitatea ta privată.',
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects invalid free-response config before creating a version snapshot', async () => {
    const supabase = makeSupabase({
      profiles: [{ id: 'teacher-1', role: 'teacher' }],
      activities: [
        activity({
          config_data: {
            prompt: ' ',
            allowedTools: { text: false, drawing: false, voice: false },
            shareWithFamilyOnApproval: false,
          },
        }),
      ],
      activity_types: [typeRow()],
    })
    const rpc = vi.fn()
    createClientMock.mockResolvedValue(supabase as never)
    createAdminClientMock.mockReturnValue({ rpc } as never)

    await expect(makeActivityReady('activity-1')).resolves.toMatchObject({
      success: false,
      error: 'Verifică instrucțiunile și opțiunile înainte să marchezi activitatea ca gata.',
    })
    expect(rpc).not.toHaveBeenCalled()
  })
})
