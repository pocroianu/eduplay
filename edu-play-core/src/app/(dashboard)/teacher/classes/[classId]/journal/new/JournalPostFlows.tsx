import Link from 'next/link'
import type { ClassDetailData, ClassDetailStudent } from '@/features/teacher-dashboard/server'
import type { Language } from '@/lib/i18n/config'
import { Icon } from '@/shared/components/ui/Icon'
import { Button, Card, Pill, TextareaField } from '@/shared/components/ui/kit'
import { CardButton } from '@/shared/components/ui/kit/CardButton'
import { getServerTranslation } from '@/lib/i18n/server'
import { ROUTES } from '@/shared/lib/constants'

type JournalFlowData = ClassDetailData

type PickerTool = {
  title: string
  description: string
  icon: 'Camera' | 'Palette' | 'PlayCircle' | 'Archive' | 'TextAa' | 'Link'
  href?: string
}

type SideCard = {
  title: string
  description: string
  icon: 'SquaresFour' | 'Calendar'
  value: string
}

type JournalPickerCopy = {
  back: string
  heading: string
  description: string
  classActive: string
  classArchived: string
  toolsTitle: string
  toolsDescription: string
  contextTitle: string
  contextDescription: string
  noPersistenceTitle: string
  noPersistenceDescription: string
  preview: string
  tools: PickerTool[]
}

type JournalNoteCopy = {
  back: string
  headingLabel: string
  heading: string
  description: string
  draft: string
  publish: string
  editorTitle: string
  editorDescription: string
  editorPreview: string
  textboxLabel: string
  textboxPlaceholder: string
  textboxHelp: string
  previewTitle: string
  teacherLabel: string
  previewPlaceholder: string
  confirmation: string
  audienceTitle: string
  audienceDescription: string
  noStudents: string
  noPersistenceTitle: string
  noPersistenceDescription: string
}

type JournalSharedCopy = {
  picker: JournalPickerCopy
  note: JournalNoteCopy
  sideCards: SideCard[]
}

async function t(lang: Language, key: string) {
  return getServerTranslation(lang, 'teacher', key)
}

