import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Switch, TextInput } from '@mantine/core'
import { getClassDetailData, type ClassDetailData, type ClassDetailStudent } from '@/features/teacher-dashboard/server'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import type { Language } from '@/lib/i18n/config'
import { getServerLanguage, getServerTranslation, preloadNamespaces } from '@/lib/i18n/server'
import { Icon } from '@/shared/components/ui/Icon'
import { Button, Card, MantineBoundary, Pill } from '@/shared/components/ui/kit'
import { ROUTES } from '@/shared/lib/constants'

const sectionDefinitions = [
  {
    slug: 'class-info',
    title: 'Setări clasă',
    eyebrow: 'Clasă',
    description: 'Verifică numele, anul și starea clasei înainte să continui către setările detaliate.',
    icon: 'BookOpen' as const,
  },
  {
    slug: 'manage-students',
    title: 'Gestionează elevii',
    eyebrow: 'Elevi',
    description: 'Verifică modul în care elevii se conectează la clasă și administrează accesul catalogului.',
    icon: 'Users' as const,
  },
  {
    slug: 'manage-student-groups',
    title: 'Gestionează grupurile de elevi',
    eyebrow: 'Elevi',
    description: 'Creează și editează grupuri pentru atribuire rapidă de activități.',
    icon: 'ListChecks' as const,
  },
  {
    slug: 'manage-folders',
    title: 'Gestionează dosarele',
    eyebrow: 'Dosare',
    description: 'Creează dosare pentru a organiza lucrările clasei după temă, disciplină sau proiect.',
    icon: 'SquaresFour' as const,
  },
  {
    slug: 'manage-teachers',
    title: 'Gestionează profesorii',
    eyebrow: 'Profesori',
    description: 'Invită co-profesori și verifică permisiunile partajate pentru această clasă.',
    icon: 'GraduationCap' as const,
  },
  {
    slug: 'home-learning-codes',
    title: 'Coduri elevi pentru învățare acasă',
    eyebrow: 'Învățare acasă',
    description: 'Elevii folosesc codurile individuale pentru a rezolva activități, vedea jurnalul și anunțurile.',
    icon: 'House' as const,
  },
  {
    slug: 'student-sign-in-mode',
    title: 'Mod de conectare elevi',
    eyebrow: 'Elevi',
    description: 'Alege cum se conectează elevii pe dispozitive partajate sau 1:1.',
    icon: 'Key' as const,
  },
  {
    slug: 'student-likes-comments',
    title: 'Aprecieri și comentarii ale elevilor',
    eyebrow: 'Elevi',
    description: 'Controlează cum funcționează aprecierile și comentariile pentru elevii din această clasă.',
    icon: 'ThumbsUp' as const,
  },
  {
    slug: 'item-editing',
    title: 'Editarea elementelor',
    eyebrow: 'Postări',
    description: 'Elevii pot edita postările în care sunt etichetați; ciornele pot fi editate oricum.',
    icon: 'PencilSimple' as const,
  },
  {
    slug: 'show-add-folder-step',
    title: 'Afișează pasul „Adaugă în dosar”',
    eyebrow: 'Elevi',
    description: 'Alege dacă elevii văd pasul de adăugare în dosar înainte de publicare.',
    icon: 'PlusCircle' as const,
  },
] as const

type SectionSlug = (typeof sectionDefinitions)[number]['slug']
type SectionDefinition = (typeof sectionDefinitions)[number]
type SettingsSectionData = ClassDetailData
type SettingsSectionCopy = {
  back: string
  breadcrumbAria: string
  classActive: string
  classArchived: string
  close: string
  navTitle: string
  navDescription: string
  navAria: string
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

  return {
    back,
    breadcrumbAria,
    classActive,
    classArchived,
    close,
    navTitle,
    navDescription,
    navAria,
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
      <ClassSettingsSectionContent data={data} section={definition} copy={copy} />
    </I18nProvider>
  )
}

