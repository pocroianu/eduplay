'use client';

import { useId, useState, useTransition } from 'react';
import Image from 'next/image';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Icon } from '@/shared/components/ui/Icon';
import {
  Button,
  Card,
  FilterSelect,
  TextField,
  type FilterSelectOption,
} from '@/shared/components/ui/kit';
import { fadeInUp } from '@/config/animations';
import { linkChildSchema, type LinkChildInput } from '../schemas/link-child.schema';
import { linkParentToChild } from '../actions/link-child';
import { ROUTES } from '@/shared/lib/constants';

/** Relationship type options with Romanian labels. */
const RELATIONSHIP_OPTIONS: FilterSelectOption[] = [
  { value: 'mother', label: 'Mama' },
  { value: 'father', label: 'Tata' },
  { value: 'guardian', label: 'Tutore legal' },
  { value: 'other', label: 'Altă relație' },
];

interface LinkChildFormProps {
  /** Optional callback invoked on successful link (instead of redirect). */
  onSuccess?: (studentName: string) => void;
}

/**
 * LinkChildForm - Parent UI component for linking to a child using an invite code.
 *
 * Parents enter an 8-character invite code (auto-formatted to uppercase) and
 * select their relationship type. On success, shows the student name with a
 * celebration animation before redirecting to the parent dashboard.
 */
export function LinkChildForm({ onSuccess }: LinkChildFormProps) {
  const [isPending, startTransition] = useTransition();
  const [linkedStudent, setLinkedStudent] = useState<{
    name: string;
    avatarUrl?: string | null;
  } | null>(null);
  const relationshipFieldId = useId();
  const relationshipErrorId = `${relationshipFieldId}-error`;
  const router = useRouter();

  const form = useForm<LinkChildInput>({
    resolver: zodResolver(linkChildSchema),
    defaultValues: {
      inviteCode: '',
      relationshipType: undefined,
    },
  });

  const inviteCodeValue =
    useWatch({
      control: form.control,
      name: 'inviteCode',
    }) ?? '';

  const onSubmit = (data: LinkChildInput) => {
    startTransition(async () => {
      let result;
      try {
        result = await linkParentToChild(data);
      } catch {
        form.setError('inviteCode', { message: 'Nu s-a putut conecta contul. Încearcă din nou.' });
        return;
      }

      if (!result.success) {
        form.setError('inviteCode', { message: result.error ?? 'Nu s-a putut conecta contul' });
        return;
      }

      if (!result.data) {
        form.setError('inviteCode', { message: 'Răspuns invalid de la server' });
        return;
      }

      setLinkedStudent({
        name: result.data.studentName,
        avatarUrl: result.data.studentAvatarUrl,
      });

      if (onSuccess) {
        onSuccess(result.data.studentName);
      } else {
        // Redirect to parent dashboard after a short delay for animation
        setTimeout(() => {
          router.push(ROUTES.PARENT.DASHBOARD);
        }, 2500);
      }
    });
  };

  // Success state
  if (linkedStudent) {
    return (
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
      >
        <Card className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-soft-sm">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="text-primary">
              <Icon name="CheckCircle" size={48} weight="fill" />
            </div>
            <div
              className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary-soft text-xl font-bold text-primary-deep"
            >
              {linkedStudent.avatarUrl ? (
                <Image src={linkedStudent.avatarUrl} alt={linkedStudent.name} fill className="object-cover" />
              ) : (
                linkedStudent.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex flex-col items-center gap-1">
              <h3 className="text-center text-lg font-bold text-primary-deep">
                Conectare reușită!
              </h3>
              <p className="text-center text-base font-semibold text-on-surface">
                Te-ai conectat la profilul lui{' '}
                <span className="font-bold">
                  {linkedStudent.name}
                </span>
              </p>
            </div>
            {!onSuccess && (
              <p className="text-center text-sm text-on-surface-variant">
                Te redirecționăm către pagina principală...
              </p>
            )}
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
    >
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-soft-sm">
          <div className="border-b border-outline-variant px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary-deep">
              Pasul 1
            </p>
            <h2 className="mt-1 text-xl font-bold text-on-surface">
              Introdu codul de familie
            </h2>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              Codul are 8 caractere și vine de la profesorul copilului.
            </p>
          </div>

          <div className="flex flex-col gap-5 p-5">
            <TextField
              label="Cod invitație"
              placeholder="Ex: ABCD1234"
              className="[&_input]:text-center [&_input]:font-mono [&_input]:text-xl [&_input]:font-bold [&_input]:tracking-[0.2em] [&_input]:uppercase"
              maxLength={8}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={isPending}
              error={form.formState.errors.inviteCode?.message}
              helper={(
                <span className="flex items-center justify-between gap-3">
                  <span>Introdu codul exact cum apare în invitație.</span>
                  <span
                    className={inviteCodeValue.length === 8 ? 'text-primary' : 'text-outline'}
                    aria-live="polite"
                  >
                    {inviteCodeValue.length}/8
                  </span>
                </span>
              )}
              {...form.register('inviteCode', {
                onChange: (e) => {
                  const cleaned = e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, '')
                    .slice(0, 8);
                  form.setValue('inviteCode', cleaned, { shouldValidate: true });
                },
              })}
            />

            <div className="space-y-2">
              <Controller
                control={form.control}
                name="relationshipType"
                render={({ field }) => (
                  <FilterSelect
                    label="Relație"
                    inputId={relationshipFieldId}
                    icon="Users"
                    value={field.value ?? ''}
                    onChange={(value) => {
                      field.onChange(value as LinkChildInput['relationshipType']);
                    }}
                    onBlur={field.onBlur}
                    options={RELATIONSHIP_OPTIONS}
                    placeholder="Selectează relația cu copilul"
                    disabled={isPending}
                    invalid={Boolean(form.formState.errors.relationshipType)}
                    ariaDescribedBy={
                      form.formState.errors.relationshipType
                        ? relationshipErrorId
                        : undefined
                    }
                    fullWidth
                    radius="md"
                    width="100%"
                  />
                )}
              />
              {form.formState.errors.relationshipType?.message ? (
                <p
                  id={relationshipErrorId}
                  role="alert"
                  className="ml-1 flex items-center gap-1.5 text-sm text-error"
                >
                  <Icon name="XCircle" size={14} weight="fill" aria-hidden className="shrink-0" />
                  {form.formState.errors.relationshipType.message}
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-outline-variant bg-surface-alt p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-on-surface">
                <Icon name="Info" size={16} aria-hidden />
                Ai nevoie de ajutor?
              </div>
              <p className="text-sm leading-6 text-on-surface-variant">
                Dacă nu ai primit codul, solicită-l profesorului copilului. Codul conectează contul tău de părinte la profilul elevului.
              </p>
            </div>

            <Button
              type="submit"
              fullWidth
              isPending={isPending}
              aria-label="Conectează-te la profilul copilului"
            >
              {isPending ? 'Se conectează...' : 'Conectează copilul'}
            </Button>
          </div>
        </div>
      </form>
    </motion.div>
  );
}
