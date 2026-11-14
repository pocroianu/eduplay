'use server'

import { z } from 'zod'

import { recordChildArtifact } from '@/features/portfolio'
import { createAdminClient, createClient } from '@/lib/supabase/server'

const uuid = z.string().uuid()
const drawingStateSchema = z.record(z.string(), z.unknown())

const recordFreeResponseArtifactSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('drawing'),
    assignmentId: uuid,
    activityId: uuid,
    versionId: uuid,
    dataUrl: z.string().min(1),
    drawingState: drawingStateSchema.optional(),
  }),
  z.object({
    kind: z.literal('audio'),
    assignmentId: uuid,
    activityId: uuid,
    versionId: uuid,
    blob: z.custom<Uint8Array>((value) => value instanceof Uint8Array),
    mime: z.enum(['audio/webm', 'audio/ogg']),
    durationMs: z.number().int().min(0).optional(),
  }),
])

const cleanupFreeResponseArtifactsSchema = z.object({
  assignmentId: uuid,
  artifactIds: z.array(uuid).min(1).max(10),
})

type RecordFreeResponseArtifactInput = z.infer<typeof recordFreeResponseArtifactSchema>
type ToolName = 'drawing' | 'voice'

interface FreeResponseVersionConfig {
  allowedTools?: {
    drawing?: unknown
    voice?: unknown
  }
}

export type RecordFreeResponseArtifactResult =
  | { success: true; data: { artifactId: string } }
  | { success: false; error: string }

export async function recordFreeResponseArtifact(input: unknown): Promise<RecordFreeResponseArtifactResult> {
  const parsed = recordFreeResponseArtifactSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Date invalide' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Nu ești autentificat' }
  }

  const assignment = await supabase
    .from('assignments')
    .select('id, activity_id, version_id')
    .eq('id', parsed.data.assignmentId)
    .single()

  if (
    assignment.error ||
    !assignment.data ||
    assignment.data.activity_id !== parsed.data.activityId ||
    assignment.data.version_id !== parsed.data.versionId
  ) {
    return { success: false, error: 'Tema nu este disponibilă pentru acest răspuns' }
  }

  const toolName = parsed.data.kind === 'drawing' ? 'drawing' : 'voice'
  const toolValidation = await validateFreeResponseTool(parsed.data.versionId, toolName)
  if (!toolValidation.success) {
    return toolValidation
  }

  return parsed.data.kind === 'drawing'
    ? recordDrawingArtifact(parsed.data, user.id)
    : recordAudioArtifact(parsed.data, user.id)
}

export async function cleanupFreeResponseArtifacts(input: unknown): Promise<{ success: boolean }> {
  const parsed = cleanupFreeResponseArtifactsSchema.safeParse(input)
  if (!parsed.success) return { success: false }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false }

  const admin = createAdminClient()
  const { data: artifacts } = await admin
    .from('child_artifacts')
    .select('id, storage_path, metadata')
    .eq('student_id', user.id)
    .eq('visibility', 'draft')
    .in('id', parsed.data.artifactIds)

  const ownedArtifacts = (artifacts ?? []).filter((artifact) => {
    const metadata = (artifact.metadata ?? {}) as Record<string, unknown>
    return metadata.activityTypeId === 'free-response' && metadata.assignmentId === parsed.data.assignmentId
  })

  if (ownedArtifacts.length === 0) return { success: true }

  const storagePaths = ownedArtifacts
    .map((artifact) => artifact.storage_path)
    .filter((path): path is string => typeof path === 'string' && path.length > 0)

  if (storagePaths.length > 0) {
    await admin.storage.from('child-artifacts').remove(storagePaths)
  }

  await admin
    .from('child_artifacts')
    .delete()
    .in('id', ownedArtifacts.map((artifact) => artifact.id))

  return { success: true }
}

async function validateFreeResponseTool(versionId: string, tool: ToolName): Promise<RecordFreeResponseArtifactResult | { success: true }> {
  const { data, error } = await createAdminClient()
    .from('activity_versions')
    .select('activity_type_id, config_data')
    .eq('id', versionId)
    .single()

  if (error || !data || data.activity_type_id !== 'free-response') {
    return { success: false, error: 'Tema nu acceptă acest tip de răspuns' }
  }

  const config = (data.config_data ?? {}) as FreeResponseVersionConfig
  if (config.allowedTools?.[tool] !== true) {
    return { success: false, error: 'Instrumentul nu este activ pentru această temă' }
  }

  return { success: true }
}

async function recordDrawingArtifact(input: Extract<RecordFreeResponseArtifactInput, { kind: 'drawing' }>, studentId: string) {
  const result = await recordChildArtifact({
    kind: 'drawing',
    studentId,
    payload: { dataUrl: input.dataUrl },
    sourceRef: input.assignmentId,
    metadata: {
      activityTypeId: 'free-response',
      responseTool: 'drawing',
      activityId: input.activityId,
      versionId: input.versionId,
      assignmentId: input.assignmentId,
      ...(input.drawingState ? { drawingState: input.drawingState } : {}),
    },
  })

  return result.success
    ? { success: true as const, data: { artifactId: result.data?.artifactId ?? '' } }
    : { success: false as const, error: result.error ?? 'Nu am putut salva artefactul' }
}

async function recordAudioArtifact(input: Extract<RecordFreeResponseArtifactInput, { kind: 'audio' }>, studentId: string) {
  const result = await recordChildArtifact({
    kind: 'audio',
    studentId,
    payload: { blob: input.blob, mime: input.mime },
    sourceRef: input.assignmentId,
    metadata: {
      activityTypeId: 'free-response',
      responseTool: 'voice',
      activityId: input.activityId,
      versionId: input.versionId,
      assignmentId: input.assignmentId,
      durationMs: input.durationMs ?? null,
    },
  })

  return result.success
    ? { success: true as const, data: { artifactId: result.data?.artifactId ?? '' } }
    : { success: false as const, error: result.error ?? 'Nu am putut salva artefactul' }
}
