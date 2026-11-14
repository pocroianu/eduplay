import Link from 'next/link'
import { TextareaField, TextField } from '@/shared/components/ui/kit'
import { notFound, redirect } from 'next/navigation'
import {
  getClassDetailData,
  type ClassDetailData,
  type ClassDetailStudent,
} from '@/features/teacher-dashboard/server'
import { ROUTES } from '@/shared/lib/constants'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import type { Language } from '@/lib/i18n/config'
import { getServerLanguage, getServerTranslation, preloadNamespaces } from '@/lib/i18n/server'
import { Icon } from '@/shared/components/ui/Icon'
import { Button, Card, Pill } from '@/shared/components/ui/kit'

type AddStudentsData = ClassDetailData

type AddStudentsCopy = {
  back: string
  headingEyebrow: string
  heading: string
  description: string
  classActive: string
  classArchived: string
  createReal: string
  addStudentsTitle: string
  addStudentsDescription: string
  pasteTitle: string
  pasteDescription: string
  manualTitle: string
  preview: string
  moreLater: string
  studentsTitle: string
  studentsDescription: string
  noStudents: string
  familiesTitle: string
  familiesDescription: string
  classCode: string
  classCodeDescription: string
  deviceShared: string
  deviceSharedDescription: string
  home: string
  homeDescription: string
  existingAccount: string
  existingAccountDescription: string
  classSummary: string
  classSettings: string
  addPeopleTitle: string
}

async function t(lang: Language, key: string) {
  return getServerTranslation(lang, 'teacher', key)
}

async function getCopy(lang: Language): Promise<AddStudentsCopy> {
  const [
    back,
    headingEyebrow,
    heading,
    description,
    classActive,
    classArchived,
    createReal,
    addStudentsTitle,
    addStudentsDescription,
    pasteTitle,
    pasteDescription,
    manualTitle,
    preview,
    moreLater,
    studentsTitle,
    studentsDescription,
    noStudents,
    familiesTitle,
    familiesDescription,
    classCode,
    classCodeDescription,
    deviceShared,
    deviceSharedDescription,
    home,
    homeDescription,
    existingAccount,
    existingAccountDescription,
    classSummary,
    classSettings,
    addPeopleTitle,
  ] = await Promise.all([
    t(lang, 'students.add.back'),
    t(lang, 'students.add.headingEyebrow'),
    t(lang, 'students.add.heading'),
    t(lang, 'students.add.description'),
    t(lang, 'students.add.classActive'),
    t(lang, 'students.add.classArchived'),
    t(lang, 'students.add.createReal'),
    t(lang, 'students.add.addStudentsTitle'),
    t(lang, 'students.add.addStudentsDescription'),
    t(lang, 'students.add.pasteTitle'),
    t(lang, 'students.add.pasteDescription'),
    t(lang, 'students.add.manualTitle'),
    t(lang, 'students.add.preview'),
    t(lang, 'students.add.moreLater'),
    t(lang, 'students.add.studentsTitle'),
    t(lang, 'students.add.studentsDescription'),
    t(lang, 'students.add.noStudents'),
    t(lang, 'students.add.familiesTitle'),
    t(lang, 'students.add.familiesDescription'),
    t(lang, 'students.add.classCode'),
    t(lang, 'students.add.classCodeDescription'),
    t(lang, 'students.add.deviceShared'),
    t(lang, 'students.add.deviceSharedDescription'),
    t(lang, 'students.add.home'),
    t(lang, 'students.add.homeDescription'),
    t(lang, 'students.add.existingAccount'),
    t(lang, 'students.add.existingAccountDescription'),
    t(lang, 'students.add.classSummary'),
    t(lang, 'students.add.classSettings'),
    t(lang, 'students.add.addPeopleTitle'),
  ])

  return {
    back,
    headingEyebrow,
    heading,
    description,
    classActive,
    classArchived,
    createReal,
    addStudentsTitle,
    addStudentsDescription,
    pasteTitle,
    pasteDescription,
    manualTitle,
    preview,
    moreLater,
    studentsTitle,
    studentsDescription,
    noStudents,
    familiesTitle,
    familiesDescription,
    classCode,
    classCodeDescription,
    deviceShared,
    deviceSharedDescription,
    home,
    homeDescription,
    existingAccount,
    existingAccountDescription,
    classSummary,
    classSettings,
    addPeopleTitle,
  }
}

const manualRows = ['Numele elevului', 'Numele elevului', 'Numele elevului', 'Numele elevului'] as const
const pastedNames = ['Andrei Popescu', 'Ioana Marin', 'Mihai Stan', 'Elena Dumitru'] as const

