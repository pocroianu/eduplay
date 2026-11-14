import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import type { Language } from '@/lib/i18n/config'
import { getServerLanguage, getServerTranslation } from '@/lib/i18n/server'
import { createClient } from '@/lib/supabase/server'
import { Button, Card, Pill } from '@/shared/components/ui/kit'
import { Icon, type IconProps } from '@/shared/components/ui/Icon'
import { ROUTES } from '@/shared/lib/constants'

type Mode = {
  icon: IconProps['name']
  title: string
  description: string
}

type GenerateCopy = {
  back: string
  heading: string
  aiBadge: string
  trialNotice: string
  startTrial: string
  modes: Mode[]
  instructions: string
  outputTypes: string[]
  uploadHint: string
  upload: string
  googleDrive: string
  next: string
}

async function t(lang: Language, key: string) {
  return getServerTranslation(lang, 'teacher', key)
}

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLanguage()
  return {
    title: await t(lang, 'generateActivity.metadataTitle'),
  }
}

async function getCopy(lang: Language): Promise<GenerateCopy> {
  const [
    back,
    heading,
    aiBadge,
    trialNotice,
    startTrial,
    convertTitle,
    convertDescription,
    topicTitle,
    topicDescription,
    youtubeTitle,
    youtubeDescription,
    fluencyTitle,
    fluencyDescription,
    instructions,
    worksheet,
    quiz,
    studyGuide,
    activity,
    uploadHint,
    upload,
    googleDrive,
    next,
  ] = await Promise.all([
    t(lang, 'generateActivity.back'),
    t(lang, 'generateActivity.heading'),
    t(lang, 'generateActivity.aiBadge'),
    t(lang, 'generateActivity.trialNotice'),
    t(lang, 'generateActivity.startTrial'),
    t(lang, 'generateActivity.convert.title'),
    t(lang, 'generateActivity.convert.description'),
    t(lang, 'generateActivity.topic.title'),
    t(lang, 'generateActivity.topic.description'),
    t(lang, 'generateActivity.youtube.title'),
    t(lang, 'generateActivity.youtube.description'),
    t(lang, 'generateActivity.fluency.title'),
    t(lang, 'generateActivity.fluency.description'),
    t(lang, 'generateActivity.instructions'),
    t(lang, 'generateActivity.worksheet'),
    t(lang, 'generateActivity.quiz'),
    t(lang, 'generateActivity.studyGuide'),
    t(lang, 'generateActivity.activity'),
    t(lang, 'generateActivity.uploadHint'),
    t(lang, 'generateActivity.upload'),
    t(lang, 'generateActivity.googleDrive'),
    t(lang, 'generateActivity.next'),
  ])

  return {
    back,
    heading,
    aiBadge,
    trialNotice,
    startTrial,
    modes: [
      { icon: 'ClipboardText', title: convertTitle, description: convertDescription },
      { icon: 'Lightbulb', title: topicTitle, description: topicDescription },
      { icon: 'PlayCircle', title: youtubeTitle, description: youtubeDescription },
      { icon: 'Microphone', title: fluencyTitle, description: fluencyDescription },
    ],
    instructions,
    outputTypes: [worksheet, quiz, studyGuide, activity],
    uploadHint,
    upload,
    googleDrive,
    next,
  }
}

async function requireTeacher() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(ROUTES.AUTH.LOGIN)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'teacher') {
    redirect(ROUTES.AUTH.LOGIN)
  }
}

function ModeCard({ active, mode }: { active?: boolean; mode: Mode }) {
  return (
    <button
      type="button"
      disabled
      aria-pressed={active}
      className={
        active
          ? 'min-h-32 rounded-lg border border-primary bg-surface-container-lowest p-5 text-left'
          : 'min-h-32 rounded-lg border border-outline-variant bg-surface-container-lowest p-5 text-left opacity-80'
      }
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-soft text-primary-deep">
        <Icon name={mode.icon} size="lg" aria-hidden />
      </span>
      <span className="mt-4 block text-base font-bold text-on-surface">{mode.title}</span>
      <span className="mt-2 block text-sm font-semibold leading-6 text-on-surface-variant">{mode.description}</span>
    </button>
  )
}

export default async function GenerateActivityPage() {
  await requireTeacher()
  const copy = await getCopy(await getServerLanguage())

  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <header className="border-b border-outline-variant bg-surface-container-lowest">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 lg:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={ROUTES.TEACHER.ACTIVITY_CREATE}
              aria-label={copy.back}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors hover:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <Icon name="ArrowLeft" size="lg" aria-hidden />
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-headline text-2xl font-bold text-on-surface">{copy.heading}</h1>
                <Pill tone="sun">{copy.aiBadge}</Pill>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="border-b border-outline-variant bg-primary-soft">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-4 text-sm font-semibold leading-6 text-primary-deep sm:flex-row sm:items-center lg:px-7">
          <Icon name="RocketLaunch" size="lg" aria-hidden />
          <p className="flex-1">{copy.trialNotice}</p>
          <Button href={ROUTES.TEACHER.TRIAL} size="sm">
            {copy.startTrial}
          </Button>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-6 lg:px-7">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label={copy.heading}>
          {copy.modes.map((mode, index) => (
            <ModeCard key={mode.title} active={index === 0} mode={mode} />
          ))}
        </section>

        <Card className="overflow-hidden border border-outline-variant bg-surface-container-lowest" padding="none" shadow={false}>
          <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div>
              <p className="max-w-3xl text-base font-semibold leading-7 text-on-surface">{copy.instructions}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {copy.outputTypes.map((label) => (
                  <button
                    key={label}
                    type="button"
                    disabled
                    className="rounded-lg border border-outline-variant bg-surface px-4 py-4 text-center text-sm font-bold text-on-surface disabled:cursor-not-allowed disabled:opacity-100"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-dashed border-outline-variant bg-surface p-5 text-center">
              <p className="text-sm font-semibold leading-6 text-on-surface-variant">{copy.uploadHint}</p>
              <div className="mt-5 flex flex-col gap-3">
                <Button type="button" disabled aria-disabled="true">
                  <Icon name="ArrowUp" size="sm" aria-hidden />
                  {copy.upload}
                </Button>
                <Button type="button" variant="secondary" disabled aria-disabled="true">
                  <Icon name="HardDrives" size="sm" aria-hidden />
                  {copy.googleDrive}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="button" disabled aria-disabled="true">
            {copy.next}
          </Button>
        </div>
      </div>
    </main>
  )
}
