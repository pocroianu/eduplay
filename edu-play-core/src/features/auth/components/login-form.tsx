'use client';

import { useTransition } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { loginSchema, type LoginFormData } from '../schemas/login.schema';
import { login } from '../actions/login';
import { AuthInlineLink } from './auth-inline-link';
import { AuthButton } from './auth-button';
import { TextField } from '@/shared/components/ui/kit';
import { ROUTES } from '@/shared/lib/constants/routes';
import { Icon } from '@/shared/components/ui/Icon';

export interface LoginFormProps {
  /** Optional test id prefix, used so teacher + parent forms can be targeted separately. */
  idPrefix?: string;
}

export function LoginForm({ idPrefix = 'teacher' }: LoginFormProps) {
  const { t } = useTranslation('auth');
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    const formData = new FormData();
    formData.append('email', data.email);
    formData.append('password', data.password);

    startTransition(async () => {
      try {
        await login(formData);
      } catch (error) {
        unstable_rethrow(error);
        form.setError('root', {
          message: error instanceof Error ? error.message : t('login.form.fallbackError'),
        });
      }
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 rounded-xl bg-surface-container-lowest">
      <TextField
        icon="Envelope"
        label={t('login.form.emailLabel')}
        type="email"
        autoComplete="email"
        placeholder={t('login.form.emailPlaceholder')}
        disabled={isPending}
        error={form.formState.errors.email?.message}
        {...form.register('email')}
      />

      <TextField
        icon="Lock"
        label={t('login.form.passwordLabel')}
        type="password"
        autoComplete="current-password"
        placeholder={t('login.form.passwordPlaceholder')}
        disabled={isPending}
        error={form.formState.errors.password?.message}
        {...form.register('password')}
      />

      <div className="flex justify-end">
        <AuthInlineLink
          href={ROUTES.AUTH.FORGOT_PASSWORD}
          className="text-sm"
          data-testid={`${idPrefix}-forgot-password-link`}
        >
          {t('login.form.forgotPasswordLink')}
        </AuthInlineLink>
      </div>

      {form.formState.errors.root && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-error bg-error-soft p-3 text-sm font-medium text-error"
        >
          <Icon name="XCircle" aria-hidden />
          <span>{form.formState.errors.root.message}</span>
        </div>
      )}

      <AuthButton type="submit" isPending={isPending}>
        {isPending ? t('login.form.submitting') : t('login.form.submit')}
      </AuthButton>
    </form>
  );
}
