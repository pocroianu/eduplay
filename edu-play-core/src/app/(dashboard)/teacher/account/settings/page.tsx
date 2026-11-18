import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Language } from '@/lib/i18n/config';
import { LANGUAGE_LABELS } from '@/lib/i18n/config';
import { getServerLanguage, getServerTranslation } from '@/lib/i18n/server';
import { createClient } from '@/lib/supabase/server';
import { ROUTES } from '@/shared/lib/constants/routes';
import { Badge, Button, Card } from '@/shared/components/ui/kit';
import { Icon, type IconProps } from '@/shared/components/ui/Icon';

type TeacherAccountProfile = {
  id: string;
  role: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type AccountTab = {
  href: string;
  label: string;
  description: string;
  icon: IconProps['name'];
};

type AccountCopy = {
  tabs: AccountTab[];
  back: string;
  eyebrow: string;
  heading: string;
  profile: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  preferredLanguage: string;
  phone: string;
  password: string;
  change: string;
  manage: string;
  mfa: string;
  accountActivity: string;
  schools: string;
  schoolDirectory: string;
  classes: string;
  currentClasses: string;
  addToClass: string;
  premiumHeading: string;
  tryTrial: string;
  previewPremium: string;
  learnMore: string;
  manageSubscription: string;
  notifications: string;
  officeHours: string;
  emailNotifications: string;
  pushNotifications: string;
  smsNotifications: string;
  tips: string;
  parentNotifications: string;
  archives: string;
  downloadArchives: string;
  archivedClasses: string;
  manageArchived: string;
  privacy: string;
  coppa: string;
  deleteAccount: string;
  teacherRole: string;
  unavailable: string;
  noPhone: string;
  readOnly: string;
};

async function t(lang: Language, key: string) {
  return getServerTranslation(lang, 'teacher', key);
}

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLanguage();
  return {
    title: await t(lang, 'account.settings.metadataTitle'),
  };
}

async function getAccountCopy(lang: Language): Promise<AccountCopy> {
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
    profile,
    firstName,
    lastName,
    displayName,
    email,
    preferredLanguage,
    phone,
    password,
    change,
    manage,
    mfa,
    accountActivity,
    schools,
    schoolDirectory,
    classes,
    currentClasses,
    addToClass,
    premiumHeading,
    tryTrial,
    previewPremium,
    learnMore,
    manageSubscription,
    notifications,
    officeHours,
    emailNotifications,
    pushNotifications,
    smsNotifications,
    tips,
    parentNotifications,
    archives,
    downloadArchives,
    archivedClasses,
    manageArchived,
    privacy,
    coppa,
    deleteAccount,
    teacherRole,
    unavailable,
    noPhone,
    readOnly,
  ] = await Promise.all([
    t(lang, 'account.tabs.settings'),
    t(lang, 'account.tabs.settingsDescription'),
    t(lang, 'account.tabs.school'),
    t(lang, 'account.tabs.schoolDescription'),
    t(lang, 'account.tabs.device'),
    t(lang, 'account.tabs.deviceDescription'),
    t(lang, 'account.settings.back'),
    t(lang, 'account.settings.eyebrow'),
    t(lang, 'account.settings.heading'),
    t(lang, 'account.settings.profile'),
    t(lang, 'account.settings.firstName'),
    t(lang, 'account.settings.lastName'),
    t(lang, 'account.settings.displayName'),
    t(lang, 'account.settings.email'),
    t(lang, 'account.settings.preferredLanguage'),
    t(lang, 'account.settings.phone'),
    t(lang, 'account.settings.password'),
    t(lang, 'account.settings.change'),
    t(lang, 'account.settings.manage'),
    t(lang, 'account.settings.mfa'),
    t(lang, 'account.settings.accountActivity'),
    t(lang, 'account.settings.schools'),
    t(lang, 'account.settings.schoolDirectory'),
    t(lang, 'account.settings.classes'),
    t(lang, 'account.settings.currentClasses'),
    t(lang, 'account.settings.addToClass'),
    t(lang, 'account.settings.premiumHeading'),
    t(lang, 'account.settings.tryTrial'),
    t(lang, 'account.settings.previewPremium'),
    t(lang, 'account.settings.learnMore'),
    t(lang, 'account.settings.manageSubscription'),
    t(lang, 'account.settings.notifications'),
    t(lang, 'account.settings.officeHours'),
    t(lang, 'account.settings.emailNotifications'),
    t(lang, 'account.settings.pushNotifications'),
    t(lang, 'account.settings.smsNotifications'),
    t(lang, 'account.settings.tips'),
    t(lang, 'account.settings.parentNotifications'),
    t(lang, 'account.settings.archives'),
    t(lang, 'account.settings.downloadArchives'),
    t(lang, 'account.settings.archivedClasses'),
    t(lang, 'account.settings.manageArchived'),
    t(lang, 'account.settings.privacy'),
    t(lang, 'account.settings.coppa'),
    t(lang, 'account.settings.deleteAccount'),
    t(lang, 'account.settings.teacherRole'),
    t(lang, 'account.settings.unavailable'),
    t(lang, 'account.settings.noPhone'),
    t(lang, 'account.settings.readOnly'),
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
    profile,
    firstName,
    lastName,
    displayName,
    email,
    preferredLanguage,
    phone,
    password,
    change,
    manage,
    mfa,
    accountActivity,
    schools,
    schoolDirectory,
    classes,
    currentClasses,
    addToClass,
    premiumHeading,
    tryTrial,
    previewPremium,
    learnMore,
    manageSubscription,
    notifications,
    officeHours,
    emailNotifications,
    pushNotifications,
    smsNotifications,
    tips,
    parentNotifications,
    archives,
    downloadArchives,
    archivedClasses,
    manageArchived,
    privacy,
    coppa,
    deleteAccount,
    teacherRole,
    unavailable,
    noPhone,
    readOnly,
  };
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';
}

