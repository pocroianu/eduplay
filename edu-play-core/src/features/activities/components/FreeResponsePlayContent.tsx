'use client'

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'

import { Button, TextareaField } from '@/shared/components/ui/kit'
import { createBrowserFreeResponseSubmission, recordSubmission } from '../submission/submission-transport'
import type { SubmissionOutcome } from '../submission/free-response-submission'

interface FreeResponseConfig {
  prompt?: unknown
  allowedTools?: {
    text?: unknown
    drawing?: unknown
    voice?: unknown
  }
  shareWithFamilyOnApproval?: unknown
  resources?: unknown
}

interface FreeResponseResource {
  title: string
  url: string
}

type SubmissionStatus = 'draft' | 'submitted' | 'needs_revision' | 'approved'
type VoiceMime = 'audio/webm' | 'audio/ogg'
type ResponseTool = 'text' | 'drawing' | 'voice'
type VoiceState = 'idle' | 'recording' | 'ready' | 'unsupported'

interface FreeResponsePlayContentProps {
  title: string
  backUrl: string
  mode: 'preview' | 'play'
  config: unknown
  activityId?: string
  versionId?: string
  assignmentId?: string
  initialSubmission?: {
    status: SubmissionStatus
    latestResponse?: unknown
  } | null
}

interface DrawingPoint {
  x: number
  y: number
}

interface DrawingStroke {
  points: DrawingPoint[]
}

interface DraftBackup {
  version: 1
  text?: string
  textOpen?: boolean
  drawingOpen?: boolean
  voiceOpen?: boolean
  drawing?: { strokes?: DrawingStroke[] }
}

interface LatestResponse {
  text?: unknown
  drawing?: { state?: { strokes?: unknown } }
  voice?: unknown
}

const EMPTY_STROKES: DrawingStroke[] = []

function normalizeResources(value: unknown): FreeResponseResource[] {
  if (!Array.isArray(value)) return []
  return value
    .map((resource) => {
      if (!resource || typeof resource !== 'object') return null
      const { title, url } = resource as { title?: unknown; url?: unknown }
      return typeof title === 'string' && typeof url === 'string' && title.trim() && url.trim()
        ? { title: title.trim(), url: url.trim() }
        : null
    })
    .filter((resource): resource is FreeResponseResource => Boolean(resource))
}

function normalizeConfig(config: unknown) {
  const value = (config ?? {}) as FreeResponseConfig
  return {
    prompt: typeof value.prompt === 'string' ? value.prompt : '',
    allowedTools: {
      text: value.allowedTools?.text === true,
      drawing: value.allowedTools?.drawing === true,
      voice: value.allowedTools?.voice === true,
    },
    shareWithFamilyOnApproval: value.shareWithFamilyOnApproval === true,
    resources: normalizeResources(value.resources),
  }
}

function normalizeStrokes(value: unknown): DrawingStroke[] {
  if (!Array.isArray(value)) return EMPTY_STROKES
  return value
    .map((stroke) => {
      const points =
        stroke && typeof stroke === 'object' && Array.isArray((stroke as { points?: unknown }).points)
          ? (stroke as { points: unknown[] }).points
          : []
      return {
        points: points
          .map((point) => {
            if (!point || typeof point !== 'object') return null
            const { x, y } = point as { x?: unknown; y?: unknown }
            return typeof x === 'number' && typeof y === 'number' ? { x, y } : null
          })
          .filter((point): point is DrawingPoint => Boolean(point)),
      }
    })
    .filter((stroke) => stroke.points.length > 0)
}

function parseLatestResponse(response: unknown) {
  const value = (response ?? {}) as LatestResponse
  return {
    text: typeof value.text === 'string' ? value.text : '',
    strokes: normalizeStrokes(value.drawing?.state?.strokes),
    hasVoice: value.voice !== undefined,
  }
}

function isLockedSubmissionStatus(status?: SubmissionStatus | null) {
  return status === 'submitted' || status === 'approved'
}

function canPersistSubmission(
  isPreview: boolean,
  activityId?: string,
  versionId?: string,
  assignmentId?: string,
) {
  return !isPreview && Boolean(activityId && versionId && assignmentId)
}

