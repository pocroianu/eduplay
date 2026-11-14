'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/shared/lib/constants'
import type { ReviewActivitySubmissionResult } from '../types'

const reviewSchema = z.object({
  submissionId: z.string().uuid(),
  decision: z.enum(['approved', 'needs_revision']),
  feedback: z.string().optional(),
  familyComment: z.string().optional(),
})

export async function reviewActivitySubmission(input: unknown): Promise<ReviewActivitySubmissionResult> {
  const parsed = reviewSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Date invalide.' }
  }

  const feedback = parsed.data.feedback?.trim() || null
  const familyComment = parsed.data.familyComment?.trim() || null
  if (parsed.data.decision === 'needs_revision' && !feedback) {
    return { success: false, error: 'Revision feedback is required.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Nu ești autentificat.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'teacher') {
    return { success: false, error: 'Doar profesorii pot verifica răspunsuri.' }
  }

  const { error } = await supabase.rpc('review_activity_submission', {
    p_submission_id: parsed.data.submissionId,
    p_decision: parsed.data.decision,
    p_teacher_feedback: feedback,
    p_family_comment: parsed.data.decision === 'approved' ? familyComment : null,
  })

  if (error) {
    console.error('reviewActivitySubmission RPC error:', error)
    return { success: false, error: 'Nu am putut salva decizia. Încearcă din nou.' }
  }

  revalidatePath(ROUTES.TEACHER.ACTIVITY_REVIEW)
  revalidatePath(ROUTES.TEACHER.ACTIVITIES)
  return { success: true }
}

async function reviewActivitySubmissionFromForm(formData: FormData): Promise<void> {
  await reviewActivitySubmission({
    submissionId: String(formData.get('submissionId') ?? ''),
    decision: String(formData.get('decision') ?? ''),
    feedback: String(formData.get('feedback') ?? ''),
    familyComment: String(formData.get('familyComment') ?? ''),
  })
}
