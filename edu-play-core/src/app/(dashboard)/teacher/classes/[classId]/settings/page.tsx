import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getClassDetailData, type ClassDetailData } from '@/features/teacher-dashboard/server'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import type { Language } from '@/lib/i18n/config'
import { getServerLanguage, getServerTranslation, preloadNamespaces } from '@/lib/i18n/server'
import { Icon } from '@/shared/components/ui/Icon'
import { Button, Card, Pill } from '@/shared/components/ui/kit'
import { ROUTES } from '@/shared/lib/constants'


type SettingsPageData = ClassDetailData
type SettingsHomeCopy = {
  back: string
  heading: string
  settingsMenu: string
  addStudents: string
  inviteFamilies: string
  sectionClassSettings: string
  sectionStudents: string
  manageStudents: string
  studentSignInModeDescription: string
  likesComments: string
  itemEditing: string
  sectionFamilies: string
  enableFamilyAccess: string
  inviteFamiliesLabel: string
  familyMessaging: string
  studentSignInMode: string
  studentGroups: string
  studentGroupsDescription: string
  homeLearningCodes: string
  homeLearningCodesDescription: string
  studentLikesCommentsDescription: string
  itemEditingDescription: string
  organization: string
  folders: string
  foldersDescription: string
  addFolderStep: string
  addFolderStepDescription: string
  teachers: string
  teachersDescription: string
  navAria: string
  classActive: string
  classArchived: string
  classSummary: string
  classSummaryActive: string
}

async function t(lang: Language, key: string) {
  return getServerTranslation(lang, 'teacher', key)
}

async function getSettingsHomeCopy(lang: Language): Promise<SettingsHomeCopy> {
  const [
    back,
    heading,
    settingsMenu,
    addStudents,
    inviteFamilies,
    sectionClassSettings,
    sectionStudents,
    manageStudents,
    studentSignInModeDescription,
    likesComments,
    itemEditing,
    sectionFamilies,
    enableFamilyAccess,
    inviteFamiliesLabel,
    familyMessaging,
    studentSignInMode,
    studentGroups,
    studentGroupsDescription,
    homeLearningCodes,
    homeLearningCodesDescription,
    studentLikesCommentsDescription,
    itemEditingDescription,
    organization,
    folders,
    foldersDescription,
    addFolderStep,
    addFolderStepDescription,
    teachers,
    teachersDescription,
    navAria,
    classActive,
    classArchived,
    classSummary,
    classSummaryActive,
  ] = await Promise.all([
    t(lang, 'settingsHome.back'),
    t(lang, 'settingsHome.heading'),
    t(lang, 'settingsHome.settingsMenu'),
    t(lang, 'settingsHome.addStudents'),
    t(lang, 'settingsHome.inviteFamilies'),
    t(lang, 'settingsHome.sectionClassSettings'),
    t(lang, 'settingsHome.sectionStudents'),
    t(lang, 'settingsHome.manageStudents'),
    t(lang, 'settingsHome.studentSignInModeDescription'),
    t(lang, 'settingsHome.likesComments'),
    t(lang, 'settingsHome.itemEditing'),
    t(lang, 'settingsHome.sectionFamilies'),
    t(lang, 'settingsHome.enableFamilyAccess'),
    t(lang, 'settingsHome.inviteFamiliesLabel'),
    t(lang, 'settingsHome.familyMessaging'),
    t(lang, 'settingsHome.studentSignInMode'),
    t(lang, 'settingsHome.studentGroups'),
    t(lang, 'settingsHome.studentGroupsDescription'),
    t(lang, 'settingsHome.homeLearningCodes'),
    t(lang, 'settingsHome.homeLearningCodesDescription'),
    t(lang, 'settingsHome.studentLikesCommentsDescription'),
    t(lang, 'settingsHome.itemEditingDescription'),
    t(lang, 'settingsHome.organization'),
    t(lang, 'settingsHome.folders'),
    t(lang, 'settingsHome.foldersDescription'),
    t(lang, 'settingsHome.addFolderStep'),
    t(lang, 'settingsHome.addFolderStepDescription'),
    t(lang, 'settingsHome.teachers'),
    t(lang, 'settingsHome.teachersDescription'),
    t(lang, 'settingsHome.navAria'),
    t(lang, 'settingsHome.classActive'),
    t(lang, 'settingsHome.classArchived'),
    t(lang, 'settingsHome.classSummary'),
    t(lang, 'settingsHome.classSummaryActive'),
  ])

  return {
    back,
    heading,
    settingsMenu,
    addStudents,
    inviteFamilies,
    sectionClassSettings,
    sectionStudents,
    manageStudents,
    studentSignInModeDescription,
    likesComments,
    itemEditing,
    sectionFamilies,
    enableFamilyAccess,
    inviteFamiliesLabel,
    familyMessaging,
    studentSignInMode,
    studentGroups,
    studentGroupsDescription,
    homeLearningCodes,
    homeLearningCodesDescription,
    studentLikesCommentsDescription,
    itemEditingDescription,
    organization,
    folders,
    foldersDescription,
    addFolderStep,
    addFolderStepDescription,
    teachers,
    teachersDescription,
    navAria,
    classActive,
    classArchived,
    classSummary,
    classSummaryActive,
  }
}