export async function getJournalFlowCopy(lang: Language): Promise<JournalSharedCopy> {
  const [
    pickerBack,
    pickerHeading,
    pickerDescription,
    pickerClassActive,
    pickerClassArchived,
    pickerToolsTitle,
    pickerToolsDescription,
    pickerContextTitle,
    pickerContextDescription,
    pickerNoPersistenceTitle,
    pickerNoPersistenceDescription,
    pickerPreview,
    photo,
    photoDescription,
    drawing,
    drawingDescription,
    video,
    videoDescription,
    upload,
    uploadDescription,
    note,
    noteDescription,
    link,
    linkDescription,
    noteBack,
    noteHeadingLabel,
    noteHeading,
    noteDescriptionText,
    noteDraft,
    notePublish,
    noteEditorTitle,
    noteEditorDescription,
    noteEditorPreview,
    noteTextboxLabel,
    noteTextboxPlaceholder,
    noteTextboxHelp,
    notePreviewTitle,
    noteTeacherLabel,
    notePreviewPlaceholder,
    noteConfirmation,
    noteAudienceTitle,
    noteAudienceDescription,
    noteNoStudents,
    noteNoPersistenceTitle,
    noteNoPersistenceDescription,
    sideFoldersTitle,
    sideFoldersDescription,
    sideFoldersValue,
    sideScheduleTitle,
    sideScheduleDescription,
    sideScheduleValue,
  ] = await Promise.all([
    t(lang, 'journal.picker.back'),
    t(lang, 'journal.picker.heading'),
    t(lang, 'journal.picker.description'),
    t(lang, 'journal.picker.classActive'),
    t(lang, 'journal.picker.classArchived'),
    t(lang, 'journal.picker.toolsTitle'),
    t(lang, 'journal.picker.toolsDescription'),
    t(lang, 'journal.picker.contextTitle'),
    t(lang, 'journal.picker.contextDescription'),
    t(lang, 'journal.picker.noPersistenceTitle'),
    t(lang, 'journal.picker.noPersistenceDescription'),
    t(lang, 'journal.picker.preview'),
    t(lang, 'journal.picker.photo'),
    t(lang, 'journal.picker.photoDescription'),
    t(lang, 'journal.picker.drawing'),
    t(lang, 'journal.picker.drawingDescription'),
    t(lang, 'journal.picker.video'),
    t(lang, 'journal.picker.videoDescription'),
    t(lang, 'journal.picker.upload'),
    t(lang, 'journal.picker.uploadDescription'),
    t(lang, 'journal.picker.note'),
    t(lang, 'journal.picker.noteDescription'),
    t(lang, 'journal.picker.link'),
    t(lang, 'journal.picker.linkDescription'),
    t(lang, 'journal.note.back'),
    t(lang, 'journal.note.headingLabel'),
    t(lang, 'journal.note.heading'),
    t(lang, 'journal.note.description'),
    t(lang, 'journal.note.draft'),
    t(lang, 'journal.note.publish'),
    t(lang, 'journal.note.editorTitle'),
    t(lang, 'journal.note.editorDescription'),
    t(lang, 'journal.note.editorPreview'),
    t(lang, 'journal.note.textbox'),
    t(lang, 'journal.note.textboxPlaceholder'),
    t(lang, 'journal.note.textboxHelp'),
    t(lang, 'journal.note.previewTitle'),
    t(lang, 'journal.note.teacherLabel'),
    t(lang, 'journal.note.previewPlaceholder'),
    t(lang, 'journal.note.confirmation'),
    t(lang, 'journal.note.audience'),
    t(lang, 'journal.note.audienceDescription'),
    t(lang, 'journal.note.noStudents'),
    t(lang, 'journal.note.noPersistenceTitle'),
    t(lang, 'journal.note.noPersistenceDescription'),
    t(lang, 'journal.side.foldersTitle'),
    t(lang, 'journal.side.foldersDescription'),
    t(lang, 'journal.side.foldersValue'),
    t(lang, 'journal.side.scheduleTitle'),
    t(lang, 'journal.side.scheduleDescription'),
    t(lang, 'journal.side.scheduleValue'),
  ])

  return {
    picker: {
      back: pickerBack,
      heading: pickerHeading,
      description: pickerDescription,
      classActive: pickerClassActive,
      classArchived: pickerClassArchived,
      toolsTitle: pickerToolsTitle,
      toolsDescription: pickerToolsDescription,
      contextTitle: pickerContextTitle,
      contextDescription: pickerContextDescription,
      noPersistenceTitle: pickerNoPersistenceTitle,
      noPersistenceDescription: pickerNoPersistenceDescription,
      preview: pickerPreview,
      tools: [
        { title: photo, description: photoDescription, icon: 'Camera' },
        { title: drawing, description: drawingDescription, icon: 'Palette' },
        { title: video, description: videoDescription, icon: 'PlayCircle' },
        { title: upload, description: uploadDescription, icon: 'Archive' },
        { title: note, description: noteDescription, icon: 'TextAa', href: 'note' },
        { title: link, description: linkDescription, icon: 'Link' },
      ],
    },
    note: {
      back: noteBack,
      headingLabel: noteHeadingLabel,
      heading: noteHeading,
      description: noteDescriptionText,
      draft: noteDraft,
      publish: notePublish,
      editorTitle: noteEditorTitle,
      editorDescription: noteEditorDescription,
      editorPreview: noteEditorPreview,
      textboxLabel: noteTextboxLabel,
      textboxPlaceholder: noteTextboxPlaceholder,
      textboxHelp: noteTextboxHelp,
      previewTitle: notePreviewTitle,
      teacherLabel: noteTeacherLabel,
      previewPlaceholder: notePreviewPlaceholder,
      confirmation: noteConfirmation,
      audienceTitle: noteAudienceTitle,
      audienceDescription: noteAudienceDescription,
      noStudents: noteNoStudents,
      noPersistenceTitle: noteNoPersistenceTitle,
      noPersistenceDescription: noteNoPersistenceDescription,
    },
    sideCards: [
      {
        title: sideFoldersTitle,
        description: sideFoldersDescription,
        icon: 'SquaresFour',
        value: sideFoldersValue,
      },
      {
        title: sideScheduleTitle,
        description: sideScheduleDescription,
        icon: 'Calendar',
        value: sideScheduleValue,
      },
    ],
  }
}

