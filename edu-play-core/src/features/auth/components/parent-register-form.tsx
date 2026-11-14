'use client';

import { useState, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { parentRegisterSchema, type ParentRegisterFormData } from '../schemas/parent-login.schema';
import { parentRegister } from '../actions/parent-register';
import { AuthButton } from './auth-button';
import { PasswordStrengthIndicator } from './password-strength-indicator';
import { TextField, Checkbox } from '@/shared/components/ui/kit';
import { Icon } from '@/shared/components/ui/Icon';

export function ParentRegisterForm() {
  const { t } = useTranslation('auth');
  const [isPending, startTransition] = useTransition();
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);

  const form = useForm<ParentRegisterFormData>({
    resolver: zodResolver(parentRegisterSchema),
    defaultValues: {
      inviteCode: '',
    },
  });

  const passwordValue = useWatch({ control: form.control, name: 'password' }) ?? '';
  const inviteCodeValue = useWatch({ control: form.control, name: 'inviteCode' }) ?? '';

  const onSubmit = async (data: ParentRegisterFormData) => {
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
    if (data.phoneNumber) formData.append('phoneNumber', data.phoneNumber);
    if (data.inviteCode) formData.append('inviteCode', data.inviteCode);

    startTransition(async () => {
      try {
        await parentRegister(formData);
      } catch (error) {
        form.setError('root', {
          message:
            error instanceof Error ? error.message : t('registerParent.form.fallbackError'),
        });
      }
    });
  };

  const inviteRegister = form.register('inviteCode', {
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      const cleaned = event.target.value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 8);
      form.setValue('inviteCode', cleaned, { shouldValidate: cleaned.length > 0 });
    },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <TextField
        icon="IdentificationBadge"
        label={t('registerParent.form.fullNameLabel')}
        autoComplete="name"
        placeholder={t('registerParent.form.fullNamePlaceholder')}
        disabled={isPending}
        error={form.formState.errors.fullName?.message}
        {...form.register('fullName')}
      />

      <TextField
        icon="Envelope"
        label={t('registerParent.form.emailLabel')}
        type="email"
        autoComplete="email"
        placeholder={t('registerParent.form.emailPlaceholder')}
        disabled={isPending}
        error={form.formState.errors.email?.message}
        {...form.register('email')}
      />

      <div>
        <TextField
          icon="Lock"
          label={t('registerParent.form.passwordLabel')}
          type="password"
          autoComplete="new-password"
          placeholder={t('registerParent.form.passwordPlaceholder')}
          disabled={isPending}
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />
        {passwordValue && <PasswordStrengthIndicator password={passwordValue} />}
      </div>

      <TextField
        icon="ShieldCheck"
        label={t('registerParent.form.confirmPasswordLabel')}
        type="password"
        autoComplete="new-password"
        placeholder={t('registerParent.form.confirmPasswordPlaceholder')}
        disabled={isPending}
        error={form.formState.errors.confirmPassword?.message}
        {...form.register('confirmPassword')}
      />

      <TextField
        icon="Phone"
        label={t('registerParent.form.phoneLabel')}
        type="tel"
        autoComplete="tel"
        placeholder={t('registerParent.form.phonePlaceholder')}
        disabled={isPending}
        error={form.formState.errors.phoneNumber?.message}
        {...form.register('phoneNumber')}
      />

      <TextField
        icon="Ticket"
        label={t('registerParent.form.inviteCodeLabel')}
        placeholder={t('registerParent.form.inviteCodePlaceholder')}
        disabled={isPending}
        maxLength={8}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        error={form.formState.errors.inviteCode?.message}
        helper={
          inviteCodeValue.length > 0
            ? t('registerParent.form.inviteCodeCount', { count: inviteCodeValue.length })
            : t('registerParent.form.inviteCodeHelp')
        }
        {...inviteRegister}
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
        {isPending
          ? t('registerParent.form.submitting')
          : t('registerParent.form.submit')}
      </AuthButton>
    </form>
  );
}
