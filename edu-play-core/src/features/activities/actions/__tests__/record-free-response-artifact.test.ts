import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClientMock = vi.fn()
const createAdminClientMock = vi.fn()
const recordChildArtifactMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => createAdminClientMock(),
  createClient: () => createClientMock(),
}))

vi.mock('@/features/portfolio', () => ({
  recordChildArtifact: (...args: unknown[]) => recordChildArtifactMock(...args),
}))

import { recordFreeResponseArtifact } from '../record-free-response-artifact'

const studentId = '22222222-2222-4222-8222-222222222222'
const assignmentId = '11111111-1111-4111-8111-111111111111'
const activityId = '33333333-3333-4333-8333-333333333333'
const versionId = '44444444-4444-4444-8444-444444444444'

function query(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  for (const fn of ['select', 'eq', 'in']) {
    builder[fn] = vi.fn(() => builder)
  }
  builder.single = vi.fn(async () => result)
  return builder
}

function makeClient() {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: studentId } } })),
    },
    from: vi.fn((table: string) => {
      if (table !== 'assignments') throw new Error(`unexpected table ${table}`)
      return query({
        data: { id: assignmentId, activity_id: activityId, version_id: versionId },
        error: null,
      })
    }),
  }
}

function makeAdminVersion(configData: unknown, activityTypeId = 'free-response') {
  return {
    from: vi.fn((table: string) => {
      if (table !== 'activity_versions') throw new Error(`unexpected table ${table}`)
      return query({
        data: { activity_type_id: activityTypeId, config_data: configData },
        error: null,
      })
    }),
  }
}

beforeEach(() => {
  createClientMock.mockReset()
  createAdminClientMock.mockReset()
  recordChildArtifactMock.mockReset()
  createClientMock.mockResolvedValue(makeClient())
})

describe('recordFreeResponseArtifact', () => {
  it('rejects drawing uploads when the pinned free-response version disables drawing', async () => {
    createAdminClientMock.mockReturnValue(makeAdminVersion({ allowedTools: { drawing: false, voice: true } }))

    const result = await recordFreeResponseArtifact({
      kind: 'drawing',
      assignmentId,
      activityId,
      versionId,
      dataUrl: 'data:image/png;base64,abc',
      drawingState: { strokes: [] },
    })

    expect(result.success).toBe(false)
    expect(recordChildArtifactMock).not.toHaveBeenCalled()
  })

  it('rejects artifacts for non-free-response pinned versions', async () => {
    createAdminClientMock.mockReturnValue(makeAdminVersion({ allowedTools: { voice: true } }, 'multiple-choice'))

    const result = await recordFreeResponseArtifact({
      kind: 'audio',
      assignmentId,
      activityId,
      versionId,
      blob: new Uint8Array([1]),
      mime: 'audio/webm',
    })

    expect(result.success).toBe(false)
    expect(recordChildArtifactMock).not.toHaveBeenCalled()
  })

  it('records enabled voice artifacts with free-response assignment metadata', async () => {
    createAdminClientMock.mockReturnValue(makeAdminVersion({ allowedTools: { voice: true } }))
    recordChildArtifactMock.mockResolvedValue({ success: true, data: { artifactId: '77777777-7777-4777-8777-777777777777' } })

    const result = await recordFreeResponseArtifact({
      kind: 'audio',
      assignmentId,
      activityId,
      versionId,
      blob: new Uint8Array([1]),
      mime: 'audio/webm',
      durationMs: 1200,
    })

    expect(result).toEqual({ success: true, data: { artifactId: '77777777-7777-4777-8777-777777777777' } })
    expect(recordChildArtifactMock).toHaveBeenCalledWith({
      kind: 'audio',
      studentId,
      payload: { blob: new Uint8Array([1]), mime: 'audio/webm' },
      sourceRef: assignmentId,
      metadata: {
        activityTypeId: 'free-response',
        responseTool: 'voice',
        activityId,
        versionId,
        assignmentId,
        durationMs: 1200,
      },
    })
  })
})
