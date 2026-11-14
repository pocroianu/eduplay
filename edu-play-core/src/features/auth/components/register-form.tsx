'use client';

import { useState, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { registerSchema, type RegisterFormData } from '../schemas/register.schema';
import { register as registerAction } from '../actions/register';
import { AuthButton } from './auth-button';
import { PasswordStrengthIndicator } from './password-strength-indicator';
import { TextField, Checkbox } from '@/shared/components/ui/kit';
import { Icon } from '@/shared/components/ui/Icon';

export function RegisterForm() {
  const { t } = useTranslation('auth');
  const [isPending, startTransition] = useTransition();
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: 'teacher',
    },
  });

  const passwordValue = useWatch({ control: form.control, name: 'password' }) ?? '';

  const onSubmit = async (data: RegisterFormData) => {
    if (!privacyAccepted) {
      setPrivacyError(t('register.form.privacyError'));
      return;
    }
    setPrivacyError(null);

    const formData = new FormData();
    formData.append('email', data.email);
    formData.append('password', data.password);
    formData.append('confirmPassword', data.confirmPassword);
    formData.append('fullName', data.fullName);
    formData.append('role', 'teacher');

    startTransition(async () => {
      try {
        await registerAction(formData);
      } catch (error) {
        form.setError('root', {
          message: error instanceof Error ? error.message : t('register.form.fallbackError'),
        });
      }
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <TextField
        icon="IdentificationBadge"
        label={t('register.form.fullNameLabel')}
        autoComplete="name"
        placeholder={t('register.form.fullNamePlaceholder')}
        disabled={isPending}
        error={form.formState.errors.fullName?.message}
        {...form.register('fullName')}
      />

      <TextField
        icon="Envelope"
        label={t('register.form.emailLabel')}
        type="email"
        autoComplete="email"
        placeholder={t('register.form.emailPlaceholder')}
        disabled={isPending}
        error={form.formState.errors.email?.message}
        {...form.register('email')}
      />

      <div>
        <TextField
          icon="Lock"
          label={t('register.form.passwordLabel')}
          type="password"
          autoComplete="new-password"
          placeholder={t('register.form.passwordPlaceholder')}
          disabled={isPending}
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />
        {passwordValue && <PasswordStrengthIndicator password={passwordValue} />}
      </div>

      <TextField
        icon="ShieldCheck"
        label={t('register.form.confirmPasswordLabel')}
        type="password"
        autoComplete="new-password"
        placeholder={t('register.form.confirmPasswordPlaceholder')}
        disabled={isPending}
        error={form.formState.errors.confirmPassword?.message}
        {...form.register('confirmPassword')}
      />

      <Checkbox
        label={t('register.form.privacyAccept')}
        checked={privacyAccepted}
        onChange={(event) => {
          setPrivacyAccepted(event.target.checked);
          if (event.target.checked) setPrivacyError(null);
        }}
        error={privacyError ?? undefined}
        disabled={isPending}
      />

      {form.formState.errors.root && (
        <div
          role="alert"
          className="flex items-center gap-2 p-3 rounded-2xl bg-error-soft text-error text-sm font-medium"
        >
          <Icon name="XCircle" aria-hidden />
          <span>{form.formState.errors.root.message}</span>
        </div>
      )}

      <AuthButton type="submit" isPending={isPending}>
        {isPending ? t('register.form.submitting') : t('register.form.submit')}
      </AuthButton>
    </form>
  );
}
