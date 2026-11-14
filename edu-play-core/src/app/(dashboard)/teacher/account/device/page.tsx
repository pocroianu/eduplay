import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Language } from '@/lib/i18n/config';
import { getServerLanguage, getServerTranslation } from '@/lib/i18n/server';
import { createClient } from '@/lib/supabase/server';
import { ROUTES } from '@/shared/lib/constants/routes';
import { Card } from '@/shared/components/ui/kit';
import { Icon, type IconProps } from '@/shared/components/ui/Icon';

type TeacherProfile = {
  id: string;
  role: string | null;
};

type AccountTab = {
  href: string;
  label: string;
  description: string;
  icon: IconProps['name'];
};

type DeviceCopy = {
  tabs: AccountTab[];
  back: string;
  eyebrow: string;
  heading: string;
  browserLine: string;
  copy: string;
};

async function t(lang: Language, key: string) {
  return getServerTranslation(lang, 'teacher', key);
}

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLanguage();
  return {
    title: await t(lang, 'account.device.metadataTitle'),
  };
}

async function getDeviceCopy(lang: Language): Promise<DeviceCopy> {
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
    browserLine,
    copy,
  ] = await Promise.all([
    t(lang, 'account.tabs.settings'),
    t(lang, 'account.tabs.settingsDescription'),
    t(lang, 'account.tabs.school'),
    t(lang, 'account.tabs.schoolDescription'),
    t(lang, 'account.tabs.device'),
    t(lang, 'account.tabs.deviceDescription'),
    t(lang, 'account.device.back'),
    t(lang, 'account.device.eyebrow'),
    t(lang, 'account.device.heading'),
    t(lang, 'account.device.browserLine'),
    t(lang, 'account.device.copy'),
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
    browserLine,
    copy,
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
    .single<TeacherProfile>();

  if (!profile || profile.role !== 'teacher') {
    redirect(ROUTES.AUTH.LOGIN);
  }
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

function getBrowserSummary(userAgent: string) {
  const edge = userAgent.match(/Edg\/(\d+)/);
  if (edge) return { name: 'Microsoft Edge', version: edge[1] ?? '' };

  const chrome = userAgent.match(/Chrome\/(\d+)/);
  if (chrome) return { name: 'Chrome', version: chrome[1] ?? '' };

  const firefox = userAgent.match(/Firefox\/(\d+)/);
  if (firefox) return { name: 'Firefox', version: firefox[1] ?? '' };

  if (userAgent.includes('Safari/')) return { name: 'Safari', version: '' };

  return { name: 'Browser necunoscut', version: '' };
}

function interpolate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replace(`{{${key}}}`, value), template);
}

export default async function TeacherAccountDevicePage() {
  await requireTeacher();

  const [headerList, lang] = await Promise.all([headers(), getServerLanguage()]);
  const copy = await getDeviceCopy(lang);
  const userAgent = headerList.get('user-agent') || '';
  const browser = getBrowserSummary(userAgent);
  const browserLine = interpolate(copy.browserLine, { browser: browser.name, version: browser.version });

  return (
    <main className="min-h-screen bg-surface text-on-surface">
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
          <AccountTabs active={ROUTES.TEACHER.ACCOUNT_DEVICE} tabs={copy.tabs} label={copy.heading} />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-xl px-6 py-8 lg:px-10">
        <Card className="w-full overflow-hidden border border-outline-variant bg-surface-container-lowest" padding="none" shadow={false}>
          <div className="flex items-center justify-between gap-4 border-b border-outline-variant px-5 py-4">
            <h2 className="font-headline text-2xl font-semibold text-on-surface">{copy.heading}</h2>
            <Link
              href={ROUTES.TEACHER.DASHBOARD}
              aria-label={copy.back}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Icon name="X" size="sm" aria-hidden />
            </Link>
          </div>
          <div className="grid gap-4 bg-surface-container px-5 py-5">
            <div className="flex items-center gap-3 rounded-lg bg-surface px-4 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-deep">
                <Icon name="HardDrives" size="lg" aria-hidden />
              </span>
              <p className="text-base font-semibold text-on-surface">{browserLine}</p>
            </div>
            <pre data-device-info className="max-h-52 overflow-auto rounded-lg border border-outline-variant bg-surface p-4 text-xs leading-relaxed text-on-surface-variant [overflow-wrap:anywhere] whitespace-pre-wrap">{userAgent}</pre>
            <button
              type="button"
              data-copy-device-info
              className="inline-flex min-h-9 w-fit items-center justify-center gap-2 rounded-lg bg-surface-container-lowest px-3 text-sm font-bold text-on-surface shadow-soft-sm transition-colors hover:bg-primary-soft hover:text-primary-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Icon name="Copy" size="sm" aria-hidden />
              {copy.copy}
            </button>
          </div>
        </Card>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `(() => { const button = document.querySelector('[data-copy-device-info]'); const info = document.querySelector('[data-device-info]'); if (!button || !info) return; button.addEventListener('click', async () => { const text = info.textContent || ''; if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text.trim()); return; } const field = document.createElement('textarea'); field.value = text.trim(); field.setAttribute('readonly', ''); field.style.position = 'fixed'; field.style.opacity = '0'; document.body.appendChild(field); field.select(); document.execCommand('copy'); field.remove(); }); })();`,
        }}
      />
    </main>
  );
}
