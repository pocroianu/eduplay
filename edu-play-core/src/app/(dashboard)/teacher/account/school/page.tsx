import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Language } from '@/lib/i18n/config';
import { getServerLanguage, getServerTranslation } from '@/lib/i18n/server';
import { createClient } from '@/lib/supabase/server';
import { ROUTES } from '@/shared/lib/constants/routes';
import { Badge, Card } from '@/shared/components/ui/kit';
import { Icon, type IconProps } from '@/shared/components/ui/Icon';

type TeacherProfile = {
  id: string;
  role: string | null;
  full_name: string | null;
};

type ClassRow = {
  id: string;
  name: string;
  grade_level: string | null;
  school_year: string | null;
  is_active: boolean | null;
};

type AccountTab = {
  href: string;
  label: string;
  description: string;
  icon: IconProps['name'];
};

type SchoolCopy = {
  tabs: AccountTab[];
  back: string;
  eyebrow: string;
  heading: string;
  currentSchool: string;
  schoolName: string;
  organization: string;
  connectedClasses: string;
  findSchool: string;
  country: string;
  state: string;
  city: string;
  loading: string;
  addSchool: string;
  myClasses: string;
  active: string;
  inactive: string;
  empty: string;
  workspace: string;
  classSummaryOne: string;
  classSummaryOther: string;
  noSchoolConnected: string;
  findSchoolUnavailable: string;
};

async function t(lang: Language, key: string) {
  return getServerTranslation(lang, 'teacher', key);
}

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLanguage();
  return {
    title: await t(lang, 'account.school.metadataTitle'),
  };
}

async function getSchoolCopy(lang: Language): Promise<SchoolCopy> {
  const [
    settings,
    settingsDescription,
    school,
    schoolDescription,
    device,
    deviceDescription,
    back,
    eyebrow,
    heading,
    currentSchool,
    schoolName,
    organization,
    connectedClasses,
    findSchool,
    country,
    state,
    city,
    loading,
    addSchool,
    myClasses,
    active,
    inactive,
    empty,
    workspace,
    classSummaryOne,
    classSummaryOther,
    noSchoolConnected,
    findSchoolUnavailable,
  ] = await Promise.all([
    t(lang, 'account.tabs.settings'),
    t(lang, 'account.tabs.settingsDescription'),
    t(lang, 'account.tabs.school'),
    t(lang, 'account.tabs.schoolDescription'),
    t(lang, 'account.tabs.device'),
    t(lang, 'account.tabs.deviceDescription'),
    t(lang, 'account.school.back'),
    t(lang, 'account.school.eyebrow'),
    t(lang, 'account.school.heading'),
    t(lang, 'account.school.currentSchool'),
    t(lang, 'account.school.schoolName'),
    t(lang, 'account.school.organization'),
    t(lang, 'account.school.connectedClasses'),
    t(lang, 'account.school.findSchool'),
    t(lang, 'account.school.country'),
    t(lang, 'account.school.state'),
    t(lang, 'account.school.city'),
    t(lang, 'account.school.loading'),
    t(lang, 'account.school.addSchool'),
    t(lang, 'account.school.myClasses'),
    t(lang, 'account.school.active'),
    t(lang, 'account.school.inactive'),
    t(lang, 'account.school.empty'),
    t(lang, 'account.school.workspace'),
    t(lang, 'account.school.classSummaryOne'),
    t(lang, 'account.school.classSummaryOther'),
    t(lang, 'account.school.noSchoolConnected'),
    t(lang, 'account.school.findSchoolUnavailable'),
  ]);

  return {
    tabs: [
      { href: ROUTES.TEACHER.ACCOUNT_SETTINGS, label: settings, description: settingsDescription, icon: 'User' },
      { href: ROUTES.TEACHER.ACCOUNT_SCHOOL, label: school, description: schoolDescription, icon: 'GraduationCap' },
      { href: ROUTES.TEACHER.ACCOUNT_DEVICE, label: device, description: deviceDescription, icon: 'HardDrives' },
    ],
    back,
    eyebrow,
    heading,
    currentSchool,
    schoolName,
    organization,
    connectedClasses,
    findSchool,
    country,
    state,
    city,
    loading,
    addSchool,
    myClasses,
    active,
    inactive,
    empty,
    workspace,
    classSummaryOne,
    classSummaryOther,
    noSchoolConnected,
    findSchoolUnavailable,
  };
}

