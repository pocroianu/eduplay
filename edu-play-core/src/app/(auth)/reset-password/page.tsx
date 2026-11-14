import type { Metadata } from 'next';
import { AuthShell } from '@/shared/components/ui/kit';
import { AuthInlineLink, ResetPasswordForm, ResetPasswordError } from '@/features/auth';
import { ROUTES } from '@/shared/lib/constants/routes';
import { Icon } from '@/shared/components/ui/Icon';
import { getServerLanguage, getServerTranslation } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLanguage();
  return {
    title: await getServerTranslation(lang, 'auth', 'resetPassword.metadata.title'),
    description: await getServerTranslation(
      lang,
      'auth',
      'resetPassword.metadata.description',
    ),
  };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error_description?: string; error?: string }>;
}) {
  const params = await searchParams;
  const errorDescription = params.error_description;
  const error = params.error;
  const lang = await getServerLanguage();

  if (error || errorDescription) {
    const [errorTitle, errorSubtitle, errorSectionLabel, errorHeroLabel, errorHeroTitle, errorHeroBody] = await Promise.all([
      getServerTranslation(lang, 'auth', 'resetPassword.page.errorPageTitle'),
      getServerTranslation(lang, 'auth', 'resetPassword.page.errorPageSubtitle'),
      getServerTranslation(lang, 'auth', 'resetPassword.page.errorSectionLabel'),
      getServerTranslation(lang, 'auth', 'resetPassword.page.hero.label'),
      getServerTranslation(lang, 'auth', 'resetPassword.page.hero.errorTitle'),
      getServerTranslation(lang, 'auth', 'resetPassword.page.hero.errorBody'),
    ]);

    return (
      <AuthShell
        title={errorTitle}
        subtitle={errorSubtitle}
        heroSlot={
          <ResetPasswordHero
            variant="error"
            label={errorHeroLabel}
            title={errorHeroTitle}
            body={errorHeroBody}
          />
        }
        className="bg-surface-container"
      >
        <section className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
          <div className="border-b border-outline-variant px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {errorSectionLabel}
            </p>
          </div>
          <div className="p-4">
            <ResetPasswordError errorDescription={errorDescription} />
          </div>
        </section>
      </AuthShell>
    );
  }

  const [title, subtitle, sectionLabel, sectionDescription, heroLabel, heroTitle, heroBody] = await Promise.all([
    getServerTranslation(lang, 'auth', 'resetPassword.page.title'),
    getServerTranslation(lang, 'auth', 'resetPassword.page.subtitle'),
    getServerTranslation(lang, 'auth', 'resetPassword.page.sectionLabel'),
    getServerTranslation(lang, 'auth', 'resetPassword.page.sectionDescription'),
    getServerTranslation(lang, 'auth', 'resetPassword.page.hero.label'),
    getServerTranslation(lang, 'auth', 'resetPassword.page.hero.title'),
    getServerTranslation(lang, 'auth', 'resetPassword.page.hero.body'),
  ]);

  return (
    <AuthShell
      title={title}
      subtitle={subtitle}
      heroSlot={
        <ResetPasswordHero
          label={heroLabel}
          title={heroTitle}
          body={heroBody}
        />
      }
      footerSlot={<ResetPasswordFooter />}
      className="bg-surface-container"
    >
      <section className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
        <div className="border-b border-outline-variant px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            {sectionLabel}
          </p>
          <p className="mt-1 text-sm text-on-surface-variant">
            {sectionDescription}
          </p>
        </div>
        <div className="p-4">
          <ResetPasswordForm />
        </div>
      </section>
    </AuthShell>
  );
}

function ResetPasswordHero({
  variant = 'default',
  label,
  title,
  body,
}: {
  variant?: 'default' | 'error';
  label: string;
  title: string;
  body: string;
}) {
  const isError = variant === 'error';

  return (
    <div className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
      <div className="border-b border-outline-variant px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          {label}
        </p>
      </div>
      <div className="flex items-start gap-3 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
          <Icon name={isError ? 'Link' : 'Lock'} size={22} aria-hidden />
        </span>
        <div>
          <p className="font-headline text-xl font-semibold leading-tight text-on-surface">
            {title}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
            {body}
          </p>
        </div>
      </div>
    </div>
  );
}

async function ResetPasswordFooter() {
  const lang = await getServerLanguage();
  const backToLogin = await getServerTranslation(
    lang,
    'auth',
    'resetPassword.page.backToLogin',
  );

  return (
    <p className="text-center text-on-surface-variant font-medium">
      <AuthInlineLink href={ROUTES.AUTH.LOGIN}>
        {backToLogin}
      </AuthInlineLink>
    </p>
  );
}
