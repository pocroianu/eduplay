import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getClassDetailData, type ClassDetailData, type ClassDetailStudent, type StudentStatus } from '@/features/teacher-dashboard/server'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import type { Language } from '@/lib/i18n/config'
import { getServerLanguage, getServerTranslation, preloadNamespaces } from '@/lib/i18n/server'
import { Icon } from '@/shared/components/ui/Icon'
import type { IconName } from '@/shared/components/ui/Icon.registry'
import { Button, Card, Pill } from '@/shared/components/ui/kit'
import { ROUTES } from '@/shared/lib/constants'

const sectionDefinitions = [
  { slug: 'class-info', icon: 'BookOpen' as const },
  { slug: 'manage-students', icon: 'Users' as const },
  { slug: 'manage-teachers', icon: 'GraduationCap' as const },
  { slug: 'student-sign-in-mode', icon: 'Key' as const },
] as const

type SectionSlug = (typeof sectionDefinitions)[number]['slug']
type SectionDefinition = (typeof sectionDefinitions)[number]
type SectionText = { title: string; eyebrow: string; description: string }
type ResolvedSection = SectionDefinition & SectionText
type SettingsSectionData = ClassDetailData
const bodyKeys = [
  'className', 'schoolYear', 'level', 'students', 'status', 'notSet', 'active', 'archived',
  'editNotConnectedTitle', 'editNotConnectedDescription', 'manageStudentsIntro', 'addStudent',
  'noStudentsTitle', 'noStudentsDescription', 'studentActive', 'studentNeedsHelp', 'studentInactive',
  'teachersIntro', 'teachersInviteUnavailable', 'currentTeachers', 'teacherRole', 'you', 'signInNote',
  'signInPinTitle', 'signInPinDescription',
] as const
type BodyKey = (typeof bodyKeys)[number]
type SettingsSectionCopy = {
  back: string
  breadcrumbAria: string
  classActive: string
  classArchived: string
  close: string
  navTitle: string
  navDescription: string
  navAria: string
  sections: Record<SectionSlug, SectionText>
  body: Record<BodyKey, string>
}

async function t(lang: Language, key: string) {
  return getServerTranslation(lang, 'teacher', key)
}

async function getSettingsSectionCopy(lang: Language): Promise<SettingsSectionCopy> {
  const [back, breadcrumbAria, classActive, classArchived, close, navTitle, navDescription, navAria] = await Promise.all([
    t(lang, 'settingsSection.back'),
    t(lang, 'settingsSection.breadcrumbAria'),
    t(lang, 'settingsSection.classActive'),
    t(lang, 'settingsSection.classArchived'),
    t(lang, 'settingsSection.close'),
    t(lang, 'settingsSection.navTitle'),
    t(lang, 'settingsSection.navDescription'),
    t(lang, 'settingsSection.navAria'),
  ])

  const sectionEntries = await Promise.all(
    sectionDefinitions.map(async ({ slug }) => {
      const [title, eyebrow, description] = await Promise.all([
        t(lang, `settingsSection.sections.${slug}.title`),
        t(lang, `settingsSection.sections.${slug}.eyebrow`),
        t(lang, `settingsSection.sections.${slug}.description`),
      ])
      return [slug, { title, eyebrow, description }] as const
    }),
  )
  const bodyEntries = await Promise.all(
    bodyKeys.map(async (key) => [key, await t(lang, `settingsSection.body.${key}`)] as const),
  )

  return {
    back,
    breadcrumbAria,
    classActive,
    classArchived,
    close,
    navTitle,
    navDescription,
    navAria,
    sections: Object.fromEntries(sectionEntries) as Record<SectionSlug, SectionText>,
    body: Object.fromEntries(bodyEntries) as Record<BodyKey, string>,
  }
}

const sectionBySlug = new Map<string, SectionDefinition>(
  sectionDefinitions.map((section) => [section.slug, section] as const),
)

export default async function ClassSettingsSectionPage({
  params,
}: {
  params: Promise<{ classId: string; section?: string }>
}) {
  const { classId, section } = await params
  const data = await getClassDetailData(classId)

  if (!data) {
    redirect(ROUTES.AUTH.LOGIN)
  }

  if (data === 'not-found') {
    notFound()
  }

  const definition = section ? sectionBySlug.get(section) : null

  if (!definition) {
    notFound()
  }

  const lang = await getServerLanguage()
  const resources = await preloadNamespaces(lang, ['teacher'])
  const copy = await getSettingsSectionCopy(lang)

  return (
    <I18nProvider lang={lang} resources={resources}>
      <ClassSettingsSectionContent
        data={data}
        section={{ ...definition, ...copy.sections[definition.slug] }}
        copy={copy}
      />
    </I18nProvider>
  )
}

