import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { CHILD_ARTIFACTS_BUCKET, DEFAULT_ARTIFACT_SIGNED_URL_TTL_SECONDS } from '@/shared/lib/storage/artifact-signed-url'
import type {
  CreateActivityWizardData,
  EditableFreeResponseDraft,
  TeacherAuthorableActivityType,
  TeacherOwnedActivity,
  TeacherOwnedActivityStatus,
  TeacherReviewQueueItem,
} from './types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

interface SubmissionQueueRow {
  id: string
  assignment_id: string
  student_id: string
  activity_id: string
  latest_attempt_id: string | null
  latest_attempt_number: number | null
  latest_response: unknown
  submitted_at: string | null
  updated_at: string | null
}

interface NamedRow {
  id: string
  title?: string | null
  username?: string | null
  full_name?: string | null
  class_id?: string | null
  name?: string | null
}

interface ActivitySummaryRow extends NamedRow {
  config_data?: unknown
}

interface ArtifactRow {
  id: string
  storage_path: string | null
}

interface ActivityResourceRow {
  title: string | null
  url: string | null
}

function toAuthorableType(row: Record<string, unknown>): TeacherAuthorableActivityType {
  return {
    typeId: String(row.type_id),
    displayName: String(row.display_name ?? row.type_id),
    category: typeof row.category === 'string' ? row.category : null,
    rendererKey: String(row.renderer_key ?? row.type_id),
    rendererKind: row.renderer_kind === 'react' ? 'react' : 'iframe',
    authoringMode:
      row.authoring_mode === 'teacher-simple' || row.authoring_mode === 'hidden'
        ? row.authoring_mode
        : 'admin-only',
  }
}

function toOwnedActivity(row: Record<string, unknown>): TeacherOwnedActivity {
  const status = typeof row.status === 'string' ? row.status : 'draft'
  const visibilityScope = typeof row.visibility_scope === 'string' ? row.visibility_scope : 'private'

  return {
    id: String(row.id),
    title: String(row.title ?? 'Activitate fără titlu'),
    template: String(row.template ?? 'free-response'),
    status: ['draft', 'published', 'archived', 'in_review'].includes(status)
      ? (status as TeacherOwnedActivityStatus)
      : 'draft',
    visibilityScope: ['private', 'school', 'public'].includes(visibilityScope)
      ? (visibilityScope as TeacherOwnedActivity['visibilityScope'])
      : 'private',
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
    createdAt: typeof row.created_at === 'string' ? row.created_at : null,
    configData: row.config_data,
  }
}

export async function getCreateActivityWizardData(): Promise<CreateActivityWizardData | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'teacher') return null

  const { data: activityTypes, error } = await supabase
    .from('activity_types')
    .select('type_id, display_name, category, renderer_key, renderer_kind, authoring_mode')
    .order('display_name', { ascending: true })

  if (error) {
    console.error('getCreateActivityWizardData activity_types error:', error)
  }

  const interactiveTypes = (activityTypes ?? [])
    .map((row) => toAuthorableType(row as Record<string, unknown>))
    .filter(
      (activityType) =>
        activityType.typeId !== 'free-response' &&
        activityType.authoringMode === 'teacher-simple' &&
        activityType.rendererKind === 'iframe',
    )

  return { interactiveTypes }
}

export async function getTeacherOwnedActivities(
  supabase: SupabaseClient,
  teacherId: string,
): Promise<TeacherOwnedActivity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('id, title, template, status, visibility_scope, updated_at, created_at, config_data')
    .eq('created_by', teacherId)
    .eq('visibility_scope', 'private')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('getTeacherOwnedActivities error:', error)
    return []
  }

  return (data ?? []).map((row) => toOwnedActivity(row as Record<string, unknown>))
}

function asRows<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : []
}

function byId<T extends { id: string }>(rows: T[]) {
  return new Map(rows.map((row) => [row.id, row]))
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function responseObject(response: unknown): Record<string, unknown> {
  return response && typeof response === 'object' && !Array.isArray(response) ? (response as Record<string, unknown>) : {}
}

function nestedObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function artifactIdFrom(value: unknown) {
  const artifactId = nestedObject(value).artifactId
  return typeof artifactId === 'string' && artifactId.length > 0 ? artifactId : null
}

function durationFrom(value: unknown) {
  const durationMs = nestedObject(value).durationMs
  return typeof durationMs === 'number' ? durationMs : null
}

function shareWithFamilyOnApprovalFrom(config: unknown) {
  return nestedObject(config).shareWithFamilyOnApproval === true
}

function editableDraftFromRow(
  row: Record<string, unknown>,
  resources: ActivityResourceRow[],
): EditableFreeResponseDraft | null {
  const status = row.status === 'draft' ? row.status : null
  if (!status || row.template !== 'free-response') return null

  const config = nestedObject(row.config_data)
  const allowedTools = nestedObject(config.allowedTools)

  return {
    activityId: String(row.id),
    status,
    title: String(row.title ?? ''),
    prompt: typeof config.prompt === 'string' ? config.prompt : '',
    allowedTools: {
      text: allowedTools.text === true,
      drawing: allowedTools.drawing === true,
      voice: allowedTools.voice === true,
    },
    shareWithFamilyOnApproval: config.shareWithFamilyOnApproval === true,
    resources: resources.map((resource) => ({
      title: resource.title ?? '',
      url: resource.url ?? '',
    })),
  }
}

export async function getEditableFreeResponseDraft(activityId: string): Promise<EditableFreeResponseDraft | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'teacher') return null

  const { data: activity, error: activityError } = await supabase
    .from('activities')
    .select('id, title, template, status, visibility_scope, created_by, config_data')
    .eq('id', activityId)
    .eq('created_by', user.id)
    .eq('visibility_scope', 'private')
    .single()

  if (activityError || !activity) return null

  const { data: resources, error: resourcesError } = await supabase
    .from('activity_resources')
    .select('title, url')
    .eq('activity_id', activityId)
    .is('version_id', null)
    .order('sort_order', { ascending: true })

  if (resourcesError) {
    console.error('getEditableFreeResponseDraft resources error:', resourcesError)
    return null
  }

  return editableDraftFromRow(activity as Record<string, unknown>, asRows<ActivityResourceRow>(resources))
}

