import { z } from 'zod'

const activitySubmissionStatuses = [
  'draft',
  'submitted',
  'needs_revision',
  'approved',
] as const

export const activitySubmissionIntentSchema = z.enum(['start', 'submit'])

const activitySubmissionResponseSchema = z
  .object({
    text: z.string().optional(),
    drawing: z.unknown().optional(),
    voice: z.unknown().optional(),
    artifacts: z.array(z.string().uuid()).optional(),
  })
  .passthrough()

function hasMeaningfulPayload(value: unknown) {
  if (value == null) return false
  if (typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value).length > 0
  }
  return true
}

function hasSubmittedResponse(response: z.infer<typeof activitySubmissionResponseSchema>) {
  return (
    (typeof response.text === 'string' && response.text.trim().length > 0) ||
    hasMeaningfulPayload(response.drawing) ||
    hasMeaningfulPayload(response.voice) ||
    (Array.isArray(response.artifacts) && response.artifacts.length > 0)
  )
}

export const recordActivitySubmissionSchema = z
  .object({
    intent: activitySubmissionIntentSchema.default('start'),
    assignmentId: z.string().uuid(),
    activityId: z.string().uuid(),
    versionId: z.string().uuid(),
    response: activitySubmissionResponseSchema.default({}),
  })
  .superRefine((value, ctx) => {
    if (value.intent === 'submit' && !hasSubmittedResponse(value.response)) {
      ctx.addIssue({
        code: 'custom',
        path: ['response'],
        message: 'At least one response part is required to submit',
      })
    }
  })

export type RecordActivitySubmissionInput = z.infer<typeof recordActivitySubmissionSchema>

export const activitySubmissionRowSchema = z.object({
  id: z.string().uuid(),
  assignmentId: z.string().uuid(),
  studentId: z.string().uuid(),
  activityId: z.string().uuid(),
  versionId: z.string().uuid(),
  status: z.enum(activitySubmissionStatuses),
  latestAttemptId: z.string().uuid().nullable(),
  latestAttemptNumber: z.number().int().min(0),
  latestResponse: z.unknown(),
  submittedAt: z.string().nullable(),
  reviewedBy: z.string().uuid().nullable(),
  reviewedAt: z.string().nullable(),
  teacherFeedback: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
})

export type ActivitySubmissionRow = z.infer<typeof activitySubmissionRowSchema>