function ClassSettingsSectionContent({
  data,
  section,
  copy,
}: {
  data: SettingsSectionData
  section: ResolvedSection
  copy: SettingsSectionCopy
}) {
  const { classData } = data

  return (
    <div className="min-h-screen bg-surface-container text-on-surface">
      <header className="border-b border-outline-variant bg-surface-container-lowest">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-6 py-5 lg:px-10">
          <nav aria-label={copy.breadcrumbAria} className="flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
            <Link
              href={ROUTES.TEACHER.CLASS_SETTINGS(classData.id)}
              className="inline-flex items-center gap-2 rounded-sm font-semibold text-primary hover:underline focus-ring"
            >
              <Icon name="ArrowLeft" size="sm" aria-hidden />
              {copy.back}
            </Link>
            <Icon name="CaretRight" size="xs" className="text-outline" aria-hidden />
            <span className="truncate">{section.title}</span>
          </nav>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-soft text-primary" aria-hidden>
              <Icon name={section.icon} size="lg" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold uppercase tracking-wide text-on-surface-variant">{section.eyebrow}</p>
              <h1 className="font-headline text-2xl font-bold text-on-surface md:text-3xl">{section.title}</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-on-surface-variant">{section.description}</p>
            </div>
            <Pill tone={classData.is_active ? 'lime' : 'cream'}>
              {classData.is_active ? copy.classActive : copy.classArchived}
            </Pill>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1280px] gap-6 px-6 py-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-10">
        <SettingsNavigation classId={classData.id} activeSlug={section.slug} copy={copy} />
        <section aria-labelledby="settings-section-title" className="min-w-0">
          <Card padding="none" shadow={false} className="overflow-hidden border border-outline-variant">
            <div className="flex items-center justify-between gap-3 border-b border-outline-variant bg-surface-container-lowest px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{classData.name}</p>
                <h2 id="settings-section-title" className="font-headline text-xl font-bold text-on-surface">
                  {section.title}
                </h2>
              </div>
              <Link
                href={ROUTES.TEACHER.CLASS_SETTINGS(classData.id)}
                aria-label={copy.close}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container focus-ring"
              >
                <Icon name="X" size="md" aria-hidden />
              </Link>
            </div>
            <div className="bg-surface-container p-4 md:p-6">
              <div className="mx-auto max-w-3xl">
                {renderSection(section.slug, data, copy.body)}
              </div>
            </div>
          </Card>
        </section>
      </div>
    </div>
  )
}

function SettingsNavigation({ classId, activeSlug, copy }: { classId: string; activeSlug: SectionSlug; copy: SettingsSectionCopy }) {
  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <Card padding="none" shadow={false} className="overflow-hidden border border-outline-variant">
        <div className="border-b border-outline-variant px-4 py-3">
          <h2 className="text-sm font-bold text-on-surface">{copy.navTitle}</h2>
          <p className="text-xs text-on-surface-variant">{copy.navDescription}</p>
        </div>
        <nav aria-label={copy.navAria} className="flex flex-col p-2">
          {sectionDefinitions.map((item) => {
            const active = item.slug === activeSlug
            return (
              <Link
                key={item.slug}
                href={ROUTES.TEACHER.CLASS_SETTING_SECTION(classId, item.slug)}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold focus-ring ${
                  active
                    ? 'bg-primary-soft text-primary-deep'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <Icon name={item.icon} size="sm" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{copy.sections[item.slug].title}</span>
              </Link>
            )
          })}
        </nav>
      </Card>
    </aside>
  )
}

function renderSection(slug: SectionSlug, data: SettingsSectionData, body: Record<BodyKey, string>) {
  switch (slug) {
    case 'class-info':
      return <ClassInfoSection data={data} body={body} />
    case 'manage-students':
      return <ManageStudentsSection data={data} body={body} />
    case 'manage-teachers':
      return <ManageTeachersSection data={data} body={body} />
    case 'student-sign-in-mode':
      return <StudentSignInModeSection body={body} />
  }
}

