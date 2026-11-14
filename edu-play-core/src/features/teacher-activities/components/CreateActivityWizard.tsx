'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition, type FormEvent } from 'react'

import {
  Button,
  Card,
  Checkbox,
  FilterChipGroup,
  PageHeader,
  Pill,
  TextareaField,
  TextField,
} from '@/shared/components/ui/kit'
import { CardButton } from '@/shared/components/ui/kit/CardButton'
import { Icon } from '@/shared/components/ui/Icon'
import { ROUTES } from '@/shared/lib/constants'
import { cn } from '@/shared/lib/utils/cn'
import { saveFreeResponseDraft, updateFreeResponseDraft } from '../actions'
import type {
  EditableFreeResponseDraft,
  FreeResponseDraftInput,
  SaveFreeResponseDraftResult,
  TeacherAuthorableActivityType,
} from '../types'

interface CreateActivityWizardProps {
  interactiveTypes: TeacherAuthorableActivityType[]
  initialDraft?: EditableFreeResponseDraft
}

type ActivityTemplateMode = 'free-response' | 'interactive'

type FieldErrors = NonNullable<SaveFreeResponseDraftResult['fieldErrors']>

const DEFAULT_TOOLS = {
  text: true,
  drawing: true,
  voice: true,
}

type AllowedTools = typeof DEFAULT_TOOLS
type ResponseToolKey = keyof AllowedTools
type ResourceDrafts = NonNullable<FreeResponseDraftInput['resources']>

const TOOL_LABELS = {
  text: 'Text',
  drawing: 'Desen',
  voice: 'Voce',
} as const

const MAX_RESOURCES = 6
const FORM_ID = 'create-activity-draft-form'
const SOURCE_OPTIONS = [
  { value: 'upload', label: 'Încarcă' },
  { value: 'link', label: 'Link' },
] as const

function isWebUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function validateDraft(input: FreeResponseDraftInput): FieldErrors {
  const errors: FieldErrors = {}
  if (!input.title.trim()) errors.title = 'Scrie un titlu pentru activitate.'
  if (!input.prompt.trim()) errors.prompt = 'Scrie instrucțiunile pentru elevi.'
  if (!input.allowedTools.text && !input.allowedTools.drawing && !input.allowedTools.voice) {
    errors.allowedTools = 'Alege cel puțin un mod de răspuns.'
  }
  const resources = input.resources ?? []
  if (resources.some((resource) => !resource.title.trim() || !isWebUrl(resource.url.trim()))) {
    errors.resources = 'Completează titlul și un link web valid pentru fiecare resursă.'
  }
  return errors
}


function TemplateCard({
  active,
  href,
  icon,
  label,
  meta,
  pill,
  onClick,
  disabled,
}: {
  active?: boolean
  href?: string
  icon: 'PencilSimple' | 'Sparkle' | 'Link' | 'GameController'
  label: string
  meta: string
  pill?: string
  onClick?: () => void
  disabled?: boolean
}) {
  const className = cn(
    'relative flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border p-4 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
    active ? 'border-primary bg-primary-soft' : 'border-outline-variant bg-surface-container-lowest',
    disabled ? 'cursor-not-allowed opacity-70' : 'hover:border-primary hover:bg-primary-soft',
  )
  const content = (
    <>
      {pill ? (
        <span className="absolute right-3 top-3 rounded-full bg-gold-soft px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-gold-deep">
          {pill}
        </span>
      ) : null}
      <span className="flex h-11 w-11 items-center justify-center rounded-md bg-surface-container text-primary-deep">
        <Icon name={icon} size={23} aria-hidden />
      </span>
      <span className="text-sm font-bold text-on-surface">{label}</span>
      <span className="text-xs font-semibold leading-5 text-on-surface-variant">{meta}</span>
    </>
  )

  if (href && !disabled) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    )
  }

  return (
    <CardButton aria-pressed={active} onClick={onClick} disabled={disabled} className={className}>
      {content}
    </CardButton>
  )
}