const LINED_PAPER_STYLE = {
  backgroundImage:
    'repeating-linear-gradient(to bottom, transparent 0, transparent 2rem, var(--color-outline-variant) calc(2rem + 1px))',
  backgroundSize: '100% calc(2rem + 1px)',
} as const

export function JournalToolPickerContent({ data, copy }: { data: JournalFlowData; copy: JournalSharedCopy }) {
  const { classData } = data
  const noteHref = ROUTES.TEACHER.CLASS_JOURNAL_NOTE_NEW(classData.id)
  const tools = copy.picker.tools.map((tool) => ({
    ...tool,
    href: tool.href === 'note' ? noteHref : undefined,
  }))

  return (
    <div className="min-h-screen bg-surface-container text-on-surface">
      <header className="border-b border-outline-variant bg-surface-container-lowest">
        <div className="relative flex min-h-16 items-center justify-center px-4 md:px-6">
          <Link
            href={ROUTES.TEACHER.CLASS(classData.id)}
            aria-label={copy.picker.back}
            className="absolute left-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface transition-colors hover:bg-surface-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:left-6"
          >
            <Icon name="X" size="sm" aria-hidden />
          </Link>
          <h1 className="max-w-[70%] truncate text-center font-headline text-xl font-bold text-on-surface md:text-2xl">
            {copy.picker.heading}
          </h1>
          <div className="absolute right-4 hidden md:block md:right-6">
            <Pill tone={classData.is_active ? 'lime' : 'cream'}>
              {classData.is_active ? copy.picker.classActive : copy.picker.classArchived}
            </Pill>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6 lg:py-10">
        <section aria-labelledby="tool-picker-title" className="rounded-xl border border-outline-variant bg-surface-container-lowest shadow-soft-sm">
          <div className="border-b border-outline-variant px-5 py-4 text-center">
            <h2 id="tool-picker-title" className="font-headline text-xl font-bold text-on-surface">{copy.picker.toolsTitle}</h2>
            <p className="mx-auto mt-1 max-w-2xl text-sm text-on-surface-variant">{copy.picker.description}</p>
          </div>
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <ToolCard
                key={tool.title}
                title={tool.title}
                description={tool.description}
                icon={tool.icon}
                href={tool.href}
              />
            ))}
          </div>
        </section>

        <Card shadow={false} className="border border-outline-variant bg-primary-soft">
          <div className="flex gap-3">
            <Icon name="Info" size="lg" className="text-primary" aria-hidden />
            <div>
              <h2 className="font-bold text-on-surface">{copy.picker.noPersistenceTitle}</h2>
              <p className="mt-1 text-sm leading-6 text-on-surface-variant">{copy.picker.noPersistenceDescription}</p>
            </div>
          </div>
        </Card>
      </main>
    </div>
  )
}