async function getTeacherAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(ROUTES.AUTH.LOGIN);

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name, email, avatar_url')
    .eq('id', user.id)
    .single<TeacherAccountProfile>();

  if (!profile || profile.role !== 'teacher') {
    redirect(ROUTES.AUTH.LOGIN);
  }

  return {
    id: profile.id,
    name: profile.full_name || user.email || 'Profesor EduPlay',
    email: profile.email || user.email || '',
    avatarUrl: profile.avatar_url,
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
            className={`flex min-h-16 items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors focus-ring ${
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
      <div className="divide-y divide-outline-variant">{children}</div>
    </Card>
  );
}

function TextRow({ label, value, readOnly }: { label: string; value: string; readOnly: string }) {
  return (
    <div className="flex min-h-14 flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-semibold text-on-surface">{label}</span>
      <span className="w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface-variant sm:max-w-xs" aria-label={`${label} ${readOnly}`}>
        {value}
      </span>
    </div>
  );
}

function SelectRow({ label, value, readOnly }: { label: string; value: string; readOnly: string }) {
  return (
    <div className="flex min-h-14 flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-semibold text-on-surface">{label}</span>
      <span className="w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm font-semibold text-on-surface-variant sm:max-w-xs" aria-label={`${label} ${readOnly}`}>
        {value}
      </span>
    </div>
  );
}

function ToggleRow({ label, description, unavailable }: { label: string; description?: string; unavailable: string }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 px-5 py-3">
      <span>
        <span className="block text-sm font-semibold text-on-surface">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-on-surface-variant">{description}</span> : null}
      </span>
      <Badge tone="neutral">{unavailable}</Badge>
    </div>
  );
}

function ActionRow({ label, value, action, href, danger = false }: { label: string; value?: string; action?: string; href?: string; danger?: boolean }) {
  return (
    <div className="flex min-h-14 flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span>
        <span className={`block text-sm font-semibold ${danger ? 'text-error' : 'text-on-surface'}`}>{label}</span>
        {value ? <span className="mt-0.5 block text-sm text-on-surface-variant">{value}</span> : null}
      </span>
      {action ? (
        href ? (
          <Button href={href} variant="secondary" size="sm">{action}</Button>
        ) : (
          <Badge tone="neutral">{action}</Badge>
        )
      ) : null}
    </div>
  );
}

export default async function TeacherAccountSettingsPage() {
  const [account, lang] = await Promise.all([getTeacherAccount(), getServerLanguage()]);
  const copy = await getAccountCopy(lang);
  const [firstName = account.name, ...restName] = account.name.split(' ');
  const lastName = restName.join(' ');
  const languageLabel = LANGUAGE_LABELS[lang];

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="border-b border-outline-variant bg-surface-container-lowest px-6 py-5 lg:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-5">
          <div className="flex items-center gap-3">
            <Link
              href={ROUTES.TEACHER.DASHBOARD}
              aria-label={copy.back}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-ring"
            >
              <Icon name="ArrowLeft" size="lg" aria-hidden />
            </Link>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">{copy.eyebrow}</p>
              <h1 className="font-headline text-3xl font-bold tracking-tight text-on-surface">{copy.heading}</h1>
            </div>
          </div>
          <AccountTabs active={ROUTES.TEACHER.ACCOUNT_SETTINGS} tabs={copy.tabs} label={copy.heading} />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-4xl gap-5 px-6 py-8 lg:px-10">
        <Section title={copy.profile}>
          <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-outline bg-surface text-lg font-bold text-primary">
              {account.avatarUrl ? (
                <Image src={account.avatarUrl} alt={account.name} width={64} height={64} className="h-full w-full object-cover" />
              ) : (
                initials(account.name)
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold text-on-surface">{account.name}</p>
              <p className="text-sm text-on-surface-variant">{copy.teacherRole}</p>
            </div>
            <Badge tone="neutral">{copy.unavailable}</Badge>
          </div>
          <TextRow label={copy.firstName} value={firstName} readOnly={copy.readOnly} />
          <TextRow label={copy.lastName} value={lastName || copy.unavailable} readOnly={copy.readOnly} />
          <TextRow label={copy.displayName} value={account.name} readOnly={copy.readOnly} />
          <TextRow label={copy.email} value={account.email} readOnly={copy.readOnly} />
          <ActionRow label={copy.preferredLanguage} value={languageLabel} action={copy.manage} href={ROUTES.TEACHER.LANGUAGE} />
          <TextRow label={copy.phone} value={copy.noPhone} readOnly={copy.readOnly} />
          <ActionRow label={copy.password} action={copy.unavailable} />
          <ToggleRow label={copy.mfa} description={copy.manage} unavailable={copy.unavailable} />
        </Section>

        <div className="grid gap-5 lg:grid-cols-2">
          <Section title={copy.schools}>
            <ActionRow label={copy.schoolDirectory} action={copy.manage} href={ROUTES.TEACHER.ACCOUNT_SCHOOL} />
            <ActionRow label={copy.classes} value={copy.currentClasses} action={copy.unavailable} />
          </Section>

          <Section title={copy.premiumHeading}>
            <div className="flex flex-col gap-3 px-5 py-5">
              <Button href={ROUTES.TEACHER.TRIAL}>{copy.tryTrial}</Button>
              <ActionRow label={copy.previewPremium} action={copy.unavailable} />
              <ActionRow label={copy.learnMore} action={copy.unavailable} />
              <ActionRow label={copy.manageSubscription} action={copy.unavailable} />
            </div>
          </Section>
        </div>

        <Section title={copy.notifications}>
          <SelectRow label={copy.officeHours} value={copy.manage} readOnly={copy.readOnly} />
          <ToggleRow label={copy.emailNotifications} description={copy.tips} unavailable={copy.unavailable} />
          <ToggleRow label={copy.pushNotifications} description={copy.parentNotifications} unavailable={copy.unavailable} />
          <ToggleRow label={copy.smsNotifications} unavailable={copy.unavailable} />
        </Section>

        <div className="grid gap-5 lg:grid-cols-2">
          <Section title={copy.archives}>
            <ActionRow label={copy.downloadArchives} action={copy.unavailable} />
            <ActionRow label={copy.archivedClasses} value={copy.manageArchived} action={copy.unavailable} />
          </Section>

          <Section title={copy.privacy}>
            <ActionRow label={copy.accountActivity} action={copy.unavailable} />
            <ActionRow label={copy.coppa} action={copy.unavailable} />
            <div className="flex min-h-14 items-center justify-between gap-3 px-5 py-3">
              <span className="text-sm font-semibold text-error">{copy.deleteAccount}</span>
              <Badge tone="danger">{copy.unavailable}</Badge>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