function shouldOpenTextPanel(initialResponse: ReturnType<typeof parseLatestResponse>, backup: DraftBackup | null) {
  return Boolean(initialResponse.text || backup?.textOpen || backup?.text)
}

function shouldOpenDrawingPanel(initialResponse: ReturnType<typeof parseLatestResponse>, backup: DraftBackup | null) {
  return Boolean(initialResponse.strokes.length || backup?.drawingOpen || backup?.drawing?.strokes?.length)
}

function shouldOpenVoicePanel(initialResponse: ReturnType<typeof parseLatestResponse>, backup: DraftBackup | null) {
  return Boolean(initialResponse.hasVoice || backup?.voiceOpen)
}

function initialPanelState(initialResponse: ReturnType<typeof parseLatestResponse>, backup: DraftBackup | null) {
  return {
    textOpen: shouldOpenTextPanel(initialResponse, backup),
    drawingOpen: shouldOpenDrawingPanel(initialResponse, backup),
    voiceOpen: shouldOpenVoicePanel(initialResponse, backup),
  }
}

function isEditingLocked({
  canPersist,
  isPreview,
  locked,
  status,
}: {
  canPersist: boolean
  isPreview: boolean
  locked: boolean
  status: 'idle' | 'saving' | 'submitted' | 'error'
  problem?: SubmissionOutcome['kind'] | null
}) {
  return (!isPreview && !canPersist) || locked || status === 'saving'
}

function hasAnyFreeResponse({
  hasDrawingResponse,
  hasTextResponse,
  hasVoiceResponse,
}: {
  hasDrawingResponse: boolean
  hasTextResponse: boolean
  hasVoiceResponse: boolean
}) {
  return hasTextResponse || hasDrawingResponse || hasVoiceResponse
}

function canSubmitResponse({
  canPersist,
  hasAnyResponse,
  isPreview,
  locked,
  status,
}: {
  canPersist: boolean
  hasAnyResponse: boolean
  isPreview: boolean
  locked: boolean
  status: 'idle' | 'saving' | 'submitted' | 'error'
}) {
  return !isPreview && canPersist && status !== 'saving' && !locked && hasAnyResponse
}

function shouldSkipDraftStart({
  canPersist,
  draftStarted,
  locked,
}: {
  canPersist: boolean
  draftStarted: boolean
  locked: boolean
}) {
  return !canPersist || draftStarted || locked
}

function getDraftKey(activityId?: string, versionId?: string, assignmentId?: string) {
  if (!activityId || !versionId || !assignmentId) return null
  return `free-response-draft:v1:${assignmentId}:${activityId}:${versionId}`
}

function readBackup(key: string | null): DraftBackup | null {
  if (!key || typeof window === 'undefined') return null
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? 'null') as DraftBackup | null
    return parsed?.version === 1 ? parsed : null
  } catch {
    return null
  }
}

function pointFromEvent(canvas: HTMLCanvasElement, event: ReactPointerEvent<HTMLCanvasElement>): DrawingPoint {
  const rect = canvas.getBoundingClientRect()
  return {
    x: rect.width > 0 ? Math.max(0, Math.min(rect.width, event.clientX - rect.left)) : event.clientX,
    y: rect.height > 0 ? Math.max(0, Math.min(rect.height, event.clientY - rect.top)) : event.clientY,
  }
}

function prepareCanvasContext(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue('--color-blue').trim() || 'currentColor'
  return ctx
}

function drawStrokes(canvas: HTMLCanvasElement, strokes: DrawingStroke[]) {
  const ctx = prepareCanvasContext(canvas)
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue
    ctx.beginPath()
    ctx.moveTo(stroke.points[0]!.x, stroke.points[0]!.y)
    for (const point of stroke.points.slice(1)) {
      ctx.lineTo(point.x, point.y)
    }
    ctx.stroke()
  }
}

function createDrawingPreviewUrl(strokes: DrawingStroke[]) {
  if (strokes.length === 0 || typeof document === 'undefined') return null

  const canvas = document.createElement('canvas')
  canvas.width = 720
  canvas.height = 360
  drawStrokes(canvas, strokes)
  return canvas.toDataURL('image/png')
}

function drawStrokeSegment(canvas: HTMLCanvasElement, from: DrawingPoint, to: DrawingPoint) {
  const ctx = prepareCanvasContext(canvas)
  if (!ctx) return
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()
}

