import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthShell } from '@/shared/components/ui/kit';
import { AuthInlineLink, ForgotPasswordForm } from '@/features/auth';
import { ROUTES } from '@/shared/lib/constants/routes';
import { Icon } from '@/shared/components/ui/Icon';
import { getServerLanguage, getServerTranslation } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLanguage();
  return {
    title: await getServerTranslation(lang, 'auth', 'forgotPassword.metadata.title'),
    description: await getServerTranslation(
      lang,
      'auth',
      'forgotPassword.metadata.description',
    ),
  };
}

export default async function ForgotPasswordPage() {
  const lang = await getServerLanguage();
  const [
    title,
    subtitle,
    sectionLabel,
    heroLabel,
    heroTitle,
    heroBody,
  ] = await Promise.all([
    getServerTranslation(lang, 'auth', 'forgotPassword.page.title'),
    getServerTranslation(lang, 'auth', 'forgotPassword.page.subtitle'),
    getServerTranslation(lang, 'auth', 'forgotPassword.page.sectionLabel'),
    getServerTranslation(lang, 'auth', 'forgotPassword.page.hero.label'),
    getServerTranslation(lang, 'auth', 'forgotPassword.page.hero.title'),
    getServerTranslation(lang, 'auth', 'forgotPassword.page.hero.body'),
  ]);

  return (
    <AuthShell
      title={title}
      subtitle={subtitle}
      heroSlot={
        <ForgotPasswordHero
          label={heroLabel}
          title={heroTitle}
          body={heroBody}
        />
      }
      footerSlot={<ForgotPasswordFooter />}
      className="bg-surface-container"
    >
      <section className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
        <div className="border-b border-outline-variant px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            {sectionLabel}
          </p>
        </div>
        <div className="p-4">
          <Suspense fallback={null}>
            <ForgotPasswordForm />
          </Suspense>
        </div>
      </section>
    </AuthShell>
  );
}

function ForgotPasswordHero({
  label,
  title,
  body,
}: {
  label: string;
  title: string;
  body: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
      <div className="border-b border-outline-variant px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          {label}
        </p>
      </div>
      <div className="flex items-start gap-3 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
          <Icon name="Key" size={22} aria-hidden />
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

async function ForgotPasswordFooter() {
  const lang = await getServerLanguage();
  const [prompt, backToLogin] = await Promise.all([
    getServerTranslation(lang, 'auth', 'forgotPassword.page.rememberedPrompt'),
    getServerTranslation(lang, 'auth', 'forgotPassword.page.backToLogin'),
  ]);

  return (
    <p className="text-center text-on-surface-variant font-medium">
      {prompt}{' '}
      <AuthInlineLink href={ROUTES.AUTH.LOGIN}>
        {backToLogin}
      </AuthInlineLink>
    </p>
  );
}