function ActivitySourceCards({
  resourcesCount,
  onSelectUpload,
  onAddLink,
}: {
  resourcesCount: number
  onSelectUpload: () => void
  onAddLink: () => void
}) {
  const linkDisabled = resourcesCount >= MAX_RESOURCES

  return (
    <section aria-label="Conținut activitate" className="grid gap-4 md:grid-cols-2">
      <CardButton
        className="rounded-lg border border-outline bg-surface-container-lowest p-4 text-left shadow-soft-sm transition-colors hover:bg-primary-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        onClick={onSelectUpload}
      >
        <span className="flex items-center gap-3 text-sm font-bold text-on-surface">
          <Icon name="ArrowUp" size={20} aria-hidden />
          Încarcă
        </span>
        <span className="mt-2 block text-xs font-semibold leading-5 text-on-surface-variant">
          Pornește de la instrucțiuni, resurse și instrumentele elevilor.
        </span>
      </CardButton>
      <CardButton
        disabled={linkDisabled}
        className="rounded-lg border border-outline bg-surface-container-lowest p-4 text-left shadow-soft-sm transition-colors hover:bg-primary-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60"
        onClick={onAddLink}
      >
        <span className="flex items-center gap-3 text-sm font-bold text-on-surface">
          <Icon name="Link" size={20} aria-hidden />
          Link
        </span>
        <span className="mt-2 block text-xs font-semibold leading-5 text-on-surface-variant">
          Atașează materiale web pentru contextul activității.
        </span>
      </CardButton>
    </section>
  )
}