function ClassInfoSection({ data, body }: { data: SettingsSectionData; body: Record<BodyKey, string> }) {
  const { classData, stats } = data

  return (
    <PanelStack>
      <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4">
        <p className="text-sm font-bold text-on-surface">{body.className}</p>
        <p className="mt-1 text-lg font-bold text-primary-deep">{classData.name}</p>
        {classData.description ? (
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">{classData.description}</p>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ReadonlySetting label={body.schoolYear} value={classData.school_year ?? body.notSet} />
        <ReadonlySetting label={body.level} value={classData.grade_level ?? body.notSet} />
        <ReadonlySetting label={body.students} value={String(stats.totalStudents)} />
        <ReadonlySetting label={body.status} value={classData.is_active ? body.active : body.archived} />
      </div>
      <EmptyReference icon="PencilSimple" title={body.editNotConnectedTitle} description={body.editNotConnectedDescription} />
    </PanelStack>
  )
}

function ReadonlySetting({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className="mt-1 text-sm font-bold text-on-surface">{value}</p>
    </div>
  )
}

function ManageStudentsSection({ data, body }: { data: SettingsSectionData; body: Record<BodyKey, string> }) {
  return (
    <PanelStack>
      <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4">
        <p className="text-sm leading-6 text-on-surface-variant">{body.manageStudentsIntro}</p>
      </div>
      <ActionRow>
        <Button mode="standard" variant="secondary" href={ROUTES.TEACHER.CLASS_STUDENT_NEW(data.classData.id)}>
          <Icon name="UserPlus" size="sm" aria-hidden />
          {body.addStudent}
        </Button>
      </ActionRow>
      <StudentList students={data.studentRoster} body={body} />
    </PanelStack>
  )
}

function ManageTeachersSection({ data, body }: { data: SettingsSectionData; body: Record<BodyKey, string> }) {
  return (
    <PanelStack>
      <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4">
        <p className="text-sm leading-6 text-on-surface-variant">{body.teachersIntro}</p>
      </div>
      <p className="text-sm text-on-surface-variant">{body.teachersInviteUnavailable}</p>
      <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4">
        <h3 className="font-bold text-on-surface">{body.currentTeachers}</h3>
        <div className="mt-3">
          <PersonRow name={`${data.profile.full_name} (${body.you})`} meta={body.teacherRole} icon="GraduationCap" />
        </div>
      </div>
    </PanelStack>
  )
}

function StudentSignInModeSection({ body }: { body: Record<BodyKey, string> }) {
  return (
    <PanelStack>
      <p className="text-sm text-on-surface-variant">{body.signInNote}</p>
      <ul className="space-y-5">
        {/* The only student sign-in method that exists today: username + 4-digit PIN
            (see src/features/auth/schemas/student-login.schema.ts). */}
        <SignInModeInfo icon="Key" title={body.signInPinTitle} description={body.signInPinDescription} />
      </ul>
    </PanelStack>
  )
}

function PanelStack({ children }: { children: ReactNode }) {
  return <div className="space-y-4">{children}</div>
}

function ActionRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>
}

function SignInModeInfo({
  icon,
  title,
  description,
}: {
  icon: IconName
  title: string
  description: string
}) {
  return (
    <li className="flex gap-3">
      <Icon name={icon} size="md" className="mt-0.5 shrink-0 text-on-surface-variant" aria-hidden />
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-bold text-on-surface">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-on-surface-variant">{description}</p>
      </div>
    </li>
  )
}

const studentStatusTone: Record<StudentStatus, 'lime' | 'sun' | 'cream'> = { online: 'lime', needs_help: 'sun', offline: 'cream' }
const studentStatusLabelKey: Record<StudentStatus, BodyKey> = { online: 'studentActive', needs_help: 'studentNeedsHelp', offline: 'studentInactive' }

function StudentList({ students, body }: { students: ClassDetailStudent[]; body: Record<BodyKey, string> }) {
  if (students.length === 0) {
    return <EmptyReference icon="Users" title={body.noStudentsTitle} description={body.noStudentsDescription} />
  }

  return (
    <div className="divide-y divide-outline-variant rounded-md border border-outline-variant bg-surface-container-lowest">
      {students.map((student) => (
        <Link
          key={student.id}
          href={ROUTES.TEACHER.STUDENT(student.id)}
          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-container focus-ring"
        >
          <StudentAvatar student={student} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-on-surface">{student.fullName}</p>
            <p className="truncate text-xs text-on-surface-variant">{student.username}</p>
          </div>
          <Pill tone={studentStatusTone[student.status]}>
            {body[studentStatusLabelKey[student.status]]}
          </Pill>
          <Icon name="CaretRight" size="sm" className="text-outline" aria-hidden />
        </Link>
      ))}
    </div>
  )
}

function PersonRow({ name, meta, icon }: { name: string; meta: string; icon: 'GraduationCap' | 'User' }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-outline-variant bg-surface-container-lowest p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary" aria-hidden>
        <Icon name={icon} size="md" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-on-surface">{name}</p>
        <p className="text-xs text-on-surface-variant">{meta}</p>
      </div>
    </div>
  )
}

function EmptyReference({
  icon,
  title,
  description,
}: {
  icon: 'Users' | 'PencilSimple'
  title: string
  description: string
}) {
  return (
    <div className="rounded-md border border-dashed border-outline-variant bg-surface-container-lowest p-6 text-center">
      <Icon name={icon} size="xl" className="mx-auto text-on-surface-variant" aria-hidden />
      <p className="mt-2 font-semibold text-on-surface">{title}</p>
      <p className="mt-1 text-sm leading-6 text-on-surface-variant">{description}</p>
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