export default async function ClassSettingsPage({
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
  const copy = await getSettingsHomeCopy(lang)

  return (
    <I18nProvider lang={lang} resources={resources}>
      <ClassSettingsContent data={data} copy={copy} />
    </I18nProvider>
  )
}

function ClassSettingsContent({ data, copy }: { data: SettingsPageData; copy: SettingsHomeCopy }) {
  const { classData, stats } = data
  const classInitials = initials(classData.name)
  const classStatus = classData.is_active ? copy.classActive : copy.classArchived
  const classSummary = `${stats.totalStudents} ${copy.classSummary} · ${stats.activeStudents} ${copy.classSummaryActive}`
  const sectionLinks = [
    {
      group: copy.sectionClassSettings,
      items: [
        { id: 'class-info', label: copy.sectionClassSettings, value: classData.name, icon: 'BookOpen' as const },
        { id: 'student-sign-in-mode', label: copy.studentSignInMode, value: copy.studentSignInModeDescription, icon: 'Key' as const },
      ],
    },
    {
      group: copy.sectionStudents,
      items: [
        { id: 'manage-students', label: copy.manageStudents, value: classSummary, icon: 'Users' as const },
      ],
    },
    {
      group: copy.organization,
      items: [
        { id: 'manage-teachers', label: copy.teachers, value: copy.teachersDescription, icon: 'GraduationCap' as const },
      ],
    },
    {
      group: copy.sectionFamilies,
      items: [
        { id: 'families', label: copy.inviteFamiliesLabel, value: copy.inviteFamiliesLabel, icon: 'PaperPlaneTilt' as const },
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-surface-container text-on-surface">
      <header className="border-b border-outline-variant bg-surface-container-lowest">
        <div className="mx-auto flex max-w-[760px] flex-col gap-5 px-5 py-5">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-on-surface-variant">
            <Link
              href={ROUTES.TEACHER.CLASS(classData.id)}
              className="inline-flex items-center gap-2 rounded-sm font-semibold text-primary hover:underline focus-ring"
            >
              <Icon name="ArrowLeft" size="sm" aria-hidden />
              {copy.back}
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-lg font-bold text-on-primary" aria-hidden>
              {classInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold uppercase tracking-wide text-on-surface-variant">{copy.settingsMenu}</p>
              <h1 className="font-headline text-2xl font-bold text-on-surface md:text-3xl">{copy.heading}</h1>
              <p className="mt-1 truncate text-sm text-on-surface-variant">{classData.name}</p>
            </div>
            <Pill tone={classData.is_active ? 'lime' : 'cream'}>{classStatus}</Pill>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[760px] px-5 py-6">
        <Card padding="none" shadow={false} className="overflow-hidden border border-outline-variant bg-surface-container-lowest">
          <div className="grid gap-3 border-b border-outline-variant p-4 sm:grid-cols-2">
            <Button mode="standard" variant="secondary" size="lg" href={ROUTES.TEACHER.CLASS_STUDENT_NEW(classData.id)} className="justify-center">
              <Icon name="UserPlus" size="sm" aria-hidden />
              {copy.addStudents}
            </Button>
            <Button mode="standard" variant="secondary" size="lg" href={ROUTES.TEACHER.CLASS_FAMILIES(classData.id)} className="justify-center">
              <Icon name="HandHeart" size="sm" aria-hidden />
              {copy.inviteFamilies}
            </Button>
          </div>

          <nav aria-label={copy.navAria} className="divide-y divide-outline-variant">
            {sectionLinks.map((section) => (
              <section key={section.group} aria-labelledby={`${slugify(section.group)}-title`} className="p-4">
                <h2 id={`${slugify(section.group)}-title`} className="mb-2 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                  {section.group}
                </h2>
                <div className="overflow-hidden rounded-md border border-outline-variant bg-surface">
                  {section.items.map((item) => (
                    <SettingsLink
                      key={item.id}
                      href={settingsHref(classData.id, item.id)}
                      icon={item.icon}
                      label={item.label}
                      value={item.value}
                    />
                  ))}
                </div>
              </section>
            ))}
          </nav>
        </Card>
      </div>
    </div>
  )
}

function settingsHref(classId: string, id: string) {
  if (id === 'families') return ROUTES.TEACHER.CLASS_FAMILIES(classId)
  return ROUTES.TEACHER.CLASS_SETTING_SECTION(classId, id)
}

function SettingsLink({
  href,
  icon,
  label,
  value,
}: {
  href: string
  icon: 'BookOpen' | 'Users' | 'ListChecks' | 'SquaresFour' | 'GraduationCap' | 'House' | 'Key' | 'ThumbsUp' | 'PencilSimple' | 'PlusCircle' | 'HandHeart' | 'PaperPlaneTilt'
  label: string
  value: string
}) {
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center gap-3 border-b border-outline-variant px-4 py-3 last:border-b-0 hover:bg-surface-container focus-ring"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary" aria-hidden>
        <Icon name={icon} size="sm" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-on-surface">{label}</span>
        <span className="block truncate text-xs text-on-surface-variant">{value}</span>
      </span>
      <Icon name="CaretRight" size="xs" className="shrink-0 text-outline" aria-hidden />
    </Link>
  )
}

function slugify(value: string) {
  return value.toLocaleLowerCase('ro-RO').replace(/[^a-z0-9]+/gi, '-')
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return 'CL'
  const first = parts[0]?.[0] ?? ''
  const second = parts.length > 1 ? parts[1]?.[0] ?? '' : parts[0]?.[1] ?? ''
  return `${first}${second}`.toLocaleUpperCase('ro-RO')
}
