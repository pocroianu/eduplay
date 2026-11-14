import { beforeEach, describe, expect, it, vi } from 'vitest'

const revalidatePathMock = vi.fn()
const createClientMock = vi.fn()

vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => createClientMock(),
}))

import { reviewActivitySubmission } from '../review-activity-submission'

const submissionId = '11111111-1111-4111-8111-111111111111'

function makeSupabase({ role = 'teacher', rpcError = null }: { role?: string; rpcError?: { message: string } | null } = {}) {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'teacher-1' } } })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({ data: { role }, error: null })),
    })),
    rpc: vi.fn(async () => ({ data: rpcError ? null : { id: submissionId }, error: rpcError })),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  createClientMock.mockResolvedValue(makeSupabase())
})

describe('reviewActivitySubmission', () => {
  it('approves a submitted free-response submission through the review RPC', async () => {
    const supabase = makeSupabase()
    createClientMock.mockResolvedValue(supabase)

    const result = await reviewActivitySubmission({ submissionId, decision: 'approved' })

    expect(result).toEqual({ success: true })
    expect(supabase.rpc).toHaveBeenCalledWith('review_activity_submission', {
      p_submission_id: submissionId,
      p_decision: 'approved',
      p_teacher_feedback: null,
      p_family_comment: null,
    })
    expect(revalidatePathMock).toHaveBeenCalledWith('/teacher/activities/review')
  })

  it('passes an optional family-facing comment separately from revision feedback', async () => {
    const supabase = makeSupabase()
    createClientMock.mockResolvedValue(supabase)

    const result = await reviewActivitySubmission({
      submissionId,
      decision: 'approved',
      familyComment: '  Minunat pentru familie.  ',
    })

    expect(result).toEqual({ success: true })
    expect(supabase.rpc).toHaveBeenCalledWith('review_activity_submission', {
      p_submission_id: submissionId,
      p_decision: 'approved',
      p_teacher_feedback: null,
      p_family_comment: 'Minunat pentru familie.',
    })
  })

  it('requires feedback when requesting a revision', async () => {
    const result = await reviewActivitySubmission({ submissionId, decision: 'needs_revision', feedback: '   ' })

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/feedback/i)
  })

  it('rejects non-teacher callers before reviewing', async () => {
    const supabase = makeSupabase({ role: 'student' })
    createClientMock.mockResolvedValue(supabase)

    const result = await reviewActivitySubmission({ submissionId, decision: 'approved' })

    expect(result.success).toBe(false)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})