function ResponseTemplateSection({
  allowedTools,
  allowedToolsError,
  hasInteractiveTypes,
  interactiveTypeCount,
  isEditing,
  isInteractiveTemplateSelected,
  onAiDraftSelected,
  onFreeResponseSelected,
  onInteractiveSelected,
  onToolChange,
}: {
  allowedTools: AllowedTools
  allowedToolsError?: string
  hasInteractiveTypes: boolean
  interactiveTypeCount: number
  isEditing: boolean
  isInteractiveTemplateSelected: boolean
  onAiDraftSelected: () => void
  onFreeResponseSelected: () => void
  onInteractiveSelected: () => void
  onToolChange: (tool: ResponseToolKey, checked: boolean) => void
}) {
  return (
    <fieldset
      aria-label="Șablon răspuns elev"
      className="space-y-4"
      aria-describedby={allowedToolsError ? 'free-response-tools-error' : undefined}
    >
      <legend className="sr-only">Șablon răspuns elev</legend>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <TemplateCard
          active={!isInteractiveTemplateSelected}
          icon="PencilSimple"
          label="Creează de la zero"
          meta="Fluxul EduPlay activ"
          onClick={onFreeResponseSelected}
        />
        <TemplateCard
          icon="Sparkle"
          label="Generează cu AI"
          meta="Păstrează modificările înainte de generator"
          pill="Nou"
          onClick={onAiDraftSelected}
        />
        {!isEditing && (
          hasInteractiveTypes ? (
            <TemplateCard
              active={isInteractiveTemplateSelected}
              icon="GameController"
              label="Joc interactiv"
              meta={`${interactiveTypeCount} șabloane disponibile`}
              onClick={onInteractiveSelected}
            />
          ) : (
            <TemplateCard
              disabled
              icon="GameController"
              label="Joc interactiv"
              meta="Șabloanele interactive nu sunt disponibile încă"
            />
          )
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Checkbox
          label="Text"
          checked={allowedTools.text}
          onChange={(event) => onToolChange('text', event.target.checked)}
        />
        <Checkbox
          label="Desen"
          checked={allowedTools.drawing}
          onChange={(event) => onToolChange('drawing', event.target.checked)}
        />
        <Checkbox
          label="Voce"
          checked={allowedTools.voice}
          onChange={(event) => onToolChange('voice', event.target.checked)}
        />
      </div>
      {allowedToolsError ? (
        <p id="free-response-tools-error" role="alert" className="text-sm font-semibold text-error">
          {allowedToolsError}
        </p>
      ) : (
        <p className="text-sm font-medium text-on-surface-variant">
          Elevii pot trimite oricare dintre instrumentele selectate, inclusiv combinate.
        </p>
      )}
    </fieldset>
  )
}

function InteractiveTypesSection({
  interactiveTypes,
  selected,
}: {
  interactiveTypes: TeacherAuthorableActivityType[]
  selected: boolean
}) {
  if (!selected) return null

  return (
    <section aria-label="Jocuri interactive" className="space-y-4 rounded-lg bg-surface-container p-4">
      <h2 className="font-headline text-lg font-bold text-on-surface">Jocuri interactive</h2>
      <p className="text-sm font-semibold leading-6 text-on-surface-variant">
        Constructorul pentru jocuri interactive nu este conectat încă. Alege „Creează de la zero” pentru a salva o
        ciornă, sau revino aici când autoratul interactiv este disponibil.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {interactiveTypes.map((activityType) => (
          <article key={activityType.typeId} className="rounded-lg border border-outline bg-surface-container-lowest p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-on-surface">{activityType.displayName}</h3>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-muted">
                  {activityType.category ?? 'Interactiv'}
                </p>
              </div>
              <Pill tone="sun">Constructor în pregătire</Pill>
            </div>
            <p className="mt-3 text-sm font-medium leading-6 text-on-surface-variant">
              Tip: {activityType.rendererKind}; autorare: {activityType.authoringMode}.
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

function ResourceFields({
  error,
  onAdd,
  onRemove,
  onUpdate,
  resources,
}: {
  error?: string
  onAdd: () => void
  onRemove: (index: number) => void
  onUpdate: (index: number, field: keyof ResourceDrafts[number], value: string) => void
  resources: ResourceDrafts
}) {
  return (
    <section aria-label="Resurse pentru elevi" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-headline text-lg font-bold text-on-surface">Resurse pentru elevi</h2>
        <Button type="button" variant="secondary" disabled={resources.length >= MAX_RESOURCES} onClick={onAdd}>
          Adaugă resursă
        </Button>
      </div>

      {resources.length > 0 ? (
        <div className="space-y-3">
          {resources.map((resource, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-lg border border-outline bg-surface-container p-3 md:grid-cols-[1fr_1fr_auto] md:items-end"
            >
              <TextField
                label={`Titlu resursă ${index + 1}`}
                value={resource.title}
                onChange={(event) => onUpdate(index, 'title', event.target.value)}
                placeholder="Ex: Cântec de inspirație"
              />
              <TextField
                label={`Link resursă ${index + 1}`}
                value={resource.url}
                onChange={(event) => onUpdate(index, 'url', event.target.value)}
                placeholder="https://…"
                maxLength={2048}
              />
              <Button type="button" variant="secondary" onClick={() => onRemove(index)}>
                Șterge
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}
    </section>
  )
}

function ResultBanner({
  isEditing,
  message,
  savedActivityId,
}: {
  isEditing: boolean
  message: string | null
  savedActivityId: string | null
}) {
  if (!message) return null

  return (
    <div
      role={savedActivityId ? 'status' : 'alert'}
      className={cn(
        'rounded-lg p-4 text-sm font-semibold leading-6',
        savedActivityId ? 'bg-primary-soft text-primary-deep' : 'bg-error-soft text-error',
      )}
    >
      {message}{' '}
      {savedActivityId ? (
        <Link className="font-bold underline" href={`${ROUTES.TEACHER.ACTIVITIES}?tab=my&status=draft`}>
          {isEditing ? 'Înapoi la activitățile mele' : 'Vezi ciornele'}
        </Link>
      ) : null}
    </div>
  )
}


function StudentPreview({
  title,
  prompt,
  selectedTools,
  resourcesCount,
  shareWithFamilyOnApproval,
}: {
  title: string
  prompt: string
  selectedTools: string[]
  resourcesCount: number
  shareWithFamilyOnApproval: boolean
}) {
  return (
    <Card
      role="region"
      aria-label="Previzualizare elev"
      className="sticky top-24 overflow-hidden rounded-xl border border-outline bg-surface-container-lowest p-0 shadow-soft-sm"
    >
      <div className="border-b border-outline bg-surface-container px-5 py-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">Previzualizare elev</h2>
      </div>
      <div className="space-y-4 p-5">
        <div className="rounded-xl border border-outline-variant bg-primary-soft p-4">
          <Pill tone="lime">Ciornă privată</Pill>
          <h2 className="mt-4 text-lg font-bold leading-snug text-on-surface">
            {title.trim() || 'Titlul activității'}
          </h2>
          <p className="mt-2 min-h-16 text-sm font-medium leading-6 text-on-surface-variant">
            {prompt.trim() || 'Instrucțiunile pentru elevi vor apărea aici.'}
          </p>
        </div>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-bold text-on-surface">Instrumente de răspuns</dt>
            <dd className="mt-1 text-on-surface-variant">
              {selectedTools.length ? selectedTools.join(', ') : 'Niciun instrument selectat'}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-on-surface">Resurse</dt>
            <dd className="mt-1 text-on-surface-variant">
              {resourcesCount ? `${resourcesCount} linkuri pentru elevi` : 'Fără resurse atașate.'}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-on-surface">Familie</dt>
            <dd className="mt-1 text-on-surface-variant">
              {shareWithFamilyOnApproval ? 'Poate fi partajată după aprobare.' : 'Nu se partajează automat cu familia.'}
            </dd>
          </div>
        </dl>
      </div>
    </Card>
  )
}

export function CreateActivityWizard({ interactiveTypes, initialDraft }: CreateActivityWizardProps) {
  const isEditing = Boolean(initialDraft)
  const [templateMode, setTemplateMode] = useState<ActivityTemplateMode>('free-response')
  const [title, setTitle] = useState(initialDraft?.title ?? '')
  const [prompt, setPrompt] = useState(initialDraft?.prompt ?? '')
  const [allowedTools, setAllowedTools] = useState(initialDraft?.allowedTools ?? DEFAULT_TOOLS)
  const [shareWithFamilyOnApproval, setShareWithFamilyOnApproval] = useState(
    initialDraft?.shareWithFamilyOnApproval ?? false,
  )
  const [resources, setResources] = useState<ResourceDrafts>(initialDraft?.resources ?? [])
  const [sourceTab, setSourceTab] = useState<'upload' | 'link'>(resources.length > 0 ? 'link' : 'upload')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [savedActivityId, setSavedActivityId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const hasInteractiveTypes = !isEditing && interactiveTypes.length > 0
  const isInteractiveTemplateSelected = templateMode === 'interactive'

  const selectedTools = useMemo(
    () =>
      (Object.entries(allowedTools) as Array<[keyof typeof allowedTools, boolean]>)
        .filter(([, enabled]) => enabled)
        .map(([tool]) => TOOL_LABELS[tool]),
    [allowedTools],
  )

  function updateTool(tool: ResponseToolKey, checked: boolean) {
    setAllowedTools((current) => ({ ...current, [tool]: checked }))
    setErrors((current) => ({ ...current, allowedTools: undefined }))
  }

  function selectFreeResponseTemplate() {
    setTemplateMode('free-response')
    setResultMessage(null)
  }

  function selectInteractiveTemplate() {
    setTemplateMode('interactive')
    setResultMessage(null)
  }

  function showAiDraftMessage() {
    setResultMessage('Salvează ciorna înainte să deschizi generatorul AI, ca să nu pierzi modificările.')
  }

  function addResource() {
    if (resources.length >= MAX_RESOURCES) return
    setResources((current) => [...current, { title: '', url: '' }])
    setErrors((current) => ({ ...current, resources: undefined }))
  }

  function updateResource(index: number, field: keyof ResourceDrafts[number], value: string) {
    setResources((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    )
    setErrors((current) => ({ ...current, resources: undefined }))
  }

  function removeResource(index: number) {
    setResources((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  function handleSourceChange(value: string) {
    if (value === 'upload') {
      selectFreeResponseTemplate()
      setSourceTab('upload')
      return
    }

    setSourceTab('link')
    setErrors((current) => ({ ...current, resources: undefined }))
    setResources((current) => (current.length > 0 ? current : [{ title: '', url: '' }]))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setResultMessage(null)
    setSavedActivityId(null)

    if (isInteractiveTemplateSelected) {
      setResultMessage(
        'Constructorul pentru jocuri interactive nu este disponibil încă. Alege „Creează de la zero” pentru a salva o ciornă.',
      )
      return
    }

    const input: FreeResponseDraftInput = {
      title,
      prompt,
      allowedTools,
      shareWithFamilyOnApproval,
      resources: resources.map((resource) => ({
        title: resource.title.trim(),
        url: resource.url.trim(),
      })),
    }
    const nextErrors = validateDraft(input)
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return

    startTransition(async () => {
      const result = initialDraft
        ? await updateFreeResponseDraft(initialDraft.activityId, input)
        : await saveFreeResponseDraft(input)
      if (!result.success) {
        setErrors(result.fieldErrors ?? {})
        setResultMessage(result.error ?? 'Nu am putut salva ciorna.')
        return
      }

      setErrors({})
      setSavedActivityId(result.data?.id ?? null)
      setResultMessage(
        initialDraft ? 'Activitatea a fost actualizată.' : 'Ciorna a fost salvată în Activitățile mele.',
      )
    })
  }


  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <PageHeader
        title="Creează activitate"
        eyebrow="Atelier profesor"
        subtitle={isEditing ? 'Actualizează ciorna și păstrează același flux de publicare.' : 'Construiește o activitate pentru spațiul elevilor.'}
        action={
          <Button type="submit" form={FORM_ID} variant="primary" isPending={isPending} disabled={isInteractiveTemplateSelected}>
            <Icon name="CheckCircle" size="sm" weight="bold" aria-hidden />
            {isEditing ? 'Salvează modificările' : 'Salvează ciorna'}
          </Button>
        }
      />

      <div className="mx-auto grid w-full max-w-[1280px] gap-6 px-5 py-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start lg:px-7">
        <form id={FORM_ID} onSubmit={handleSubmit} className="min-w-0 space-y-5" noValidate>
          <Card className="space-y-5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                href={isEditing ? `${ROUTES.TEACHER.ACTIVITIES}?tab=my` : ROUTES.TEACHER.ACTIVITIES}
                aria-label="Înapoi la activități"
                className="inline-flex min-h-10 items-center gap-2 rounded-md text-sm font-bold text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Icon name="ArrowLeft" size={18} aria-hidden />
                Înapoi la activități
              </Link>
            </div>

            <TextField
              label="Titlu activitate"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value)
                setErrors((current) => ({ ...current, title: undefined }))
              }}
              error={errors.title}
              placeholder="Ex: Povestea personajului meu"
              required
              maxLength={200}
            />

            <FilterChipGroup
              ariaLabel="Sursa activității"
              items={[...SOURCE_OPTIONS]}
              value={sourceTab}
              onChange={handleSourceChange}
            />

            <ActivitySourceCards
              resourcesCount={resources.length}
              onSelectUpload={selectFreeResponseTemplate}
              onAddLink={addResource}
            />

            <ResponseTemplateSection
              allowedTools={allowedTools}
              allowedToolsError={errors.allowedTools}
              hasInteractiveTypes={hasInteractiveTypes}
              interactiveTypeCount={interactiveTypes.length}
              isEditing={isEditing}
              isInteractiveTemplateSelected={isInteractiveTemplateSelected}
              onAiDraftSelected={showAiDraftMessage}
              onFreeResponseSelected={selectFreeResponseTemplate}
              onInteractiveSelected={selectInteractiveTemplate}
              onToolChange={updateTool}
            />

            <InteractiveTypesSection interactiveTypes={interactiveTypes} selected={isInteractiveTemplateSelected} />

            <TextareaField
              label="Instrucțiuni pentru elevi"
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value)
                setErrors((current) => ({ ...current, prompt: undefined }))
              }}
              error={errors.prompt}
              placeholder="Ex: Desenează un personaj și spune prin voce ce puteri are."
              required
              rows={5}
            />

            <ResourceFields
              error={errors.resources}
              onAdd={addResource}
              onRemove={removeResource}
              onUpdate={updateResource}
              resources={resources}
            />

            <Checkbox
              label="Poate fi arătat familiei după aprobare"
              checked={shareWithFamilyOnApproval}
              onChange={(event) => setShareWithFamilyOnApproval(event.target.checked)}
            />

            <ResultBanner isEditing={isEditing} message={resultMessage} savedActivityId={savedActivityId} />
          </Card>
        </form>

        <StudentPreview
          title={title}
          prompt={prompt}
          selectedTools={selectedTools}
          resourcesCount={resources.length}
          shareWithFamilyOnApproval={shareWithFamilyOnApproval}
        />
      </div>
    </main>
  )
}