function ClassSettingsSectionContent({
  data,
  section,
  copy,
}: {
  data: SettingsSectionData
  section: SectionDefinition
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
              className="inline-flex items-center gap-2 rounded-sm font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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

      <main className="mx-auto grid w-full max-w-[1280px] gap-6 px-6 py-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-10">
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
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Icon name="X" size="md" aria-hidden />
              </Link>
            </div>
            <div className="bg-surface-container p-4 md:p-6">
              <div className="mx-auto max-w-3xl">
                {renderSection(section.slug, data)}
              </div>
            </div>
          </Card>
        </section>
      </main>
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
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  active
                    ? 'bg-primary-soft text-primary-deep'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <Icon name={item.icon} size="sm" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
              </Link>
            )
          })}
        </nav>
      </Card>
    </aside>
  )
}

function renderSection(slug: SectionSlug, data: SettingsSectionData) {
  switch (slug) {
    case 'class-info':
      return <ClassInfoSection data={data} />
    case 'manage-students':
      return <ManageStudentsSection data={data} />
    case 'manage-student-groups':
      return <ManageStudentGroupsSection students={data.studentRoster} className={data.classData.name} />
    case 'manage-folders':
      return <ManageFoldersSection className={data.classData.name} />
    case 'manage-teachers':
      return <ManageTeachersSection data={data} />
    case 'home-learning-codes':
      return <HomeLearningCodesSection data={data} />
    case 'student-sign-in-mode':
      return <StudentSignInModeSection />
    case 'student-likes-comments':
      return <StudentLikesCommentsSection />
    case 'item-editing':
      return <ItemEditingSection />
    case 'show-add-folder-step':
      return <ShowAddFolderStepSection />
  }
}

