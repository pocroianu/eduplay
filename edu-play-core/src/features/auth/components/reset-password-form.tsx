'use client';

import { useState, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import {
  resetPasswordSchema,
  type ResetPasswordFormData,
} from '../schemas/reset-password.schema';
import { resetPassword } from '../actions/reset-password';
import { AuthInlineLink } from './auth-inline-link';
import { PasswordStrengthIndicator } from './password-strength-indicator';
import { AuthButton } from './auth-button';
import { TextField } from '@/shared/components/ui/kit';
import { ROUTES } from '@/shared/lib/constants/routes';
import { Icon } from '@/shared/components/ui/Icon';

export function ResetPasswordForm() {
  const { t } = useTranslation('auth');
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
    mode: 'onChange',
  });

  const watchedPassword =
    useWatch({
      control: form.control,
      name: 'password',
    }) ?? '';

  const onSubmit = async (data: ResetPasswordFormData) => {
    setServerError(null);

    const formData = new FormData();
    formData.append('password', data.password);
    formData.append('confirmPassword', data.confirmPassword);

    startTransition(async () => {
      try {
        const result = await resetPassword(formData);
        if (!result.success) {
          setServerError(
            result.error || t('resetPassword.form.fallbackError'),
          );
        }
      } catch (error) {
        if (error instanceof Error && !error.message.includes('NEXT_REDIRECT')) {
          setServerError(t('resetPassword.form.unexpectedError'));
        }
      }
    });
  };

  const tokenExpired =
    serverError !== null &&
    (serverError.includes('expirat') || serverError.includes('invalid'));

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {serverError && (
        <div
          role="alert"
          data-testid="error-message"
          className="flex items-start gap-2 p-3 rounded-2xl bg-error-soft text-error text-sm font-medium"
        >
          <Icon name="XCircle" className="flex-shrink-0" aria-hidden />
          <div className="flex flex-col">
            <span>{serverError}</span>
            {tokenExpired && (
              <AuthInlineLink
                href={ROUTES.AUTH.FORGOT_PASSWORD}
                className="mt-1"
              >
                {t('resetPassword.form.expiredLinkRecovery')}
              </AuthInlineLink>
            )}
          </div>
        </div>
      )}

      <div>
        <TextField
          icon="Lock"
          label={t('resetPassword.form.passwordLabel')}
          type="password"
          autoComplete="new-password"
          placeholder={t('resetPassword.form.passwordPlaceholder')}
          disabled={isPending}
          data-testid="password-input"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />
        {watchedPassword && <PasswordStrengthIndicator password={watchedPassword} />}
      </div>

      <TextField
        icon="ShieldCheck"
        label={t('resetPassword.form.confirmPasswordLabel')}
        type="password"
        autoComplete="new-password"
        placeholder={t('resetPassword.form.confirmPasswordPlaceholder')}
        disabled={isPending}
        data-testid="confirm-password-input"
        error={form.formState.errors.confirmPassword?.message}
        {...form.register('confirmPassword')}
      />

      <AuthButton type="submit" isPending={isPending} data-testid="submit-button">
        {isPending ? t('resetPassword.form.submitting') : t('resetPassword.form.submit')}
      </AuthButton>
    </form>
  );
}
