import { describe, expect, it } from 'vitest'

import {
  activitySubmissionIntentSchema,
  activitySubmissionRowSchema,
  recordActivitySubmissionSchema,
} from '../activity-submission.schema'

const assignmentId = '11111111-1111-4111-8111-111111111111'
const studentId = '22222222-2222-4222-8222-222222222222'
const activityId = '33333333-3333-4333-8333-333333333333'
const versionId = '44444444-4444-4444-8444-444444444444'
const attemptId = '55555555-5555-4555-8555-555555555555'
const submissionId = '66666666-6666-4666-8666-666666666666'

describe('recordActivitySubmissionSchema', () => {
  it('accepts lazy draft creation for an assigned activity version', () => {
    const result = recordActivitySubmissionSchema.safeParse({
      intent: 'start',
      assignmentId,
      activityId,
      versionId,
      response: { text: '' },
    })

    expect(result.success).toBe(true)
  })

  it('accepts final submission with response payload', () => {
    const result = recordActivitySubmissionSchema.safeParse({
      intent: 'submit',
      assignmentId,
      activityId,
      versionId,
      response: {
        text: 'Răspunsul meu',
        drawing: {
          artifactId: '77777777-7777-4777-8777-777777777777',
          state: { strokes: [] },
        },
        voice: {
          artifactId: '88888888-8888-4888-8888-888888888888',
          mime: 'audio/webm',
          durationMs: 1200,
        },
        artifacts: [
          '77777777-7777-4777-8777-777777777777',
          '88888888-8888-4888-8888-888888888888',
        ],
      },
    })

    expect(result.success).toBe(true)
  })

  it('requires at least one response part for final submit', () => {
    const result = recordActivitySubmissionSchema.safeParse({
      intent: 'submit',
      assignmentId,
      activityId,
      versionId,
      response: { text: '   ' },
    })

    expect(result.success).toBe(false)
  })

  it('rejects empty drawing and voice placeholders for final submit', () => {
    const result = recordActivitySubmissionSchema.safeParse({
      intent: 'submit',
      assignmentId,
      activityId,
      versionId,
      response: { drawing: {}, voice: null },
    })

    expect(result.success).toBe(false)
  })

  it('rejects unassigned submissions', () => {
    const result = recordActivitySubmissionSchema.safeParse({
      intent: 'submit',
      activityId,
      versionId,
      response: { text: 'Nu am temă' },
    })

    expect(result.success).toBe(false)
  })

  it('rejects unknown intents', () => {
    expect(activitySubmissionIntentSchema.safeParse('approve').success).toBe(false)
  })
})

describe('activitySubmissionRowSchema', () => {
  it('accepts the public current submission aggregate shape', () => {
    const result = activitySubmissionRowSchema.safeParse({
      id: submissionId,
      assignmentId,
      studentId,
      activityId,
      versionId,
      status: 'submitted',
      latestAttemptId: attemptId,
      latestAttemptNumber: 1,
      latestResponse: { text: 'Răspunsul meu' },
      submittedAt: '2026-05-19T20:00:00.000Z',
      reviewedBy: null,
      reviewedAt: null,
      teacherFeedback: null,
      createdAt: '2026-05-19T19:00:00.000Z',
      updatedAt: '2026-05-19T20:00:00.000Z',
    })

    expect(result.success).toBe(true)
  })

  it('rejects statuses outside the submission lifecycle', () => {
    const result = activitySubmissionRowSchema.safeParse({
      id: submissionId,
      assignmentId,
      studentId,
      activityId,
      versionId,
      status: 'completed',
      latestAttemptId: null,
      latestAttemptNumber: 0,
      latestResponse: {},
      submittedAt: null,
      reviewedBy: null,
      reviewedAt: null,
      teacherFeedback: null,
      createdAt: null,
      updatedAt: null,
    })

    expect(result.success).toBe(false)
  })
})
