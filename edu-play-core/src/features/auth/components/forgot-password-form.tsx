'use client';

import { Button as MantineButton, MantineContext, MantineProvider } from '@mantine/core';
import { useContext, useState, useTransition, type ReactNode } from 'react';
import NextLink from 'next/link';
import { useForm, type UseFormRegisterReturn, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  forgotPasswordSchema,
  type ForgotPasswordFormData,
} from '../schemas/forgot-password.schema';
import { requestPasswordReset } from '../actions/request-password-reset';
import { TextField } from '@/shared/components/ui/kit';
import { ROUTES } from '@/shared/lib/constants/routes';
import { Icon } from '@/shared/components/ui/Icon';

function maskEmail(email: string): string {
  const match = /^([^@]+)@(.+)$/.exec(email);
  if (!match) return email;
  return `${maskEmailLocalPart(match[1])}@${match[2]}`;
}

function maskEmailLocalPart(local: string): string {
  return `${local.slice(0, 2)}***`;
}

type ResetRequestResult = Awaited<ReturnType<typeof requestPasswordReset>>;

interface ResetStateSetters {
  setIsSuccess: (value: boolean) => void;
  setServerError: (value: string | null) => void;
  setSubmittedEmail: (value: string) => void;
}

export function ForgotPasswordForm() {
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string>('');
  const [serverError, setServerError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email');
  const mantineContext = useContext(MantineContext);
  const { isPending, onSubmit } = useForgotPasswordSubmit({
    setIsSuccess,
    setServerError,
    setSubmittedEmail,
  });

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: emailParam ?? '' },
  });

  const content = isSuccess ? (
    <ForgotPasswordSuccess
      submittedEmail={submittedEmail}
      onResend={() => {
        setIsSuccess(false);
        setServerError(null);
      }}
    />
  ) : (
    <ForgotPasswordRequestForm
      form={form}
      onSubmit={onSubmit}
      serverError={serverError}
      isPending={isPending}
      autoFocusEmail={!emailParam}
    />
  );

  return withOptionalMantineProvider(content, Boolean(mantineContext));
}

function useForgotPasswordSubmit({
  setIsSuccess,
  setServerError,
  setSubmittedEmail,
}: ResetStateSetters) {
  const { t } = useTranslation('auth');
  const [isPending, startTransition] = useTransition();

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setServerError(null);
    setIsSuccess(false);

    startTransition(async () => {
      const result = await requestPasswordReset(toResetRequestFormData(data.email));
      handleResetRequestResult(result, data.email, {
        fallbackError: t('forgotPassword.form.fallbackError'),
        setIsSuccess,
        setServerError,
        setSubmittedEmail,
      });
    });
  };

  return { isPending, onSubmit };
}

function toResetRequestFormData(email: string) {
  const formData = new FormData();
  formData.append('email', email);
  return formData;
}

function handleResetRequestResult(
  result: ResetRequestResult,
  email: string,
  options: ResetStateSetters & { fallbackError: string },
) {
  if (result.success) {
    options.setSubmittedEmail(email);
    options.setIsSuccess(true);
    return;
  }

  options.setServerError(result.error ?? options.fallbackError);
}

function withOptionalMantineProvider(content: ReactNode, hasProvider: boolean) {
  return hasProvider ? content : <MantineProvider>{content}</MantineProvider>;
}

function ForgotPasswordRequestForm({
  form,
  onSubmit,
  serverError,
  isPending,
  autoFocusEmail,
}: {
  form: UseFormReturn<ForgotPasswordFormData>;
  onSubmit: (data: ForgotPasswordFormData) => Promise<void>;
  serverError: string | null;
  isPending: boolean;
  autoFocusEmail: boolean;
}) {
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <ForgotPasswordInstructions />
      {serverError && <ForgotPasswordServerError message={serverError} />}
      <ForgotPasswordEmailField
        field={form.register('email')}
        error={form.formState.errors.email?.message}
        disabled={isPending}
        autoFocus={autoFocusEmail}
      />
      <ForgotPasswordSubmitRow isPending={isPending} />
    </form>
  );
}

function ForgotPasswordSuccess({
  submittedEmail,
  onResend,
}: {
  submittedEmail: string;
  onResend: () => void;
}) {
  const { t } = useTranslation('auth');

  return (
    <div className="flex flex-col gap-4" data-testid="success-message">
      <div className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
        <div className="border-b border-outline-variant px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            {t('forgotPassword.form.success.label')}
          </p>
        </div>
        <div className="flex items-start gap-3 p-4">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary"
          >
            <Icon name="Envelope" weight="fill" size={22} />
          </span>
          <div>
            <h3 className="font-headline text-lg font-semibold text-on-surface">
              {t('forgotPassword.form.success.title')}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
              {t('forgotPassword.form.success.bodyPrefix')}{' '}
              <span className="font-semibold text-on-surface">
                {maskEmail(submittedEmail)}
              </span>
              {t('forgotPassword.form.success.bodySuffix')}
            </p>
          </div>
        </div>
      </div>
      <ForgotPasswordSuccessActions onResend={onResend} />
    </div>
  );
}

function ForgotPasswordSuccessActions({ onResend }: { onResend: () => void }) {
  const { t } = useTranslation('auth');

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
      <MantineButton type="button" onClick={onResend} variant="outline" color="purple" size="sm">
        {t('forgotPassword.form.success.resend')}
      </MantineButton>
      <MantineButton
        component={NextLink}
        href={ROUTES.AUTH.LOGIN}
        variant="subtle"
        color="purple"
        size="sm"
        leftSection={<Icon name="ArrowLeft" size={16} aria-hidden />}
      >
        {t('forgotPassword.form.success.backToLogin')}
      </MantineButton>
    </div>
  );
}

function ForgotPasswordInstructions() {
  const { t } = useTranslation('auth');

  return (
    <p className="text-sm leading-relaxed text-on-surface-variant">
      {t('forgotPassword.form.instructions')}
    </p>
  );
}

function ForgotPasswordServerError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      data-testid="error-message"
      className="flex items-center gap-2 rounded-md border border-error bg-error-soft p-3 text-sm font-medium text-error"
    >
      <Icon name="XCircle" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

function ForgotPasswordEmailField({
  field,
  error,
  disabled,
  autoFocus,
}: {
  field: UseFormRegisterReturn<'email'>;
  error?: string;
  disabled: boolean;
  autoFocus: boolean;
}) {
  const { t } = useTranslation('auth');

  return (
    <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-3">
      <TextField
        icon="Envelope"
        label={t('forgotPassword.form.emailLabel')}
        type="email"
        autoComplete="email"
        placeholder={t('forgotPassword.form.emailPlaceholder')}
        disabled={disabled}
        autoFocus={autoFocus}
        data-testid="email-input"
        error={error}
        {...field}
      />
    </div>
  );
}

function ForgotPasswordSubmitRow({ isPending }: { isPending: boolean }) {
  const { t } = useTranslation('auth');

  return (
    <div className="flex justify-end border-t border-outline-variant pt-4">
      <MantineButton
        type="submit"
        disabled={isPending}
        aria-busy={isPending || undefined}
        data-testid="submit-button"
        color="purple"
        className="w-full sm:w-auto"
      >
        {isPending ? t('forgotPassword.form.submitting') : t('forgotPassword.form.submit')}
      </MantineButton>
    </div>
  );
}
