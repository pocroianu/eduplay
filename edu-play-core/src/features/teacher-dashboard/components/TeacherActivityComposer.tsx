'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  Alert,
  Anchor,
  Button,
  Card,
  Group,
  Radio,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { assignActivity } from '@/features/activities'
import { FilterSelect } from '@/shared/components/ui/kit'
import { Icon } from '@/shared/components/ui/Icon'
import { ROUTES } from '@/shared/lib/constants'

export interface TeacherActivityComposerProps {
  classes: Array<{ id: string; name: string }>
}

type ActivityKind = 'drawing' | 'voice'

const ACTIVITY_OPTIONS: Array<{
  value: ActivityKind
  label: string
  description: string
  icon: 'Palette' | 'Microphone'
}> = [
  {
    value: 'drawing',
    label: 'Desen',
    description: 'Elevii predau o lucrare vizuală pe canvas.',
    icon: 'Palette',
  },
  {
    value: 'voice',
    label: 'Înregistrare vocală',
    description: 'Elevii răspund oral și trimit audio pentru revizuire.',
    icon: 'Microphone',
  },
]

function buildActivityPayload(kind: ActivityKind, prompt: string, classId: string) {
  if (kind === 'voice') {
    return {
      activityTypeId: 'voice-recording',
      config: { promptText: prompt },
      classId,
    }
  }

  return {
    activityTypeId: 'drawing-canvas',
    config: { mode: 'guided', prompt },
    classId,
  }
}

interface ActivityComposerFormValues {
  activityKind: ActivityKind
  classId: string
  instructions: string
}

function getError(error: unknown) {
  return typeof error === 'string' ? error : undefined
}

const composerInputStyles = {
  label: {
    color: 'var(--color-on-surface)',
    fontFamily: 'var(--font-lexend)',
    fontWeight: 700,
  },
  input: {
    backgroundColor: 'var(--color-surface)',
    borderColor: 'var(--color-outline-variant)',
    color: 'var(--color-on-surface)',
    fontFamily: 'var(--font-lexend)',
    fontWeight: 600,
    minHeight: 48,
  },
}

