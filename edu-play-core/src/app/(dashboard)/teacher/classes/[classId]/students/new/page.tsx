import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  getClassDetailData,
  type ClassDetailData,
  type ClassDetailStudent,
  type StudentStatus,
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
  studentsTitle: string
  studentsDescription: string
  noStudents: string
  familiesTitle: string
  familiesDescription: string
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
    studentsTitle,
    studentsDescription,
    noStudents,
    familiesTitle,
    familiesDescription,
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
    t(lang, 'students.add.studentsTitle'),
    t(lang, 'students.add.studentsDescription'),
    t(lang, 'students.add.noStudents'),
    t(lang, 'students.add.familiesTitle'),
    t(lang, 'students.add.familiesDescription'),
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
    studentsTitle,
    studentsDescription,
    noStudents,
    familiesTitle,
    familiesDescription,
    existingAccount,
    existingAccountDescription,
    classSummary,
    classSettings,
    addPeopleTitle,
  }
}

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
            <div className="min-w-[10rem] flex-1">
              <p className="text-sm font-semibold uppercase tracking-wide text-on-surface-variant">{copy.headingEyebrow}</p>
              <h1 className="font-headline text-2xl font-bold text-on-surface md:text-3xl">{copy.heading}</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-on-surface-variant">{copy.description}</p>
            </div>
            <Pill tone={classData.is_active ? 'lime' : 'cream'}>
              {classData.is_active ? copy.classActive : copy.classArchived}
            </Pill>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-6 py-6 lg:px-10 xl:grid-cols-12">
        <section aria-labelledby="add-students-title" className="space-y-6 xl:col-span-8">
          <Card padding="none" shadow={false} className="overflow-hidden border border-outline-variant">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant px-5 py-4">
              <div>
                <h2 id="add-students-title" className="text-lg font-bold text-on-surface">{copy.addStudentsTitle}</h2>
                <p className="mt-1 text-sm text-on-surface-variant">{copy.addStudentsDescription}</p>
              </div>
            </div>

            <div className="p-5">
              <div className="space-y-4">
                <div className="rounded-lg border border-outline-variant bg-surface-container p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary" aria-hidden>
                      <Icon name="UserPlus" size="lg" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-on-surface">{copy.addPeopleTitle}</h3>
                    </div>
                  </div>
                  <Button mode="standard" href={realCreationHref} className="mt-4 w-full whitespace-nowrap sm:w-auto">
                    <Icon name="UserPlus" size="sm" aria-hidden />
                    {copy.createReal}
                  </Button>
                </div>
              </div>
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
              <div className="grid gap-3">
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
            <div className="grid gap-3">
              <Button mode="standard" variant="secondary" href={ROUTES.TEACHER.CLASS_FAMILIES(classData.id)} fullWidth className="justify-center">
                <Icon name="HandHeart" size="sm" aria-hidden />
                Invită familiile
              </Button>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  )
}

const STATUS_TONE: Record<StudentStatus, 'lime' | 'sun' | 'cream'> = { online: 'lime', needs_help: 'sun', offline: 'cream' }
const STATUS_LABEL: Record<StudentStatus, string> = { online: 'Activ', needs_help: 'Necesită ajutor', offline: 'Inactiv' }

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
      <Pill tone={STATUS_TONE[student.status]}>{STATUS_LABEL[student.status]}</Pill>
    </div>
  )
}

function SignInStep({ icon, title, text }: { icon: 'Key'; title: string; text: string }) {
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

function initials(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('ro-RO') ?? '')
    .join('') || 'ST'
}
