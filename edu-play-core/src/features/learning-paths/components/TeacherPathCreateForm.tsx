'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  Group,
  NumberInput,
  Stack,
  Textarea,
  TextInput,
  rem,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { Icon } from '@/shared/components/ui/Icon';
import { ROUTES } from '@/shared/lib/constants/routes';
import { createPath } from '../actions/create-path';
import { createPathInputSchema, type CreatePathInput } from '../schemas';

type NumberFieldValue = number | string;

interface TeacherPathCreateFormValues {
  title: string;
  description: string;
  ageMin: NumberFieldValue;
  ageMax: NumberFieldValue;
}

export interface TeacherPathCreateFormProps {
  initialError?: string;
}

function normalizeAge(value: NumberFieldValue) {
  if (value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toCreatePathInput(values: TeacherPathCreateFormValues): CreatePathInput {
  const description = values.description.trim();

  return {
    title: values.title,
    description: description.length > 0 ? description : null,
    ageMin: normalizeAge(values.ageMin),
    ageMax: normalizeAge(values.ageMax),
  };
}

function validatePathForm(values: TeacherPathCreateFormValues) {
  const result = createPathInputSchema.safeParse(toCreatePathInput(values));

  if (result.success) {
    return {};
  }

  const fieldErrors = result.error.flatten().fieldErrors;

  return {
    title: fieldErrors.title?.[0],
    description: fieldErrors.description?.[0],
    ageMin: fieldErrors.ageMin?.[0],
    ageMax: fieldErrors.ageMax?.[0],
  };
}

function getError(error: unknown) {
  return typeof error === 'string' ? error : undefined;
}

const inputStyles = {
  label: {
    color: 'var(--color-on-surface)',
    fontFamily: 'var(--font-lexend)',
    fontSize: rem(14),
    fontWeight: 700,
  },
  input: {
    backgroundColor: 'var(--color-surface-container-lowest)',
    borderColor: 'var(--color-outline)',
    borderRadius: rem(6),
    boxShadow: 'var(--shadow-soft-sm)',
    color: 'var(--color-on-surface)',
    fontFamily: 'var(--font-lexend)',
    minHeight: rem(48),
  },
};

export function TeacherPathCreateForm({ initialError }: TeacherPathCreateFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState(initialError);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<TeacherPathCreateFormValues>({
    mode: 'controlled',
    initialValues: {
      title: '',
      description: '',
      ageMin: '',
      ageMax: '',
    },
    validate: validatePathForm,
  });

  const submitPath = form.onSubmit(async (values) => {
    setIsSubmitting(true);
    setServerError(undefined);

    try {
      const result = await createPath(toCreatePathInput(values));

      if (!result.success || !result.data?.path) {
        setServerError(result.error ?? 'Nu am putut crea parcursul.');
        return;
      }

      router.push(ROUTES.TEACHER.PATH(result.data.path.id));
      router.refresh();
    } catch {
      setServerError('Nu am putut crea parcursul. Încearcă din nou.');
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <form onSubmit={submitPath} noValidate className="space-y-5 p-5">
      {serverError ? (
        <Alert
          color="red"
          icon={<Icon name="WarningCircle" aria-hidden />}
          radius="md"
          role="alert"
          styles={{
            root: {
              backgroundColor: 'var(--color-error-container)',
              borderColor: 'var(--color-error)',
            },
            message: {
              color: 'var(--color-on-error-container)',
              fontFamily: 'var(--font-lexend)',
              fontWeight: 700,
            },
          }}
        >
          {serverError}
        </Alert>
      ) : null}

      <Stack gap="md">
        <TextInput
          {...form.getInputProps('title')}
          data-testid="learning-path-title"
          error={getError(form.errors.title)}
          label="Titlu"
          maxLength={120}
          required
          styles={inputStyles}
        />

        <Textarea
          {...form.getInputProps('description')}
          data-testid="learning-path-description"
          error={getError(form.errors.description)}
          label="Descriere"
          maxLength={2000}
          minRows={4}
          styles={{
            ...inputStyles,
            input: {
              ...inputStyles.input,
              paddingBlock: rem(12),
              resize: 'vertical',
            },
          }}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberInput
            {...form.getInputProps('ageMin')}
            allowDecimal={false}
            allowNegative={false}
            error={getError(form.errors.ageMin)}
            label="Vârstă minimă"
            max={18}
            min={2}
            styles={inputStyles}
          />
          <NumberInput
            {...form.getInputProps('ageMax')}
            allowDecimal={false}
            allowNegative={false}
            error={getError(form.errors.ageMax)}
            label="Vârstă maximă"
            max={18}
            min={2}
            styles={inputStyles}
          />
        </div>
      </Stack>

      <Group
        gap="sm"
        pt="md"
        styles={{
          root: {
            borderTop: '1px solid var(--color-outline-variant)',
          },
        }}
      >
        <Button
          type="submit"
          loading={isSubmitting}
          data-testid="learning-path-create"
          styles={{
            root: {
              backgroundColor: 'var(--color-primary)',
              borderRadius: rem(6),
              color: 'var(--color-on-primary)',
              fontFamily: 'var(--font-lexend)',
              fontWeight: 700,
              minHeight: rem(44),
            },
          }}
        >
          Creează parcurs
        </Button>
        <Button
          component={Link}
          href={ROUTES.TEACHER.PATHS}
          variant="subtle"
          styles={{
            root: {
              borderRadius: rem(6),
              color: 'var(--color-on-surface-variant)',
              fontFamily: 'var(--font-lexend)',
              fontWeight: 700,
              minHeight: rem(44),
            },
          }}
        >
          Renunță
        </Button>
      </Group>
    </form>
  );
}