function resolveRecorderMime() {
  if (typeof MediaRecorder === 'undefined') return null
  const candidates = [
    { mime: 'audio/webm' as const, recorderType: 'audio/webm;codecs=opus' },
    { mime: 'audio/ogg' as const, recorderType: 'audio/ogg;codecs=opus' },
  ]
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate.recorderType)) ?? null
}

function FreeResponseHeader({ backUrl, isPreview }: { backUrl: string; isPreview: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Button href={backUrl} mode="kid" size="lg" variant="ghost" tone="cream">
        Înapoi
      </Button>
      <span className="rounded-full bg-primary-soft px-4 py-2 text-sm font-bold text-primary-deep">
        Mod elev{isPreview ? ' · previzualizare' : ''}
      </span>
    </div>
  )
}

function PromptCard({ title, prompt }: { title: string; prompt: string }) {
  return (
    <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-soft sm:p-8">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary-deep">Răspuns liber</p>
      <h1 className="mt-2 font-headline text-3xl font-bold tracking-tight text-on-surface sm:text-5xl">
        {title}
      </h1>
      <p className="mt-5 rounded-xl bg-primary-soft p-5 text-xl font-semibold leading-8 text-on-surface">
        {prompt || 'Instrucțiunile apar aici.'}
      </p>
    </section>
  )
}

function ResourcesSection({ resources }: { resources: FreeResponseResource[] }) {
  if (resources.length === 0) return null

  return (
    <section className="rounded-2xl bg-surface-container-lowest p-5 shadow-soft" aria-label="Resurse pentru activitate">
      <h2 className="text-xl font-bold text-on-surface">Resurse</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {resources.map((resource) => (
          <a
            key={`${resource.title}:${resource.url}`}
            href={resource.url}
            target="_blank"
            rel="noreferrer"
            className="min-h-16 rounded-xl border border-outline-variant bg-surface-container-lowest px-5 py-4 text-lg font-semibold text-primary-deep shadow-soft-sm underline-offset-4 transition-colors hover:bg-primary-soft hover:underline"
          >
            {resource.title}
          </a>
        ))}
      </div>
    </section>
  )
}

function ToolButtonGrid({
  allowedTools,
  disabled,
  openTools,
  onActivate,
}: {
  allowedTools: ReturnType<typeof normalizeConfig>['allowedTools']
  disabled: boolean
  openTools: Record<ResponseTool, boolean>
  onActivate: (tool: ResponseTool) => void
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {allowedTools.text ? (
        <Button
          type="button"
          mode="kid"
          size="lg"
          tone="lime"
          disabled={disabled || openTools.text}
          onClick={() => onActivate('text')}
        >
          Adaugă text
        </Button>
      ) : null}

      {allowedTools.drawing ? (
        <Button
          type="button"
          mode="kid"
          size="lg"
          tone="sky"
          disabled={disabled || openTools.drawing}
          onClick={() => onActivate('drawing')}
        >
          Desenează
        </Button>
      ) : null}

      {allowedTools.voice ? (
        <Button
          type="button"
          mode="kid"
          size="lg"
          tone="sun"
          disabled={disabled || openTools.voice}
          onClick={() => onActivate('voice')}
        >
          Înregistrează
        </Button>
      ) : null}
    </div>
  )
}

function TextResponsePanel({
  disabled,
  open,
  onFocus,
  onTextChange,
  text,
}: {
  disabled: boolean
  open: boolean
  onFocus: () => void
  onTextChange: (value: string) => void
  text: string
}) {
  if (!open) return null

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <TextareaField
        label="Răspuns text"
        disabled={disabled}
        value={text}
        onFocus={onFocus}
        onChange={(event) => onTextChange(event.target.value)}
        placeholder="Scrie răspunsul tău aici."
        rows={5}
        inputStyle={{
          borderRadius: 16,
          fontSize: 18,
          fontWeight: 600,
          minHeight: 144,
          padding: 16,
        }}
      />
    </div>
  )
}

