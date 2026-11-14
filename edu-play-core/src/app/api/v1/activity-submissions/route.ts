import {
  ApiError,
  camelCaseKeys,
  handleRoute,
  parseBody,
  parseRow,
  requireAuth,
  success,
} from '@/lib/api'
import {
  activitySubmissionRowSchema,
  recordActivitySubmissionSchema,
  type ActivitySubmissionRow,
} from '@/features/api'

type SubmissionRow = {
  id: string
  assignment_id: string
  student_id: string
  activity_id: string
  version_id: string
  status: 'draft' | 'submitted' | 'needs_revision' | 'approved'
  latest_attempt_id: string | null
  latest_attempt_number: number
  latest_response: unknown
  submitted_at: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  teacher_feedback: string | null
  created_at: string | null
  updated_at: string | null
}

function parseSubmission(row: SubmissionRow): ActivitySubmissionRow {
  return parseRow(
    camelCaseKeys(row),
    activitySubmissionRowSchema,
    'POST /api/v1/activity-submissions',
  )
}

function mapSubmissionError(error: { code?: string; message?: string }) {
  const message = error.message ?? ''

  if (error.code === '42501') {
    return ApiError.forbidden('You cannot submit this assignment')
  }

  if (message.includes('already awaiting review')) {
    return new ApiError('CONFLICT', 'This submission is already awaiting review')
  }

  if (message.includes('already approved')) {
    return ApiError.gone('This submission has already been approved')
  }

  if (error.code === '23503') {
    return ApiError.notFound('Assignment')
  }

  if (error.code === '23514' || error.code === '22P02') {
    return ApiError.validation('Submission does not match this assignment')
  }

  console.error('[activity-submissions] Failed to record submission', error)
  return new ApiError('INTERNAL_ERROR', 'Could not save submission')
}

export const POST = handleRoute(async (req) => {
  const ctx = await requireAuth()
  const body = await parseBody(req, recordActivitySubmissionSchema)

  if (ctx.profile.role !== 'student') {
    throw ApiError.forbidden('Only students can create activity submissions')
  }

  const { data, error } = await ctx.supabase.rpc('record_activity_submission', {
    p_assignment_id: body.assignmentId,
    p_activity_id: body.activityId,
    p_version_id: body.versionId,
    p_intent: body.intent,
    p_response: body.response,
  })

  if (error || !data) {
    throw mapSubmissionError(error ?? { code: 'PGRST116' })
  }

  return success(parseSubmission(data as SubmissionRow))
})