function ClassInfoSection({ data }: { data: SettingsSectionData }) {
  const { classData, stats } = data

  return (
    <PanelStack>
      <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4">
        <p className="text-sm font-bold text-on-surface">Numele clasei</p>
        <p className="mt-1 text-lg font-bold text-primary-deep">{classData.name}</p>
        {classData.description ? (
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">{classData.description}</p>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ReadonlySetting label="An școlar" value={classData.school_year ?? 'Nu este setat'} />
        <ReadonlySetting label="Nivel" value={classData.grade_level ?? 'Nu este setat'} />
        <ReadonlySetting label="Elevi" value={String(stats.totalStudents)} />
        <ReadonlySetting label="Stare" value={classData.is_active ? 'Activă' : 'Arhivată'} />
      </div>
      <EmptyReference
        icon="PencilSimple"
        title="Editarea clasei nu este conectată încă"
        description="Păstrăm acest ecran ca detaliu real pentru rândul „Setări clasă”, fără să promitem salvări inexistente."
      />
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

function ManageStudentsSection({ data }: { data: SettingsSectionData }) {
  return (
    <PanelStack>
      <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4">
        <p className="text-sm leading-6 text-on-surface-variant">
          Elevii se conectează la această clasă cu un cod de clasă, cod individual sau cont existent. Folosește fluxul „Adaugă elevi” pentru nume noi, apoi verifică accesul fiecărui elev aici.
        </p>
      </div>
      <ActionRow>
        <Button mode="standard" variant="secondary" href={ROUTES.TEACHER.CLASS_STUDENT_NEW(data.classData.id)}>
          <Icon name="UserPlus" size="sm" aria-hidden />
          Adaugă elev
        </Button>
        <Button mode="standard" variant="secondary" type="button" disabled>
          <Icon name="MagnifyingGlass" size="sm" aria-hidden />
          Caută elev — indisponibil
        </Button>
      </ActionRow>
      <StudentList students={data.studentRoster} emptyText="Nu există elevi în această clasă. Adaugă elevi folosind butonul de mai sus." />
      <ReadonlySwitch label="Elevii pot vedea lucrările colegilor" checked />
      <ReadonlySwitch label="Activează elevul demonstrativ" checked />
      <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4">
        <p className="font-bold text-on-surface">Adaugă elevi</p>
        <p className="mt-1 text-sm text-on-surface-variant">Elev demonstrativ</p>
      </div>
    </PanelStack>
  )
}

function ManageStudentGroupsSection({
  students,
  className,
}: {
  students: ClassDetailStudent[]
  className: string
}) {
  const groups = buildStudentGroups(students)

  return (
    <PanelStack>
      <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4">
        <p className="text-sm leading-6 text-on-surface-variant">
          Grupurile de elevi te ajută să atribui rapid activități unui set pregătit de copii.
        </p>
      </div>
      <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4">
        <p className="text-sm font-semibold text-on-surface">Numele grupului:</p>
        <div className="mt-2 rounded-md border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface-variant">
          Cititori rapizi
        </div>
        <p className="mt-4 text-sm font-semibold text-on-surface">Alege elevii:</p>
        <div className="mt-2 rounded-md border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface-variant">
          Toți elevii din {className}
        </div>
      </div>
      <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4">
        <p className="text-sm font-bold text-on-surface">Elev demonstrativ</p>
      </div>
      <ActionRow>
        <Button mode="standard" variant="secondary" disabled>
          <Icon name="Plus" size="sm" aria-hidden />
          Adaugă grup
        </Button>
        <Button mode="standard" variant="secondary" disabled>
          <Icon name="Trash" size="sm" aria-hidden />
          Șterge grupul
        </Button>
      </ActionRow>
      {groups.map((group) => (
        <div key={group.name} className="rounded-md border border-outline-variant bg-surface-container-lowest p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-on-surface">{group.name}</h3>
              <p className="text-sm text-on-surface-variant">{group.students.length} elevi</p>
            </div>
            <Icon name="DotsThreeVertical" size="sm" className="text-on-surface-variant" aria-hidden />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {group.students.length > 0 ? (
              group.students.map((student) => <Pill key={student.id} tone="cream">{student.fullName}</Pill>)
            ) : (
              <span className="text-sm text-on-surface-variant">Adaugă elevi pentru a popula acest grup.</span>
            )}
          </div>
        </div>
      ))}
    </PanelStack>
  )
}

function ManageFoldersSection({ className }: { className: string }) {
  return (
    <PanelStack>
      <ActionRow>
        <Button mode="standard" variant="secondary" disabled>
          <Icon name="Plus" size="sm" aria-hidden />
          Creează dosar
        </Button>
      </ActionRow>
      <EmptyReference
        icon="SquaresFour"
        title="Nu există dosare create încă"
        description={`Creează dosare pentru a organiza lucrările clasei după temă, disciplină sau proiect. ${className} va folosi aceste dosare pentru jurnal și portofoliu.`}
      />
      <ReadonlySwitch label="Afișează pasul „Adaugă în dosar”" checked />
    </PanelStack>
  )
}

function ManageTeachersSection({ data }: { data: SettingsSectionData }) {
  return (
    <PanelStack>
      <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4">
        <p className="text-sm leading-6 text-on-surface-variant">
          Adaugă profesori care fac deja parte din școala ta în clase noi din catalogul școlii.
        </p>
      </div>
      <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4">
        <label className="text-sm font-semibold text-on-surface" htmlFor="teacher-email-preview">
          Introdu e-mailul profesorului pe care vrei să îl inviți:
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <MantineBoundary>
            <TextInput
              id="teacher-email-preview"
              type="email"
              disabled
              placeholder="profesor@scoala.ro"
              className="flex-1"
              styles={{ input: { minHeight: 44 } }}
            />
          </MantineBoundary>
          <Button mode="standard" disabled>
            Invită profesorul
          </Button>
        </div>
        <p className="mt-3 text-sm text-on-surface-variant">
          Dacă profesorul invitat nu primește e-mailul, generează un link de invitație pentru co-profesor.
        </p>
      </div>
      <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4">
        <p className="text-sm leading-6 text-on-surface-variant">
          Toți profesorii au aceleași permisiuni. De exemplu, pot aproba elemente, invita și aproba părinți și edita sau șterge elemente.
        </p>
      </div>
      <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4">
        <h3 className="font-bold text-on-surface">Profesori actuali</h3>
        <div className="mt-3">
          <PersonRow name={`${data.profile.full_name} (tu)`} meta="Profesor" icon="GraduationCap" />
        </div>
      </div>
    </PanelStack>
  )
}

function HomeLearningCodesSection({ data }: { data: SettingsSectionData }) {
  return (
    <PanelStack>
      <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4">
        <h3 className="font-bold text-on-surface">{data.classData.name} — învățare acasă</h3>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">
          Când elevii se conectează cu un cod pentru învățare acasă, pot completa activități, pot vedea jurnalul și anunțurile.
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-on-surface-variant">
          <li>Nu trebuie să modifici modul de conectare sau alte setări ale clasei pentru a folosi aceste coduri.</li>
          <li>Pentru un cod nou al unui elev, deschide Setări clasă, Gestionează elevii, numele elevului, apoi Cod elev pentru învățare acasă.</li>
        </ul>
      </div>
      <ActionRow>
        <Button mode="standard" variant="secondary" disabled>
          <Icon name="Printer" size="sm" aria-hidden />
          Tipărește codurile
        </Button>
        <Button mode="standard" variant="secondary" disabled>
          <Icon name="Copy" size="sm" aria-hidden />
          Descarcă lista
        </Button>
      </ActionRow>
      <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4">
        <p className="text-sm font-bold text-on-surface">Întrebări și idei pentru învățarea acasă</p>
      </div>
      {data.studentRoster.length > 0 ? (
        <div className="divide-y divide-outline-variant rounded-md border border-outline-variant bg-surface-container-lowest">
          {data.studentRoster.map((student) => (
            <div key={student.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-on-surface">{student.fullName}</p>
                <p className="truncate text-xs text-on-surface-variant">{student.username}</p>
              </div>
              <code className="rounded-md bg-surface-container px-2 py-1 text-sm font-semibold text-on-surface">
                {homeLearningCode(student)}
              </code>
            </div>
          ))}
        </div>
      ) : (
        <EmptyReference icon="House" title="Nu există coduri disponibile" description="Adaugă elevi ca să vezi codurile pentru învățare acasă." />
      )}
    </PanelStack>
  )
}

function StudentSignInModeSection() {
  return (
    <PanelStack>
      <SelectableOption
        icon="HardDrives"
        title="Cod de clasă — dispozitive partajate"
        description="Elevii intră cu un cod QR sau text al clasei. Pot adăuga elemente în jurnalul lor și în alte jurnale din clasă. Recomandat pentru dispozitive partajate."
        selected
      />
      <SelectableOption
        icon="Users"
        title="Cod de clasă — dispozitive 1:1"
        description="Elevii intră cu un cod de elev, își aleg numele din lista clasei și rămân conectați ca acel elev. Pot adăuga elemente în jurnalul propriu și salva ciorne."
      />
      <SelectableOption
        icon="Envelope"
        title="E-mail sau SSO"
        description="Elevii intră cu adresa de e-mail și parola sau prin SSO. Recomandat pentru elevii care se descurcă să intre cu un cont propriu."
      />
    </PanelStack>
  )
}

function StudentLikesCommentsSection() {
  return (
    <PanelStack>
      <ReadonlySwitch label="Activează aprecierile elevilor" checked />
      <ReadonlySwitch label="Activează comentariile elevilor" checked />
      <ReadonlySwitch label="Comentariile noi necesită aprobare" checked />
      <ReadonlySwitch label="Elevii pot vedea lucrările colegilor" checked />
      <ReadonlySwitch label="Elevii pot publica pe blog" checked={false} />
    </PanelStack>
  )
}

function ItemEditingSection() {
  return (
    <PanelStack>
      <ReadonlySwitch
        label="Activează editarea elementelor"
        description="Elevii pot edita postările în care sunt etichetați. Ciornele pot fi editate indiferent de această setare."
        checked
      />
      <ReadonlySwitch
        label="Permite elevilor să editeze cine este etichetat în postări"
        description="Dacă partajarea cu familia este activă, etichetarea mai multor elevi va partaja postarea și numele elevilor etichetați cu toți elevii etichetați și membrii de familie conectați."
        checked={false}
      />
      <ReadonlySwitch
        label="Păstrează aprobarea profesorului pentru modificările publicate"
        checked
      />
    </PanelStack>
  )
}

function ShowAddFolderStepSection() {
  return (
    <PanelStack>
      <ReadonlySwitch
        label="Afișează pasul „Adaugă în dosar”"
        description="Elevii pot alege dacă adaugă lucrarea într-un dosar înainte de publicare."
        checked
      />
      <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4">
        <h3 className="font-bold text-on-surface">Setări asociate</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <InfoRow label="Cod de clasă — dispozitive partajate" value="Activ" />
          <InfoRow label="Coduri elevi pentru învățare acasă" value="Disponibil" />
        </div>
      </div>
    </PanelStack>
  )
}

function PanelStack({ children }: { children: ReactNode }) {
  return <div className="space-y-4">{children}</div>
}

function ActionRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 rounded-md border border-outline-variant bg-surface-container-lowest px-4 py-3">
      <span className="text-sm font-semibold text-on-surface">{label}</span>
      <span className="text-sm text-on-surface-variant">{value}</span>
    </div>
  )
}

function ReadonlySwitch({
  label,
  description,
  checked,
}: {
  label: string
  description?: string
  checked: boolean
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 rounded-md border border-outline-variant bg-surface-container-lowest px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-on-surface">{label}</p>
        {description && <p className="mt-1 text-sm leading-6 text-on-surface-variant">{description}</p>}
      </div>
      <MantineBoundary><Switch disabled checked={checked} aria-label={label}
        aria-checked={checked} aria-disabled="true" className="shrink-0" /></MantineBoundary>
    </div>
  )
}

function SelectableOption({
  icon,
  title,
  description,
  selected = false,
}: {
  icon: 'HardDrives' | 'Users' | 'Envelope' | 'House'
  title: string
  description: string
  selected?: boolean
}) {
  return (
    <div
      className={`flex gap-4 rounded-md border p-4 ${
        selected ? 'border-primary bg-primary-soft text-primary-deep' : 'border-outline-variant bg-surface-container-lowest text-on-surface'
      }`}
    >
      <Icon name={icon} size="lg" className={selected ? 'text-primary' : 'text-on-surface-variant'} aria-hidden />
      <div className="min-w-0 flex-1">
        <h3 className="font-bold">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-on-surface-variant">{description}</p>
      </div>
      {selected && <Icon name="CheckCircle" size="lg" className="text-primary" aria-label="Selectat" />}
    </div>
  )
}

function StudentList({ students, emptyText }: { students: ClassDetailStudent[]; emptyText: string }) {
  if (students.length === 0) {
    return <EmptyReference icon="Users" title={emptyText} description="Adaugă elevi din fluxul existent al clasei." />
  }

  return (
    <div className="divide-y divide-outline-variant rounded-md border border-outline-variant bg-surface-container-lowest">
      {students.map((student) => (
        <Link
          key={student.id}
          href={ROUTES.TEACHER.STUDENT(student.id)}
          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <StudentAvatar student={student} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-on-surface">{student.fullName}</p>
            <p className="truncate text-xs text-on-surface-variant">{student.username}</p>
          </div>
          <Pill tone={student.status === 'online' ? 'lime' : student.status === 'needs_help' ? 'sun' : 'cream'}>
            {student.status === 'online' ? 'Activ' : student.status === 'needs_help' ? 'Necesită ajutor' : 'Inactiv'}
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
  icon: 'House' | 'SquaresFour' | 'Users' | 'PencilSimple'
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

function buildStudentGroups(students: ClassDetailStudent[]) {
  if (students.length === 0) {
    return [
      { name: 'Grupul 1', students: [] },
      { name: 'Grupul 2', students: [] },
    ]
  }

  const buckets = [
    { name: 'Grupul 1', students: [] as ClassDetailStudent[] },
    { name: 'Grupul 2', students: [] as ClassDetailStudent[] },
    { name: 'Grupul 3', students: [] as ClassDetailStudent[] },
  ]

  students.forEach((student, index) => {
    buckets[index % buckets.length].students.push(student)
  })

  return buckets.filter((group) => group.students.length > 0)
}

function homeLearningCode(student: ClassDetailStudent) {
  const namePart = student.username.replace(/[^a-z0-9]/gi, '').slice(0, 3).toLocaleUpperCase('ro-RO') || 'EDU'
  const idPart = student.id.replace(/[^a-z0-9]/gi, '').slice(0, 4).toLocaleUpperCase('ro-RO') || 'PLAY'
  return `${namePart}-${idPart}`
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return 'CL'
  const first = parts[0]?.[0] ?? ''
  const second = parts.length > 1 ? parts[1]?.[0] ?? '' : parts[0]?.[1] ?? ''
  return `${first}${second}`.toLocaleUpperCase('ro-RO')
}