export default async function NewClassStudentPage({
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
      <AddStudentsContent data={data} copy={copy} />
    </I18nProvider>
  )
}

function AddStudentsContent({ data, copy }: { data: AddStudentsData; copy: AddStudentsCopy }) {
  const { classData, stats, studentRoster } = data
  const existingStudents = studentRoster.slice(0, 6)
  const classCode = buildClassCode(classData.id)
  const realCreationHref = `${ROUTES.TEACHER.STUDENT_NEW}?classId=${encodeURIComponent(classData.id)}`

  return (
    <div className="min-h-screen bg-surface-container text-on-surface">
      <header className="border-b border-outline-variant bg-surface-container-lowest">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 py-5 lg:px-10">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-on-surface-variant">
            <Link
              href={ROUTES.TEACHER.CLASS(classData.id)}
              className="inline-flex items-center gap-2 rounded-sm font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Icon name="ArrowLeft" size="sm" aria-hidden />
              {copy.back}
            </Link>
          </nav>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-on-primary" aria-hidden>
              <Icon name="UserPlus" size="xl" weight="bold" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold uppercase tracking-wide text-on-surface-variant">{copy.headingEyebrow}</p>
              <h1 className="font-headline text-2xl font-bold text-on-surface md:text-3xl">{copy.heading}</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-on-surface-variant">{copy.description}</p>
            </div>
            <Pill tone={classData.is_active ? 'lime' : 'cream'}>
              {classData.is_active ? copy.classActive : copy.classArchived}
            </Pill>
            <Button mode="standard" href={realCreationHref}>
              <Icon name="UserPlus" size="sm" aria-hidden />
              {copy.createReal}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-6 lg:px-10 xl:grid-cols-12">
        <section aria-labelledby="add-students-title" className="space-y-6 xl:col-span-8">
          <Card padding="none" shadow={false} className="overflow-hidden border border-outline-variant">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant px-5 py-4">
              <div>
                <h2 id="add-students-title" className="text-lg font-bold text-on-surface">{copy.addStudentsTitle}</h2>
                <p className="mt-1 text-sm text-on-surface-variant">{copy.addStudentsDescription}</p>
              </div>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-5">
              <div className="space-y-4 lg:col-span-3">
                <div className="rounded-lg border border-outline-variant bg-surface-container p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary" aria-hidden>
                      <Icon name="TextAa" size="lg" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-on-surface">{copy.pasteTitle}</h3>
                      <p className="mt-1 text-sm leading-6 text-on-surface-variant">{copy.pasteDescription}</p>
                    </div>
                  </div>
                  <TextareaField
                    id="student-name-list-preview"
                    label={copy.pasteTitle}
                    rows={7}
                    defaultValue={pastedNames.join('\n')}
                    placeholder="Lipește câte un nume pe linie"
                    className="mt-4"
                  />
                </div>

                <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-bold text-on-surface">{copy.addPeopleTitle}</h3>
                    <Pill tone="cream">{copy.preview}</Pill>
                  </div>
                  <div className="space-y-3">
                    {manualRows.map((placeholder, index) => (
                      <TextField
                        key={index}
                        label={`${placeholder} ${index + 1}`}
                        defaultValue={index === 0 ? '' : pastedNames[index - 1] ?? ''}
                        placeholder={placeholder}
                      />
                    ))}
                  </div>
                  <p className="mt-3 text-center text-sm text-primary">{copy.moreLater}</p>
                </div>
              </div>

              <aside className="space-y-4 lg:col-span-2">
                <Card shadow={false} className="border border-outline-variant bg-primary-soft">
                  <div className="flex gap-3">
                    <Icon name="Info" size="lg" className="text-primary" aria-hidden />
                    <div>
                      <h3 className="font-bold text-on-surface">{copy.studentsTitle}</h3>
                      <p className="mt-1 text-sm leading-6 text-on-surface-variant">{copy.studentsDescription}</p>
                    </div>
                  </div>
                </Card>
                <Card shadow={false} className="border border-outline-variant">
                  <div className="flex gap-3">
                    <Icon name="HandHeart" size="lg" className="text-primary" aria-hidden />
                    <div>
                      <h3 className="font-bold text-on-surface">{copy.familiesTitle}</h3>
                      <p className="mt-1 text-sm leading-6 text-on-surface-variant">{copy.familiesDescription}</p>
                    </div>
                  </div>
                </Card>
              </aside>
            </div>
          </Card>

          <Card padding="none" shadow={false} className="overflow-hidden border border-outline-variant">
            <div className="border-b border-outline-variant px-5 py-4">
              <h2 className="text-lg font-bold text-on-surface">{copy.studentsTitle}</h2>
              <p className="mt-1 text-sm text-on-surface-variant">{copy.studentsDescription}</p>
            </div>
            <div className="divide-y divide-outline-variant">
              {existingStudents.length > 0 ? (
                existingStudents.map((student) => <RosterRow key={student.id} student={student} />)
              ) : (
                <div className="px-5 py-8 text-center text-sm text-on-surface-variant">{copy.noStudents}</div>
              )}
            </div>
          </Card>
        </section>

        <aside className="space-y-6 xl:col-span-4">
          <Card padding="none" shadow={false} className="overflow-hidden border border-outline-variant">
            <div className="border-b border-outline-variant px-5 py-4">
              <h2 className="text-lg font-bold text-on-surface">{copy.familiesTitle}</h2>
              <p className="mt-1 text-sm text-on-surface-variant">{copy.familiesDescription}</p>
            </div>
            <div className="space-y-4 p-5">
              <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{copy.classCode}</p>
                <p className="mt-2 font-headline text-3xl font-bold tracking-wide text-on-surface">{classCode}</p>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">{copy.classCodeDescription}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Button mode="standard" variant="secondary" href={ROUTES.TEACHER.SCAN} className="justify-center">
                    <Icon name="Camera" size="sm" aria-hidden />
                    Scanează codul
                  </Button>
                  <Button mode="standard" variant="secondary" href={ROUTES.TEACHER.CLASS_SETTINGS(classData.id)} className="justify-center">
                    <Icon name="Key" size="sm" aria-hidden />
                    Vezi codul clasei
                  </Button>
                </div>
              </div>
              <div className="grid gap-3">
                <SignInStep icon="HardDrives" title={copy.deviceShared} text={copy.deviceSharedDescription} />
                <SignInStep icon="House" title={copy.home} text={copy.homeDescription} />
                <SignInStep icon="Key" title={copy.existingAccount} text={copy.existingAccountDescription} />
              </div>
            </div>
          </Card>

          <Card shadow={false} className="border border-outline-variant">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-container text-primary" aria-hidden>
                <Icon name="Users" size="lg" />
              </span>
              <div>
                <h2 className="font-bold text-on-surface">{copy.classSummary}</h2>
                <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                  {stats.totalStudents} elevi · {stats.activeStudents} activi recent.
                </p>
                <Button mode="standard" variant="secondary" href={ROUTES.TEACHER.CLASS_SETTINGS(classData.id)} className="mt-4">
                  <Icon name="SlidersHorizontal" size="sm" aria-hidden />
                  {copy.classSettings}
                </Button>
              </div>
            </div>
          </Card>
          <Card shadow={false} className="border border-outline-variant bg-surface-container-lowest">
            <div className="grid gap-3 sm:grid-cols-2">
              <Button mode="standard" type="button" disabled fullWidth className="justify-center">
                <Icon name="UserPlus" size="sm" aria-hidden />
                Adaugă elevii — conectare indisponibilă
              </Button>
              <Button mode="standard" variant="secondary" href={ROUTES.TEACHER.CLASS_FAMILIES(classData.id)} fullWidth className="justify-center">
                <Icon name="HandHeart" size="sm" aria-hidden />
                Invită familiile
              </Button>
            </div>
          </Card>
        </aside>
      </main>
    </div>
  )
}

function RosterRow({ student }: { student: ClassDetailStudent }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-sm font-bold text-primary-deep" aria-hidden>
        {initials(student.fullName)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-on-surface">{student.fullName}</p>
        <p className="truncate text-xs text-on-surface-variant">{student.username}</p>
      </div>
      <Pill tone={student.status === 'online' ? 'lime' : student.status === 'needs_help' ? 'sun' : 'cream'}>
        {student.status === 'online' ? 'Activ' : student.status === 'needs_help' ? 'Necesită ajutor' : 'Inactiv'}
      </Pill>
    </div>
  )
}

function SignInStep({ icon, title, text }: { icon: 'HardDrives' | 'House' | 'Key'; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-container text-primary" aria-hidden>
        <Icon name={icon} size="md" />
      </span>
      <div>
        <h3 className="text-sm font-bold text-on-surface">{title}</h3>
        <p className="mt-1 text-sm leading-5 text-on-surface-variant">{text}</p>
      </div>
    </div>
  )
}

function buildClassCode(classId: string) {
  return classId.replace(/[^a-z0-9]/gi, '').slice(0, 6).toLocaleUpperCase('ro-RO') || 'CLASA'
}

function initials(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('ro-RO') ?? '')
    .join('') || 'ST'
}