async function getTeacherSchool() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(ROUTES.AUTH.LOGIN);

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single<TeacherProfile>();

  if (!profile || profile.role !== 'teacher') {
    redirect(ROUTES.AUTH.LOGIN);
  }

  const { data: classes } = await supabase
    .from('classes')
    .select('id, name, grade_level, school_year, is_active')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false });

  return {
    classes: (classes ?? []) as ClassRow[],
  };
}

function AccountTabs({ active, tabs, label }: { active: string; tabs: AccountTab[]; label: string }) {
  return (
    <nav aria-label={label} className="grid gap-3 md:grid-cols-3">
      {tabs.map((item) => {
        const isActive = item.href === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={`flex min-h-16 items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              isActive
                ? 'border-primary bg-primary-soft text-primary-deep'
                : 'border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container'
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface text-primary">
              <Icon name={item.icon} size="md" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold">{item.label}</span>
              <span className="mt-0.5 block text-xs text-on-surface-variant">{item.description}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card padding="none" shadow={false} className="overflow-hidden border border-outline-variant bg-surface-container-lowest">
      <h2 className="border-b border-outline-variant px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">
        {title}
      </h2>
      {children}
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">{label}</span>
      <span className="block rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm font-semibold text-on-surface-variant">
        {value}
      </span>
    </div>
  );
}

function interpolate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replace(`{{${key}}}`, value), template);
}

export default async function TeacherAccountSchoolPage() {
  const [{ classes }, lang] = await Promise.all([getTeacherSchool(), getServerLanguage()]);
  const copy = await getSchoolCopy(lang);
  const activeClassCount = classes.filter((classRow) => classRow.is_active !== false).length;
  const classSummaryTemplate = activeClassCount === 1 ? copy.classSummaryOne : copy.classSummaryOther;
  const classSummary = interpolate(classSummaryTemplate, { count: String(activeClassCount) });
  const workspace = interpolate(copy.workspace, { summary: classSummary });

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="border-b border-outline-variant bg-surface-container-lowest px-6 py-5 lg:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-5">
          <div className="flex items-center gap-3">
            <Link
              href={ROUTES.TEACHER.DASHBOARD}
              aria-label={copy.back}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Icon name="ArrowLeft" size="lg" aria-hidden />
            </Link>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">{copy.eyebrow}</p>
              <h1 className="font-headline text-3xl font-bold tracking-tight text-on-surface">{copy.heading}</h1>
            </div>
          </div>
          <AccountTabs active={ROUTES.TEACHER.ACCOUNT_SCHOOL} tabs={copy.tabs} label={copy.heading} />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-5xl gap-5 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-10">
        <div className="grid gap-5">
          <Section title={copy.currentSchool}>
            <div className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-deep">
                <Icon name="GraduationCap" size="xl" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-on-surface">{copy.noSchoolConnected}</p>
                <p className="mt-1 text-sm text-on-surface-variant">{workspace}</p>
              </div>
              <Badge tone="neutral">{copy.findSchoolUnavailable}</Badge>
            </div>
            <div className="grid gap-3 border-t border-outline-variant px-5 py-5 md:grid-cols-3">
              <Field label={copy.schoolName} value={copy.noSchoolConnected} />
              <Field label={copy.connectedClasses} value={classSummary} />
            </div>
          </Section>

          <Section title={copy.myClasses}>
            {classes.length > 0 ? (
              <ul className="divide-y divide-outline-variant" aria-label={copy.connectedClasses}>
                {classes.map((classRow) => (
                  <li key={classRow.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      <span className="block text-sm font-semibold text-on-surface">{classRow.name}</span>
                      <span className="mt-0.5 block text-sm text-on-surface-variant">
                        {[classRow.grade_level, classRow.school_year].filter(Boolean).join(' · ') || copy.empty}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-on-surface-variant">
                      {classRow.is_active === false ? copy.inactive : copy.active}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-5 py-6 text-sm text-on-surface-variant">{copy.empty}</div>
            )}
          </Section>
        </div>

        <Section title={copy.findSchool}>
          <div className="grid gap-3 px-5 py-5">
            <p className="text-sm text-on-surface-variant">{copy.findSchoolUnavailable}</p>
            <div className="rounded-lg border border-dashed border-outline-variant bg-surface-container px-4 py-5 text-sm text-on-surface-variant">
              {copy.noSchoolConnected}
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
