import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import { getTeacherReviewQueue } from '../server'

interface Result {
  data?: unknown
  error?: { message: string } | null
}

function builder(result: Result, trace: Array<{ fn: string; args: unknown[] }>) {
  const query: Record<string, unknown> = {}
  for (const fn of ['select', 'eq', 'in', 'order']) {
    query[fn] = vi.fn((...args: unknown[]) => {
      trace.push({ fn, args })
      return query
    })
  }
  query.then = (onFulfilled: (value: Result) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  return query
}

function makeClient(perTable: Record<string, Result[]>) {
  const seen: Record<string, number> = {}
  const trace: Array<{ table?: string; fn: string; args: unknown[] }> = []
  const createSignedUrl = vi.fn(async (path: string) => ({ data: { signedUrl: `https://signed.test/${path}` }, error: null }))
  const from = vi.fn((table: string) => {
    const index = seen[table] ?? 0
    const result = perTable[table]?.[index]
    if (!result) throw new Error(`No fake result for ${table}`)
    seen[table] = index + 1
    const tableTrace: Array<{ fn: string; args: unknown[] }> = []
    const query = builder(result, tableTrace)
    for (const item of tableTrace) trace.push({ table, ...item })
    return query
  })

  return {
    client: {
      from,
      storage: { from: vi.fn(() => ({ createSignedUrl })) },
    } as unknown as SupabaseClient,
    from,
    createSignedUrl,
  }
}

describe('getTeacherReviewQueue', () => {
  it('returns submitted work with text and signed media URLs for teacher review', async () => {
    const { client, createSignedUrl } = makeClient({
      activity_submissions: [
        {
          data: [
            {
              id: 'submission-1',
              assignment_id: 'assignment-1',
              student_id: 'student-1',
              activity_id: 'activity-1',
              latest_attempt_id: 'attempt-1',
              latest_attempt_number: 2,
              latest_response: {
                text: 'Am desenat o casă',
                drawing: { artifactId: 'artifact-drawing' },
                voice: { artifactId: 'artifact-voice', durationMs: 900 },
              },
              submitted_at: '2026-05-20T10:00:00.000Z',
              updated_at: '2026-05-20T10:01:00.000Z',
            },
          ],
          error: null,
        },
      ],
      activities: [
        {
          data: [
            {
              id: 'activity-1',
              title: 'Povestea mea',
              config_data: { shareWithFamilyOnApproval: true },
            },
          ],
          error: null,
        },
      ],
      students: [{ data: [{ id: 'student-1', username: 'ana', class_id: 'class-1' }], error: null }],
      profiles: [{ data: [{ id: 'student-1', full_name: 'Ana Ionescu' }], error: null }],
      assignments: [{ data: [{ id: 'assignment-1', class_id: 'class-1' }], error: null }],
      classes: [{ data: [{ id: 'class-1', name: 'Clasa Fluturilor' }], error: null }],
      child_artifacts: [
        {
          data: [
            { id: 'artifact-drawing', storage_path: 'student-1/drawing.png', artifact_type: 'drawing' },
            { id: 'artifact-voice', storage_path: 'student-1/voice.webm', artifact_type: 'audio' },
          ],
          error: null,
        },
      ],
    })

    const queue = await getTeacherReviewQueue(client, 'teacher-1')

    expect(queue).toEqual([
      expect.objectContaining({
        submissionId: 'submission-1',
        activityTitle: 'Povestea mea',
        studentName: 'Ana Ionescu',
        studentUsername: 'ana',
        className: 'Clasa Fluturilor',
        attemptNumber: 2,
        text: 'Am desenat o casă',
        drawingUrl: 'https://signed.test/student-1/drawing.png',
        voiceUrl: 'https://signed.test/student-1/voice.webm',
        shareWithFamilyOnApproval: true,
      }),
    ])
    expect(createSignedUrl).toHaveBeenCalledTimes(2)
  })

  it('returns an empty queue when the submitted-work query fails', async () => {
    const { client } = makeClient({
      activity_submissions: [{ data: null, error: { message: 'rls denied' } }],
    })

    await expect(getTeacherReviewQueue(client, 'teacher-1')).resolves.toEqual([])
  })
})