function DrawingResponsePanel({
  canvasRef,
  disabled,
  drawingPreviewUrl,
  onClear,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  open,
  strokes,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>
  disabled: boolean
  drawingPreviewUrl: string | null
  onClear: () => void
  onPointerCancel: (event: ReactPointerEvent<HTMLCanvasElement>) => void
  onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void
  open: boolean
  strokes: DrawingStroke[]
}) {
  if (!open) return null

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-bold text-on-surface">Desen</p>
        <Button
          type="button"
          mode="kid"
          size="sm"
          variant="ghost"
          tone="cream"
          disabled={disabled || strokes.length === 0}
          onClick={onClear}
        >
          Șterge desenul
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        width={720}
        height={360}
        aria-label="Spațiu de desen"
        role="img"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        className="mt-3 h-72 w-full touch-none rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-soft-sm"
      />
      {drawingPreviewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={drawingPreviewUrl} alt="Previzualizare desen" className="mt-3 h-24 w-36 rounded-2xl border border-outline-variant bg-surface-container-lowest object-cover shadow-soft-sm" />
      ) : (
        <p className="mt-3 text-base font-bold text-on-surface-variant">Desenează cu degetul sau mouse-ul.</p>
      )}
    </div>
  )
}

function VoiceResponsePanel({
  disabled,
  onRetry,
  onStart,
  onStop,
  open,
  voiceState,
  voiceUrl,
}: {
  disabled: boolean
  onRetry: () => void
  onStart: () => void
  onStop: () => void
  open: boolean
  voiceState: VoiceState
  voiceUrl: string | null
}) {
  if (!open) return null

  return (
    <div className="rounded-xl border border-outline-variant bg-gold-soft p-4">
      <p className="text-lg font-bold text-gold-deep">Înregistrare vocală</p>
      <div className="mt-3 flex flex-wrap gap-3">
        {voiceState === 'recording' ? (
          <Button type="button" mode="kid" size="lg" variant="primary" tone="ink" onClick={onStop}>
            Oprește înregistrarea
          </Button>
        ) : (
          <Button type="button" mode="kid" size="lg" variant="primary" tone="lime" disabled={disabled} onClick={onStart}>
            Pornește înregistrarea
          </Button>
        )}
        {voiceState === 'ready' ? (
          <Button type="button" mode="kid" size="lg" variant="ghost" tone="cream" disabled={disabled} onClick={onRetry}>
            Reînregistrează
          </Button>
        ) : null}
      </div>
      {voiceState === 'recording' ? (
        <p className="mt-3 text-base font-semibold text-error">Înregistrăm acum…</p>
      ) : null}
      {voiceState === 'ready' ? (
        <div className="mt-3">
          <p className="text-base font-semibold text-gold-deep">Înregistrare pregătită.</p>
          {voiceUrl ? <audio controls src={voiceUrl} className="mt-2 w-full" /> : null}
        </div>
      ) : null}
      {voiceState === 'unsupported' ? (
        <p className="mt-3 text-base font-semibold text-error">Acest dispozitiv nu poate înregistra audio aici.</p>
      ) : null}
    </div>
  )
}

