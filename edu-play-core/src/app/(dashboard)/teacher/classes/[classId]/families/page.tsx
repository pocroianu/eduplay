import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getClassDetailData, type ClassDetailData, type ClassDetailStudent } from '@/features/teacher-dashboard/server'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import type { Language } from '@/lib/i18n/config'
import { getServerLanguage, getServerTranslation, preloadNamespaces } from '@/lib/i18n/server'
import { Icon } from '@/shared/components/ui/Icon'
import { Button, Card, Pill } from '@/shared/components/ui/kit'
import { ROUTES } from '@/shared/lib/constants'

type FamiliesPageData = ClassDetailData

type FamiliesCopy = {
  back: string
  heading: string
  loading: string
  connectTitle: string
  benefit1: string
  benefit2: string
  benefit3: string
  benefit4: string
  turnOn: string
  learnMore: string
  students: string
  infoTitle: string
  infoDescription: string
  statusTitle: string
  statusDescription: string
  statusPill: string
  emptyStudents: string
}

async function t(lang: Language, key: string) {
  return getServerTranslation(lang, 'teacher', key)
}

async function getCopy(lang: Language): Promise<FamiliesCopy> {
  const [
    back,
    heading,
    loading,
    connectTitle,
    benefit1,
    benefit2,
    benefit3,
    benefit4,
    turnOn,
    learnMore,
    students,
    infoTitle,
    infoDescription,
    statusTitle,
    statusDescription,
    statusPill,
    emptyStudents,
  ] = await Promise.all([
    t(lang, 'families.back'),
    t(lang, 'families.heading'),
    t(lang, 'families.loading'),
    t(lang, 'families.connectTitle'),
    t(lang, 'families.benefit1'),
    t(lang, 'families.benefit2'),
    t(lang, 'families.benefit3'),
    t(lang, 'families.benefit4'),
    t(lang, 'families.turnOn'),
    t(lang, 'families.learnMore'),
    t(lang, 'families.students'),
    t(lang, 'families.infoTitle'),
    t(lang, 'families.infoDescription'),
    t(lang, 'families.statusTitle'),
    t(lang, 'families.statusDescription'),
    t(lang, 'families.statusPill'),
    t(lang, 'families.emptyStudents'),
  ])

  return {
    back,
    heading,
    loading,
    connectTitle,
    benefit1,
    benefit2,
    benefit3,
    benefit4,
    turnOn,
    learnMore,
    students,
    infoTitle,
    infoDescription,
    statusTitle,
    statusDescription,
    statusPill,
    emptyStudents,
  }
}

export default async function ClassFamiliesPage({
  params,
}: {
  params: Promise<{ classId: string }>
}) {
  const { classId } = await params
  const data = await getClassDetailData(classId)

  if (!data) {
    redirect(ROUTES.AUTH.LOGIN)
  }

  if (data === 'not-found') {
    notFound()
  }

  const lang = await getServerLanguage()
  const resources = await preloadNamespaces(lang, ['teacher'])
  const copy = await getCopy(lang)

  return (
    <I18nProvider lang={lang} resources={resources}>
      <ClassFamiliesContent data={data} copy={copy} />
    </I18nProvider>
  )
}

function ClassFamiliesContent({ data, copy }: { data: FamiliesPageData; copy: FamiliesCopy }) {
  const { classData, studentRoster } = data

  return (
    <div className="min-h-screen bg-surface-container text-on-surface">
      <header className="border-b border-outline-variant bg-surface-container-lowest">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-6 py-5 lg:px-10">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-on-surface-variant">
            <Link
              href={ROUTES.TEACHER.CLASS_SETTINGS(classData.id)}
              className="inline-flex items-center gap-2 rounded-sm font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Icon name="ArrowLeft" size="sm" aria-hidden />
              {copy.back}
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-on-primary" aria-hidden>
              <Icon name="HandHeart" size="xl" weight="bold" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-headline text-2xl font-bold text-on-surface md:text-3xl">{copy.heading}</h1>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">{copy.loading}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1180px] gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-10">
        <div className="space-y-6">
          <Card padding="lg" shadow={false} className="border border-outline-variant">
            <div className="flex flex-col gap-5 md:flex-row md:items-start">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary" aria-hidden>
                <Icon name="HandHeart" size="xl" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-headline text-2xl font-bold text-on-surface">{copy.connectTitle}</h2>
                <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                  {[copy.benefit1, copy.benefit2, copy.benefit3, copy.benefit4].map((benefit) => (
                    <li key={benefit} className="flex gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-sm leading-6 text-on-surface">
                      <Icon name="CheckCircle" size="md" className="mt-0.5 shrink-0 text-primary" aria-hidden />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-outline-variant pt-5">
              <Button mode="standard" type="button" disabled>
                {copy.turnOn}
              </Button>
            </div>
          </Card>

          <Card padding="none" shadow={false} className="overflow-hidden border border-outline-variant">
            <div className="border-b border-outline-variant px-5 py-4">
              <h2 className="text-lg font-bold text-on-surface">{copy.students}</h2>
            </div>
            <div className="divide-y divide-outline-variant">
              {studentRoster.length > 0 ? (
                studentRoster.map((student) => (
                  <StudentFamilyRow key={student.id} student={student} copy={copy} />
                ))
              ) : (
                <p className="p-4 text-sm text-on-surface-variant">{copy.emptyStudents}</p>
              )}
            </div>
          </Card>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <Card shadow={false} className="border border-outline-variant bg-primary-soft">
            <div className="flex gap-3">
              <Icon name="Info" size="lg" className="text-primary" aria-hidden />
              <div>
                <h2 className="font-headline text-lg font-bold text-on-surface">{copy.infoTitle}</h2>
                <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                  {copy.infoDescription}
                </p>
              </div>
            </div>
          </Card>
        </aside>
      </main>
    </div>
  )
}

function StudentFamilyRow({ student, copy }: { student: ClassDetailStudent; copy: FamiliesCopy }) {
  return (
    <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_260px] md:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <StudentAvatar student={student} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-on-surface">{student.fullName}</p>
          <p className="truncate text-xs text-on-surface-variant">@{student.username}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
        <div className="text-sm">
          <p className="font-semibold text-on-surface">{copy.statusTitle}</p>
          <p className="text-xs text-on-surface-variant">{copy.statusDescription}</p>
        </div>
        <Pill tone="cream">{copy.statusPill}</Pill>
      </div>
    </div>
  )
}

function StudentAvatar({ student }: { student: ClassDetailStudent }) {
  if (student.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={student.avatarUrl}
        alt=""
        className="h-10 w-10 rounded-full border border-outline-variant object-cover"
      />
    )
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-deep" aria-hidden>
      {initials(student.fullName)}
    </div>
  )
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return 'CL'
  const first = parts[0]?.[0] ?? ''
  const second = parts.length > 1 ? parts[1]?.[0] ?? '' : parts[0]?.[1] ?? ''
  return `${first}${second}`.toLocaleUpperCase('ro-RO')
}
