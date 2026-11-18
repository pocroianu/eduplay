import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerLanguage, getServerTranslation } from '@/lib/i18n/server';
import type { Language } from '@/lib/i18n/config';
import { createClient } from '@/lib/supabase/server';
import { ROUTES } from '@/shared/lib/constants/routes';
import { Badge, Button, Card } from '@/shared/components/ui/kit';
import { Icon, type IconProps } from '@/shared/components/ui/Icon';

type HelpItem = {
  icon?: IconProps['name'];
  title: string;
  description?: string;
  href?: string;
  badge?: string;
};

async function t(lang: Language, key: string) {
  return getServerTranslation(lang, 'teacher', key);
}
function tc(lang: Language, key: string) {
  return getServerTranslation(lang, 'common', key);
}

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLanguage();
  return {
    title: await t(lang, 'utility.help.metadataTitle'),
  };
}

async function requireTeacher() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(ROUTES.AUTH.LOGIN);

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'teacher') {
    redirect(ROUTES.AUTH.LOGIN);
  }
}

function MenuRow({ item }: { item: HelpItem }) {
  const content = (
    <>
      {item.icon ? (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-deep" aria-hidden>
          <Icon name={item.icon} size="sm" />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-on-surface">{item.title}</span>
        {item.description ? <span className="block text-xs text-on-surface-variant">{item.description}</span> : null}
      </span>
      {item.badge ? <Badge tone="danger">{item.badge}</Badge> : null}
      {item.href ? <Icon name="CaretRight" size="sm" className="text-on-surface-variant" aria-hidden /> : null}
    </>
  );

  if (item.href) {
    return (
      <Link
        href={item.href}
        className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left">
      {content}
    </div>
  );
}

export default async function TeacherHelpPage() {
  await requireTeacher();

  const lang = await getServerLanguage();
  const [
    heading,
    subtitle,
    whatsNew,
    whatsNewCount,
    contactSupport,
    helpCenter,
    privacyPolicy,
    scanQr,
    languageSettings,
    accountSettings,
    mySchool,
    deviceInformation,
    trial,
    backToDashboard,
  ] = await Promise.all([
    t(lang, 'utility.help.heading'),
    t(lang, 'utility.help.subtitle'),
    t(lang, 'utility.help.whatsNew'),
    t(lang, 'utility.help.whatsNewCount'),
    t(lang, 'utility.help.contactSupport'),
    t(lang, 'utility.help.helpCenter'),
    t(lang, 'utility.help.privacyPolicy'),
    t(lang, 'utility.help.scanQr'),
    tc(lang, 'shell.sidebar.languageSettings'),
    tc(lang, 'shell.sidebar.accountSettings'),
    tc(lang, 'shell.sidebar.mySchool'),
    tc(lang, 'shell.sidebar.deviceInformation'),
    tc(lang, 'shell.sidebar.trial'),
    t(lang, 'utility.help.backToDashboard'),
  ]);

  const primaryItems: HelpItem[] = [
    { title: contactSupport, href: 'mailto:support@eduplay.ro' },
    { title: helpCenter, href: ROUTES.HOME },
    { title: privacyPolicy, href: ROUTES.HOME },
    { title: scanQr, href: ROUTES.TEACHER.SCAN },
  ];
  const utilityItems: HelpItem[] = [
    { icon: 'SlidersHorizontal', title: languageSettings, href: ROUTES.TEACHER.LANGUAGE },
    { icon: 'RocketLaunch', title: trial, href: ROUTES.TEACHER.TRIAL },
    { icon: 'Wrench', title: accountSettings, href: ROUTES.TEACHER.ACCOUNT_SETTINGS },
    { icon: 'GraduationCap', title: mySchool, href: ROUTES.TEACHER.ACCOUNT_SCHOOL },
    { icon: 'HardDrives', title: deviceInformation, href: ROUTES.TEACHER.ACCOUNT_DEVICE },
  ];

  return (
    <div className="min-h-screen bg-surface-container px-4 py-8 text-on-surface sm:px-6 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-start justify-center">
        <Card className="w-full overflow-hidden border border-outline-variant bg-surface-container-lowest" padding="none">
          <div className="flex items-center justify-between gap-4 border-b border-outline-variant px-5 py-4">
            <div>
              <h1 className="font-headline text-2xl font-bold text-on-surface">{heading}</h1>
              <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>
            </div>
            <Button href={ROUTES.TEACHER.DASHBOARD} variant="icon" size="sm" aria-label={backToDashboard}>
              <Icon name="X" size="sm" aria-hidden />
            </Button>
          </div>

          <div className="border-b border-outline-variant bg-surface px-5 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">{whatsNew}</p>
            <p className="mt-1 text-sm font-semibold text-on-surface">{whatsNewCount}</p>
          </div>

          <nav aria-label={heading} className="divide-y divide-outline-variant">
            {primaryItems.map((item) => (
              <MenuRow key={item.title} item={item} />
            ))}
          </nav>

          <nav aria-label={accountSettings} className="border-t border-outline-variant bg-surface px-2 py-2">
            {utilityItems.map((item) => (
              <MenuRow key={item.href} item={item} />
            ))}
          </nav>
        </Card>
      </div>
    </div>
  );
}