function ResponseToolsSection({
  allowedTools,
  disabled,
  drawingOpen,
  drawingPreviewUrl,
  canvasRef,
  onActivate,
  onClearDrawing,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onRetryRecording,
  onStartDraft,
  onStartRecording,
  onStopRecording,
  onTextChange,
  text,
  textOpen,
  strokes,
  voiceOpen,
  voiceState,
  voiceUrl,
}: {
  allowedTools: ReturnType<typeof normalizeConfig>['allowedTools']
  disabled: boolean
  drawingOpen: boolean
  drawingPreviewUrl: string | null
  canvasRef: RefObject<HTMLCanvasElement | null>
  onActivate: (tool: ResponseTool) => void
  onClearDrawing: () => void
  onPointerCancel: (event: ReactPointerEvent<HTMLCanvasElement>) => void
  onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void
  onRetryRecording: () => void
  onStartDraft: () => void
  onStartRecording: () => void
  onStopRecording: () => void
  onTextChange: (value: string) => void
  text: string
  textOpen: boolean
  strokes: DrawingStroke[]
  voiceOpen: boolean
  voiceState: VoiceState
  voiceUrl: string | null
}) {
  return (
    <section className="rounded-2xl bg-surface-container-lowest p-4 shadow-soft" aria-label="Instrumente de răspuns">
      <ToolButtonGrid
        allowedTools={allowedTools}
        disabled={disabled}
        openTools={{ text: textOpen, drawing: drawingOpen, voice: voiceOpen }}
        onActivate={onActivate}
      />

      <div className="mt-4 flex flex-col gap-4">
        <TextResponsePanel
          disabled={disabled}
          open={textOpen}
          onFocus={onStartDraft}
          onTextChange={onTextChange}
          text={text}
        />
        <DrawingResponsePanel
          canvasRef={canvasRef}
          disabled={disabled}
          drawingPreviewUrl={drawingPreviewUrl}
          onClear={onClearDrawing}
          onPointerCancel={onPointerCancel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          open={drawingOpen}
          strokes={strokes}
        />
        <VoiceResponsePanel
          disabled={disabled}
          onRetry={onRetryRecording}
          onStart={onStartRecording}
          onStop={onStopRecording}
          open={voiceOpen}
          voiceState={voiceState}
          voiceUrl={voiceUrl}
        />
      </div>
    </section>
  )
}

function StatusMessages({
  problem,
  canPersist,
  isPreview,
  status,
}: {
  canPersist: boolean
  isPreview: boolean
  status: 'idle' | 'saving' | 'submitted' | 'error'
  problem?: SubmissionOutcome['kind'] | null
}) {
  let errorMessage = 'Nu am putut salva răspunsul. Încearcă din nou.'
  if (problem === 'uncertain') errorMessage = 'Nu am putut confirma trimiterea. Încearcă din nou; păstrăm răspunsul.'
  if (problem === 'cleanup-failed') errorMessage = 'Pregătim răspunsul pentru o nouă încercare. Apasă din nou Trimite.'
  return (
    <>
      {isPreview ? (
        <p className="rounded-2xl bg-gold-soft px-4 py-3 text-base font-semibold text-gold-deep">
          Trimiterea este dezactivată în previzualizare. Elevii vor putea răspunde după atribuire.
        </p>
      ) : null}

      {!isPreview && !canPersist ? (
        <p className="rounded-2xl bg-gold-soft px-4 py-3 text-base font-semibold text-gold-deep">
          Deschide activitatea dintr-o temă ca să poți trimite răspunsul.
        </p>
      ) : null}

      {status === 'error' ? (
        <p role="alert" className="rounded-2xl bg-error-soft px-4 py-3 text-base font-semibold text-error">
          {errorMessage}
        </p>
      ) : null}

      {status === 'submitted' ? (
        <p role="status" className="rounded-2xl bg-primary-soft px-4 py-3 text-base font-semibold text-primary-deep">
          Răspuns trimis! Profesorul îl poate verifica acum.
        </p>
      ) : null}
    </>
  )
}

function SubmitBar({
  disabled,
  isSaving,
  onSubmit,
}: {
  disabled: boolean
  isSaving: boolean
  onSubmit: () => void
}) {
  return (
    <div className="flex justify-end">
      <Button type="button" mode="kid" size="lg" tone="lime" disabled={disabled} onClick={onSubmit}>
        {isSaving ? 'Se salvează…' : 'Trimite'}
      </Button>
    </div>
  )
}

export function FreeResponsePlayContent({
  title,
  backUrl,
  mode,
  config,
  activityId,
  versionId,
  assignmentId,
  initialSubmission,
}: FreeResponsePlayContentProps) {
  const submission = useMemo(() => createBrowserFreeResponseSubmission({ activityId, versionId, assignmentId }), [activityId, versionId, assignmentId])
  const [submissionProblem, setSubmissionProblem] = useState<SubmissionOutcome['kind'] | null>(null)
  const normalized = useMemo(() => normalizeConfig(config), [config])
  const isPreview = mode === 'preview'
  const canPersist = canPersistSubmission(isPreview, activityId, versionId, assignmentId)
  const draftKey = useMemo(() => getDraftKey(activityId, versionId, assignmentId), [activityId, assignmentId, versionId])
  const initialResponse = useMemo(() => parseLatestResponse(initialSubmission?.latestResponse), [initialSubmission])
  const backup = useMemo(() => readBackup(draftKey), [draftKey])
  const initiallyLocked = isLockedSubmissionStatus(initialSubmission?.status)
  const panelState = useMemo(() => initialPanelState(initialResponse, backup), [backup, initialResponse])

  const [textOpen, setTextOpen] = useState(panelState.textOpen)
  const [drawingOpen, setDrawingOpen] = useState(panelState.drawingOpen)
  const [voiceOpen, setVoiceOpen] = useState(panelState.voiceOpen)
  const [text, setText] = useState(initialResponse.text || backup?.text || '')
  const [strokes, setStrokes] = useState<DrawingStroke[]>(initialResponse.strokes.length ? initialResponse.strokes : normalizeStrokes(backup?.drawing?.strokes))
  const [status, setStatus] = useState<'idle' | 'saving' | 'submitted' | 'error'>(initiallyLocked ? 'submitted' : 'idle')
  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'ready' | 'unsupported'>(initialResponse.hasVoice ? 'ready' : 'idle')
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null)
  const [voiceMime, setVoiceMime] = useState<VoiceMime | null>(null)
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null)
  const [voiceDurationMs, setVoiceDurationMs] = useState<number | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const activeStrokeRef = useRef<DrawingStroke | null>(null)
  const draftStartedRef = useRef(Boolean(initialSubmission))
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recorderChunksRef = useRef<Blob[]>([])
  const recorderStreamRef = useRef<MediaStream | null>(null)
  const recordingStartedAtRef = useRef<number | null>(null)

  const locked = status === 'submitted'
  const editingDisabled = (submissionProblem === 'uncertain' || submissionProblem === 'cleanup-failed') || isEditingLocked({ canPersist, isPreview, locked, status })
  const hasTextResponse = text.trim().length > 0
  const hasDrawingResponse = strokes.length > 0
  const hasVoiceResponse = Boolean(voiceBlob) || initialResponse.hasVoice
  const hasAnyResponse = hasAnyFreeResponse({ hasDrawingResponse, hasTextResponse, hasVoiceResponse })
  const submitDisabled = !canSubmitResponse({ canPersist, hasAnyResponse, isPreview, locked, status })
  const drawingPreviewUrl = useMemo(() => createDrawingPreviewUrl(strokes), [strokes])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawStrokes(canvas, strokes)
  }, [strokes])

  useEffect(() => {
    if (!draftKey || locked) return
    const payload: DraftBackup = {
      version: 1,
      text,
      textOpen,
      drawingOpen,
      voiceOpen,
      drawing: { strokes },
    }
    window.localStorage.setItem(draftKey, JSON.stringify(payload))
  }, [draftKey, drawingOpen, locked, strokes, text, textOpen, voiceOpen])

  useEffect(() => {
    return () => {
      if (voiceUrl) URL.revokeObjectURL(voiceUrl)
      recorderStreamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [voiceUrl])

  async function startDraft() {
    if (shouldSkipDraftStart({ canPersist, draftStarted: draftStartedRef.current, locked })) {
      return
    }
    const target = { activityId: activityId!, versionId: versionId!, assignmentId: assignmentId! }

    draftStartedRef.current = true
    setStatus('saving')
    try {
      const result = await recordSubmission({
        intent: 'start',
        assignmentId: target.assignmentId,
        activityId: target.activityId,
        versionId: target.versionId,
        response: {},
      })
      if (isLockedSubmissionStatus(result.data?.status)) {
        const latest = parseLatestResponse(result.data.latestResponse)
        setText(latest.text)
        setStrokes(latest.strokes)
        setStatus('submitted')
        return
      }
      setStatus('idle')
    } catch {
      draftStartedRef.current = false
      setStatus('error')
    }
  }

  function activateTool(tool: ResponseTool) {
    if (editingDisabled) return
    if (tool === 'text') setTextOpen(true)
    if (tool === 'drawing') setDrawingOpen(true)
    if (tool === 'voice') setVoiceOpen(true)
    void startDraft()
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (editingDisabled) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    activeStrokeRef.current = { points: [pointFromEvent(event.currentTarget, event)] }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (editingDisabled || !activeStrokeRef.current) return
    event.preventDefault()
    const currentPoints = activeStrokeRef.current.points
    const previousPoint = currentPoints[currentPoints.length - 1]
    const point = pointFromEvent(event.currentTarget, event)
    activeStrokeRef.current = { points: [...currentPoints, point] }
    if (previousPoint) {
      drawStrokeSegment(event.currentTarget, previousPoint, point)
    }
  }

  function finishStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    const completedStroke = activeStrokeRef.current
    activeStrokeRef.current = null
    if (!editingDisabled && completedStroke?.points.length) {
      setStrokes((current) => [...current, completedStroke])
    }
  }

  async function startRecording() {
    if (editingDisabled) return
    const recorderMime = resolveRecorderMime()
    if (!recorderMime || !navigator.mediaDevices?.getUserMedia) {
      setVoiceState('unsupported')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: recorderMime.recorderType })
      recorderChunksRef.current = []
      recorderStreamRef.current = stream
      recorderRef.current = recorder
      recordingStartedAtRef.current = Date.now()
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recorderChunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(recorderChunksRef.current, { type: recorderMime.mime })
        if (voiceUrl) URL.revokeObjectURL(voiceUrl)
        setVoiceBlob(blob)
        setVoiceMime(recorderMime.mime)
        setVoiceDurationMs(recordingStartedAtRef.current ? Date.now() - recordingStartedAtRef.current : null)
        setVoiceUrl(URL.createObjectURL(blob))
        setVoiceState('ready')
        stream.getTracks().forEach((track) => track.stop())
        recorderStreamRef.current = null
        recorderRef.current = null
      }
      setVoiceBlob(null)
      setVoiceMime(null)
      setVoiceState('recording')
      recorder.start()
      void startDraft()
    } catch {
      setVoiceState('unsupported')
    }
  }

  function stopRecording() {
    recorderRef.current?.stop()
  }

  function retryRecording() {
    if (voiceUrl) URL.revokeObjectURL(voiceUrl)
    setVoiceBlob(null)
    setVoiceMime(null)
    setVoiceUrl(null)
    setVoiceDurationMs(null)
    setVoiceState('idle')
  }

  async function submit() {
    if (!canSubmitResponse({ canPersist, hasAnyResponse, isPreview, locked, status })) {
      return
    }
    const target = { activityId: activityId!, versionId: versionId!, assignmentId: assignmentId! }

    setStatus('saving')
    const outcome = await submission.submit({
      ...target, text, strokes, drawingDataUrl: drawingPreviewUrl,
      voiceBlob, voiceMime, voiceDurationMs, hasTextResponse, hasDrawingResponse,
      retainExistingVoice: initialResponse.hasVoice,
    })
    setSubmissionProblem(outcome.kind)
    if (outcome.kind === 'submitted' || outcome.kind === 'locked') {
      if (outcome.kind === 'locked') {
        const latest = parseLatestResponse(outcome.latestResponse)
        setText(latest.text)
        setStrokes(latest.strokes)
      }
      // A local storage failure must never compensate a committed submission.
      try { if (draftKey) window.localStorage.removeItem(draftKey) } catch { /* Server result is authoritative. */ }
      setStatus('submitted')
    } else {
      setStatus('error')
    }
  }

  return (
    <main className="min-h-screen bg-surface px-4 py-5 text-on-surface sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <FreeResponseHeader backUrl={backUrl} isPreview={isPreview} />
        <PromptCard title={title} prompt={normalized.prompt} />
        <ResourcesSection resources={normalized.resources} />
        <ResponseToolsSection
          allowedTools={normalized.allowedTools}
          disabled={editingDisabled}
          drawingOpen={drawingOpen}
          drawingPreviewUrl={drawingPreviewUrl}
          canvasRef={canvasRef}
          onActivate={activateTool}
          onClearDrawing={() => setStrokes([])}
          onPointerCancel={finishStroke}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onRetryRecording={retryRecording}
          onStartDraft={() => {
            void startDraft()
          }}
          onStartRecording={() => {
            void startRecording()
          }}
          onStopRecording={stopRecording}
          onTextChange={setText}
          text={text}
          textOpen={textOpen}
          strokes={strokes}
          voiceOpen={voiceOpen}
          voiceState={voiceState}
          voiceUrl={voiceUrl}
        />
        <StatusMessages problem={submissionProblem} canPersist={canPersist} isPreview={isPreview} status={status} />
        <SubmitBar
          disabled={submitDisabled}
          isSaving={status === 'saving'}
          onSubmit={() => {
            void submit()
          }}
        />
      </div>
    </main>
  )
}