export function TeacherActivityComposer({ classes }: TeacherActivityComposerProps) {
  const [error, setError] = useState<string | null>(classes.length ? null : 'Nu ai clase active pentru trimitere.')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const hasClasses = classes.length > 0
  const form = useForm<ActivityComposerFormValues>({
    mode: 'controlled',
    initialValues: {
      activityKind: 'drawing',
      classId: classes[0]?.id ?? '',
      instructions: '',
    },
    validate: {
      classId: (value) => (hasClasses && !value ? 'Alege clasa pentru activitate.' : null),
      instructions: (value) =>
        value.trim().length > 0 ? null : 'Scrie instrucțiunile pentru elevi înainte de trimitere.',
    },
  })

  const selectedOption = useMemo(
    () => ACTIVITY_OPTIONS.find((option) => option.value === form.values.activityKind) ?? ACTIVITY_OPTIONS[0],
    [form.values.activityKind],
  )
  const classOptions = useMemo(
    () => classes.map((cls) => ({ value: cls.id, label: cls.name })),
    [classes],
  )

  const handleSubmit = form.onSubmit((values) => {
    if (!hasClasses) {
      setError('Nu ai clase active pentru trimitere.')
      return
    }

    const prompt = values.instructions.trim()
    setError(null)
    setSuccessMessage(null)

    startTransition(async () => {
      const result = await assignActivity(buildActivityPayload(values.activityKind, prompt, values.classId))

      if (!result.success) {
        setError(result.error ?? 'Nu am putut trimite activitatea. Încearcă din nou.')
        return
      }

      setSuccessMessage('Activitatea a fost trimisă. Răspunsurile vor apărea în Inbox activități.')
    })
  }, (errors) => {
    const firstError = getError(errors.instructions) ?? getError(errors.classId)
    if (firstError) {
      setError(firstError)
      setSuccessMessage(null)
    }
  })

  return (
    <Card radius="lg" p={{ base: 20, md: 24 }} withBorder shadow="sm">
      <form onSubmit={handleSubmit}>
        <Stack gap={24}>
          <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <Stack gap={12}>
              <Text component="legend" size="sm" fw={800} tt="uppercase" c="var(--color-primary-deep)" style={{ letterSpacing: '0.12em' }}>
                Tip răspuns
              </Text>
              <Radio.Group
                name="activityKind"
                value={form.values.activityKind}
                onChange={(value) => form.setFieldValue('activityKind', value as ActivityKind)}
              >
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  {ACTIVITY_OPTIONS.map((option) => {
                    const checked = form.values.activityKind === option.value
                    return (
                      <Radio.Card
                        key={option.value}
                        value={option.value}
                        radius="md"
                        p="md"
                        withBorder
                        style={{
                          backgroundColor: checked ? 'var(--color-primary-soft)' : 'var(--color-surface-container-lowest)',
                          borderColor: checked ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                          color: checked ? 'var(--color-primary-deep)' : 'var(--color-on-surface)',
                        }}
                        styles={{
                          card: {
                            transition: 'background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease',
                            '&:hover': {
                              boxShadow: 'var(--shadow-soft)',
                            },
                            '&:focus-visible': {
                              outline: '2px solid var(--color-primary)',
                              outlineOffset: 2,
                            },
                            '@media (prefers-reduced-motion: reduce)': {
                              transition: 'none',
                            },
                          },
                        }}
                      >
                        <Group align="flex-start" gap="sm" wrap="nowrap">
                          <Radio.Indicator color="purple" size="md" />
                          <ThemeIcon
                            variant={checked ? 'filled' : 'light'}
                            color="purple"
                            radius="md"
                            size={36}
                          >
                            <Icon name={option.icon} size={22} weight={checked ? 'fill' : 'regular'} aria-hidden />
                          </ThemeIcon>
                          <Stack gap={4}>
                            <Text fw={800}>{option.label}</Text>
                            <Text size="sm" fw={500} c="var(--color-on-surface-variant)">
                              {option.description}
                            </Text>
                          </Stack>
                        </Group>
                      </Radio.Card>
                    )
                  })}
                </SimpleGrid>
              </Radio.Group>
            </Stack>
          </fieldset>

          <FilterSelect
            inputId="teacher-activity-class"
            label="Clasă"
            value={form.values.classId}
            onChange={(value) => {
              form.setFieldValue('classId', value)
              form.validateField('classId')
            }}
            disabled={!hasClasses || isPending}
            invalid={Boolean(form.errors.classId)}
            ariaDescribedBy={form.errors.classId ? 'teacher-activity-class-error' : undefined}
            options={classOptions}
            placeholder={hasClasses ? 'Alege clasa' : 'Nu există clase'}
            fullWidth
            radius="md"
            icon="Users"
          />
          {form.errors.classId ? (
            <Text id="teacher-activity-class-error" size="sm" fw={700} c="var(--color-error)">
              {String(form.errors.classId)}
            </Text>
          ) : null}

          <Textarea
            id="teacher-activity-instructions"
            label="Instrucțiuni pentru elevi"
            disabled={!hasClasses || isPending}
            error={getError(form.errors.instructions)}
            rows={5}
            autosize={false}
            styles={composerInputStyles}
            placeholder={
              selectedOption.value === 'voice'
                ? 'Ex: Spune o propoziție despre primăvară.'
                : 'Ex: Desenează animalul preferat.'
            }
            {...form.getInputProps('instructions')}
          />

          {error ? (
            <Alert role="alert" color="red" styles={{ root: { backgroundColor: 'var(--color-error-soft)', color: 'var(--color-error)' } }}>
              {error}{' '}
              {!hasClasses ? (
                <Anchor href={ROUTES.TEACHER.CLASS_NEW} fw={800} c="var(--color-error)" td="underline">
                  Creează clasă
                </Anchor>
              ) : null}
            </Alert>
          ) : null}

          {successMessage ? (
            <Alert role="status" color="purple" styles={{ root: { backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary-deep)' } }}>
              {successMessage}
            </Alert>
          ) : null}

          <Group align="center" justify="space-between" gap="md">
            <Text size="sm" fw={500} c="var(--color-on-surface-variant)" style={{ flex: '1 1 16rem' }}>
              {selectedOption.description}
            </Text>
            <Button type="submit" color="purple" disabled={!hasClasses || isPending} loading={isPending}>
              Trimite activitatea
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  )
}