async function fetchRows<T>(
  supabase: SupabaseClient,
  table: string,
  ids: string[],
  columns: string,
): Promise<T[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase.from(table).select(columns).in('id', ids)
  if (error) {
    console.error(`getTeacherReviewQueue ${table} error:`, error)
    return []
  }
  return asRows<T>(data)
}

async function signedUrlsForArtifacts(supabase: SupabaseClient, artifacts: ArtifactRow[]) {
  const entries = await Promise.all(
    artifacts.map(async (artifact) => {
      if (!artifact.storage_path) return [artifact.id, null] as const
      const { data, error } = await supabase.storage
        .from(CHILD_ARTIFACTS_BUCKET)
        .createSignedUrl(artifact.storage_path, DEFAULT_ARTIFACT_SIGNED_URL_TTL_SECONDS)
      return [artifact.id, error || !data?.signedUrl ? null : data.signedUrl] as const
    }),
  )
  return new Map(entries)
}

export async function getTeacherReviewQueue(
  supabase: SupabaseClient,
  _teacherId: string,
): Promise<TeacherReviewQueueItem[]> {
  const { data, error } = await supabase
    .from('activity_submissions')
    .select('id, assignment_id, student_id, activity_id, latest_attempt_id, latest_attempt_number, latest_response, submitted_at, updated_at')
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('getTeacherReviewQueue submissions error:', error)
    return []
  }

  const submissions = asRows<SubmissionQueueRow>(data)
  if (submissions.length === 0) return []

  const responses = submissions.map((submission) => responseObject(submission.latest_response))
  const drawingArtifactIds = responses.map((response) => artifactIdFrom(response.drawing))
  const voiceArtifactIds = responses.map((response) => artifactIdFrom(response.voice))
  const artifactIds = unique([...drawingArtifactIds, ...voiceArtifactIds])

  const [activities, students, profiles, assignments, artifacts] = await Promise.all([
    fetchRows<ActivitySummaryRow>(supabase, 'activities', unique(submissions.map((submission) => submission.activity_id)), 'id, title, config_data'),
    fetchRows<NamedRow>(supabase, 'students', unique(submissions.map((submission) => submission.student_id)), 'id, username, class_id'),
    fetchRows<NamedRow>(supabase, 'profiles', unique(submissions.map((submission) => submission.student_id)), 'id, full_name'),
    fetchRows<NamedRow>(supabase, 'assignments', unique(submissions.map((submission) => submission.assignment_id)), 'id, class_id'),
    fetchRows<ArtifactRow>(supabase, 'child_artifacts', artifactIds, 'id, storage_path, artifact_type'),
  ])

  const activityById = byId(activities)
  const studentById = byId(students)
  const profileById = byId(profiles)
  const assignmentById = byId(assignments)
  const classes = await fetchRows<NamedRow>(supabase, 'classes', unique(assignments.map((assignment) => assignment.class_id)), 'id, name')
  const classById = byId(classes)
  const artifactUrls = await signedUrlsForArtifacts(supabase, artifacts)

  return submissions.map((submission, index) => {
    const response = responses[index] ?? {}
    const student = studentById.get(submission.student_id)
    const profile = profileById.get(submission.student_id)
    const assignment = assignmentById.get(submission.assignment_id)
    const drawingArtifactId = drawingArtifactIds[index] ?? null
    const voiceArtifactId = voiceArtifactIds[index] ?? null

    return {
      submissionId: submission.id,
      assignmentId: submission.assignment_id,
      activityId: submission.activity_id,
      activityTitle: activityById.get(submission.activity_id)?.title ?? 'Activitate fără titlu',
      studentId: submission.student_id,
      studentName: profile?.full_name ?? student?.username ?? 'Elev',
      studentUsername: student?.username ?? 'elev',
      className: assignment?.class_id ? (classById.get(assignment.class_id)?.name ?? null) : null,
      attemptNumber: submission.latest_attempt_number ?? 0,
      submittedAt: submission.submitted_at ?? submission.updated_at,
      text: typeof response.text === 'string' ? response.text : '',
      drawingArtifactId,
      drawingUrl: drawingArtifactId ? (artifactUrls.get(drawingArtifactId) ?? null) : null,
      voiceArtifactId,
      voiceUrl: voiceArtifactId ? (artifactUrls.get(voiceArtifactId) ?? null) : null,
      voiceDurationMs: durationFrom(response.voice),
      shareWithFamilyOnApproval: shareWithFamilyOnApprovalFrom(activityById.get(submission.activity_id)?.config_data),
    }
  })
}