export function JournalNoteEditorContent({ data, copy }: { data: JournalFlowData; copy: JournalSharedCopy }) {
  const { classData, stats, studentRoster } = data

  return (
    <div className="min-h-screen bg-surface-container text-on-surface">
      <header className="border-b border-outline-variant bg-surface-container-lowest">
        <div className="relative flex min-h-16 items-center justify-center px-4 md:px-6">
          <Link
            href={ROUTES.TEACHER.CLASS_JOURNAL_NEW(classData.id)}
            aria-label={copy.note.back}
            className="absolute left-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface transition-colors hover:bg-surface-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:left-6"
          >
            <Icon name="ArrowLeft" size="sm" aria-hidden />
          </Link>
          <h1 className="max-w-[70%] truncate text-center font-headline text-xl font-bold text-on-surface md:text-2xl">
            {copy.note.heading}
          </h1>
          <Button
            mode="standard"
            href={ROUTES.TEACHER.CLASS(classData.id)}
            className="absolute right-4 md:right-6"
            aria-label={copy.note.publish}
          >
            <Icon name="Check" size="sm" aria-hidden />
            {copy.note.publish}
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6 lg:py-10">
        <section aria-labelledby="note-editor-title" className="rounded-xl border border-outline-variant bg-surface-container-lowest shadow-soft-sm">
          <div className="border-b border-outline-variant px-5 py-4 text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-on-surface-variant">{copy.note.headingLabel}</p>
            <h2 id="note-editor-title" className="font-headline text-xl font-bold text-on-surface">{copy.note.editorTitle}</h2>
            <p className="mx-auto mt-1 max-w-2xl text-sm text-on-surface-variant">{copy.note.editorDescription}</p>
          </div>
          <div className="p-4 md:p-6">
            <TextareaField
              id="journal-note-text"
              rows={18}
              maxLength={5000}
              label={copy.note.textboxLabel}
              labelHidden
              helper={copy.note.textboxHelp}
              placeholder={copy.note.textboxPlaceholder}
              inputStyle={{
                ...LINED_PAPER_STYLE,
                backgroundColor: 'var(--color-surface-container-lowest)',
                borderColor: 'var(--color-primary)',
                borderRadius: 0,
                boxShadow: 'none',
                color: 'var(--color-on-surface)',
                fontSize: 18,
                lineHeight: '2rem',
                minHeight: 520,
                padding: '20px 24px',
              }}
            />
          </div>
        </section>

        <section aria-labelledby="note-audience-title" className="rounded-xl border border-outline-variant bg-surface-container-lowest shadow-soft-sm">
          <div className="border-b border-outline-variant px-5 py-4">
            <h2 id="note-audience-title" className="text-lg font-bold text-on-surface">{copy.note.audienceTitle}</h2>
            <p className="mt-1 text-sm text-on-surface-variant">{copy.note.audienceDescription}</p>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2">
            <AudienceRow name={classData.name} meta={`${stats.totalStudents}`} selected />
            {studentRoster.length > 0 ? (
              studentRoster.map((student) => (
                <AudienceRow
                  key={student.id}
                  name={student.fullName}
                  meta={student.username}
                  selected
                  student={student}
                />
              ))
            ) : (
              <div className="rounded-lg border border-outline-variant bg-surface p-4 text-sm text-on-surface-variant md:col-span-2">
                {copy.note.noStudents}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

function ToolCard({
  title,
  description,
  icon,
  href,
}: {
  title: string
  description: string
  icon: PickerTool['icon']
  href?: string
}) {
  const content = (
    <>
      <div className="flex h-24 items-center justify-center" aria-hidden>
        <Icon name={icon} size={56} className="text-primary" weight="duotone" />
      </div>
      <div className="flex min-h-20 flex-col items-center justify-center px-4 pb-5 text-center">
        <h3 className="text-lg font-bold text-on-surface">{title}</h3>
        <p className="mt-1 text-sm leading-5 text-on-surface-variant">{description}</p>
      </div>
    </>
  )

  const className = 'flex h-full min-h-56 w-full flex-col items-center rounded-xl border border-outline-variant bg-surface-container-lowest text-center shadow-soft-sm transition-colors hover:border-primary hover:bg-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    )
  }

  return (
    <CardButton type="button" className={className}>
      {content}
    </CardButton>
  )
}

function AudienceRow({
  name,
  meta,
  selected,
  student,
}: {
  name: string
  meta: string
  selected: boolean
  student?: ClassDetailStudent
}) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-3 ${selected ? 'border-primary bg-primary-soft' : 'border-outline-variant bg-surface-container-lowest'}`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-md text-sm font-bold ${selected ? 'bg-primary text-on-primary' : 'bg-surface-container text-primary'}`} aria-hidden>
        {student ? initials(student.fullName) : <Icon name="BookOpen" size="sm" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-on-surface">{name}</p>
        <p className="truncate text-xs text-on-surface-variant">{meta}</p>
      </div>
      {selected ? (
        <Icon name="CheckCircle" size="sm" className="text-primary" aria-label={`${name} selected`} />
      ) : (
        <Icon name="PlusCircle" size="sm" className="text-on-surface-variant" aria-label={`Select ${name}`} />
      )}
    </div>
  )
}

function initials(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('ro-RO') ?? '')
    .join('') || 'CL'
}
