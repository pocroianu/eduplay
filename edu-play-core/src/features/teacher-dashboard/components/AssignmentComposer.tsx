'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useForm, type UseFormReturnType } from '@mantine/form'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Group,
  MultiSelect,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { motion, useReducedMotion } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { FilterSelect } from '@/shared/components/ui/kit'
import { Icon } from '@/shared/components/ui/Icon'
import { ROUTES } from '@/shared/lib/constants'
import { createAssignment, updateAssignment } from '../actions/assignment-actions'

const composerSchema = z
  .object({
    activityId: z.string().uuid({ message: 'Selectează o activitate' }),
    targetType: z.enum(['class', 'student']),
    classId: z.string().uuid().optional(),
    studentIds: z.array(z.string().uuid()).optional(),
    dueDate: z.string().optional(),
    isMandatory: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.targetType === 'class' && !data.classId) {
      ctx.addIssue({ code: 'custom', message: 'Selectează o clasă', path: ['classId'] })
    }

    if (data.targetType === 'student' && (!data.studentIds || data.studentIds.length === 0)) {
      ctx.addIssue({ code: 'custom', message: 'Selectează cel puțin un elev', path: ['studentIds'] })
    }
  })

type ComposerFormData = z.input<typeof composerSchema>

type ComposerFormValues = {
  activityId: string
  targetType: 'class' | 'student'
  classId: string
  studentIds: string[]
  dueDate: string
  isMandatory: boolean
}

type AssignmentComposerForm = UseFormReturnType<ComposerFormValues>

type SelectOption = { value: string; label: string }

function toComposerInput(values: ComposerFormValues): ComposerFormData {
  return {
    activityId: values.activityId,
    targetType: values.targetType,
    classId: values.classId || undefined,
    studentIds: values.studentIds,
    dueDate: values.dueDate || undefined,
    isMandatory: values.isMandatory,
  }
}

function validateComposerForm(values: ComposerFormValues) {
  const result = composerSchema.safeParse(toComposerInput(values))

  if (result.success) {
    return {}
  }

  const fieldErrors = result.error.flatten().fieldErrors

  return {
    activityId: fieldErrors.activityId?.[0],
    classId: fieldErrors.classId?.[0],
    studentIds: fieldErrors.studentIds?.[0],
    dueDate: fieldErrors.dueDate?.[0],
    isMandatory: fieldErrors.isMandatory?.[0],
  }
}

function getError(error: unknown) {
  return typeof error === 'string' ? error : undefined
}

const formControlStyles = {
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

export interface AssignmentComposerProps {
  profile: {
    id: string
    full_name: string
    avatar_url?: string | null
  }
  classes: Array<{ id: string; name: string }>
  activities: Array<{
    id: string
    title: string | null
    category: string | null
    thumbnail_url: string | null
  }>
  students?: Array<{ id: string; username: string; display_name: string | null; class_id: string | null }>
  editMode?: {
    assignmentId: string
    activityId: string
    classId: string | null
    studentId: string | null
    dueDate: string | null
    isMandatory: boolean | null
  }
}

type InitialValueParams = {
  editMode: AssignmentComposerProps['editMode']
  preselectedActivityId: string | null
  preselectedClassId: string | null
  preselectedStudentId: string | null
}

function getEditInitialValues(editMode: NonNullable<AssignmentComposerProps['editMode']>): ComposerFormValues {
  const dueDate = editMode.dueDate ? new Date(editMode.dueDate).toISOString().slice(0, 16) : ''

  return {
    activityId: editMode.activityId,
    targetType: editMode.classId ? 'class' : 'student',
    classId: editMode.classId ?? '',
    studentIds: editMode.studentId ? [editMode.studentId] : [],
    dueDate,
    isMandatory: editMode.isMandatory ?? false,
  }
}

function getCreateInitialValues({
  preselectedActivityId,
  preselectedClassId,
  preselectedStudentId,
}: Omit<InitialValueParams, 'editMode'>): ComposerFormValues {
  return {
    activityId: preselectedActivityId ?? '',
    targetType: preselectedStudentId ? 'student' : 'class',
    classId: preselectedClassId ?? '',
    studentIds: preselectedStudentId ? [preselectedStudentId] : [],
    dueDate: '',
    isMandatory: false,
  }
}

function getInitialValues(params: InitialValueParams): ComposerFormValues {
  if (params.editMode) {
    return getEditInitialValues(params.editMode)
  }

  return getCreateInitialValues(params)
}

function ComposerHeading({ isEditing }: { isEditing: boolean }) {
  const { t } = useTranslation('teacher')

  return (
    <Stack gap={8}>
      <Text size="sm" fw={800} tt="uppercase" c="var(--color-primary-deep)" style={{ letterSpacing: '0.12em' }}>
        {t('assignments.composer.assignTo')}
      </Text>
      <Title order={1} c="var(--color-on-surface)" style={{ fontSize: 'clamp(1.5rem, 2vw, 1.875rem)' }}>
        {t(isEditing ? 'assignments.composer.editTitle' : 'assignments.composer.createTitle')}
      </Title>
      <Text size="md" fw={500} lh={1.5} c="var(--color-on-surface-variant)">
        {t(isEditing ? 'assignments.composer.editDescription' : 'assignments.composer.createDescription')}
      </Text>
    </Stack>
  )
}

function ActivitySelectField({
  form,
  options,
  selectedActivity,
  disabled,
}: {
  form: AssignmentComposerForm
  options: SelectOption[]
  selectedActivity?: AssignmentComposerProps['activities'][number]
  disabled: boolean
}) {
  const { t } = useTranslation('teacher')

  return (
    <Stack gap={8}>
      <FilterSelect
        inputId="activityId"
        label={t('assignments.composer.activity')}
        disabled={disabled}
        invalid={Boolean(form.errors.activityId)}
        ariaDescribedBy={form.errors.activityId ? 'activityId-error' : undefined}
        options={options}
        value={form.values.activityId}
        onChange={(value) => {
          form.setFieldValue('activityId', value)
          form.validateField('activityId')
        }}
        placeholder={t('assignments.composer.selectActivity')}
        fullWidth
        radius="md"
        icon="BookOpen"
      />
      {form.errors.activityId ? (
        <Text id="activityId-error" size="sm" fw={700} c="var(--color-error)">
          {String(form.errors.activityId)}
        </Text>
      ) : null}
      {selectedActivity ? (
        <Paper
          p="sm"
          radius="md"
          style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary-container) 30%, transparent)' }}
        >
          <Group gap="sm">
            <Icon name="BookOpen" size={20} className="text-primary" />
            <Text size="sm" fw={500} c="var(--color-on-surface)">
              {selectedActivity.title}
            </Text>
          </Group>
        </Paper>
      ) : null}
    </Stack>
  )
}

function TargetTypePicker({
  targetType,
  onSelectClass,
  onSelectStudent,
}: {
  targetType: ComposerFormValues['targetType']
  onSelectClass: () => void
  onSelectStudent: () => void
}) {
  const { t } = useTranslation('teacher')

  return (
    <Stack gap={8}>
      <Text component="label" size="sm" fw={600} c="var(--color-on-surface)">
        {t('assignments.composer.assignTo')}
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <Button
          type="button"
          aria-pressed={targetType === 'class'}
          color="purple"
          variant={targetType === 'class' ? 'filled' : 'light'}
          leftSection={<Icon name="Users" size={20} />}
          onClick={onSelectClass}
          styles={{
            root: {
              minHeight: 48,
              backgroundColor: targetType === 'class' ? 'var(--color-primary)' : 'var(--color-surface-container)',
              color: targetType === 'class' ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)',
            },
          }}
        >
          {t('assignments.composer.wholeClass')}
        </Button>
        <Button
          type="button"
          aria-pressed={targetType === 'student'}
          color="purple"
          variant={targetType === 'student' ? 'filled' : 'light'}
          leftSection={<Icon name="User" size={20} />}
          onClick={onSelectStudent}
          styles={{
            root: {
              minHeight: 48,
              backgroundColor: targetType === 'student' ? 'var(--color-primary)' : 'var(--color-surface-container)',
              color: targetType === 'student' ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)',
            },
          }}
        >
          {t('assignments.composer.individualStudent')}
        </Button>
      </SimpleGrid>
    </Stack>
  )
}

function ClassSelectField({
  form,
  options,
  onClassChange,
}: {
  form: AssignmentComposerForm
  options: SelectOption[]
  onClassChange: (classId: string) => void
}) {
  const { t } = useTranslation('teacher')

  return (
    <Stack gap={8}>
      <FilterSelect
        inputId="classId"
        label={t('assignments.composer.class')}
        invalid={Boolean(form.errors.classId)}
        ariaDescribedBy={form.errors.classId ? 'classId-error' : undefined}
        options={options}
        value={form.values.classId}
        onChange={onClassChange}
        placeholder={t('assignments.composer.selectClass')}
        fullWidth
        radius="md"
        icon="Users"
      />
      {form.errors.classId ? (
        <Text id="classId-error" size="sm" fw={700} c="var(--color-error)">
          {String(form.errors.classId)}
        </Text>
      ) : null}
    </Stack>
  )
}

function StudentSelectField({
  form,
  options,
  loading,
}: {
  form: AssignmentComposerForm
  options: SelectOption[]
  loading: boolean
}) {
  const { t } = useTranslation('teacher')

  return (
    <Stack gap={8}>
      <MultiSelect
        id="studentId"
        label={t('assignments.composer.student')}
        disabled={loading}
        error={getError(form.errors.studentIds)}
        data={options}
        value={form.values.studentIds}
        onChange={(value) => {
          form.setFieldValue('studentIds', value)
          form.validateField('studentIds')
        }}
        placeholder={t('assignments.composer.selectStudentsHint')}
        searchable
        clearable
        comboboxProps={{ withinPortal: false }}
        styles={{
          ...formControlStyles,
          pill: {
            backgroundColor: 'var(--color-primary-soft)',
            color: 'var(--color-primary-deep)',
            fontFamily: 'var(--font-lexend)',
            fontWeight: 700,
          },
        }}
      />
      {loading ? (
        <Group gap="xs" c="var(--color-on-surface-variant)">
          <Icon name="Hourglass" size={18} />
          <Text size="sm">{t('assignments.composer.loadingStudents')}</Text>
        </Group>
      ) : null}
      <Text size="xs" c="var(--color-on-surface-variant)">
        {t('assignments.composer.selectStudentsHint')}
      </Text>
    </Stack>
  )
}

function DueDateField({ form }: { form: AssignmentComposerForm }) {
  const { t } = useTranslation('teacher')

  return (
    <Stack gap={8}>
      <TextInput
        id="dueDate"
        type="datetime-local"
        label={t('assignments.composer.dueDate')}
        styles={formControlStyles}
        {...form.getInputProps('dueDate')}
      />
      <Text size="xs" c="var(--color-on-surface-variant)">
        {t('assignments.composer.dueDateHint')}
      </Text>
    </Stack>
  )
}

function ComposerActions({
  isPending,
  isEditing,
  onCancel,
}: {
  isPending: boolean
  isEditing: boolean
  onCancel: () => void
}) {
  const { t } = useTranslation('teacher')

  return (
    <Group gap="md" pt={16} grow>
      <Button type="submit" loading={isPending} color="purple">
        {isPending
          ? t('assignments.composer.saving')
          : isEditing
            ? t('assignments.composer.update')
            : t('assignments.composer.create')}
      </Button>
      <Button type="button" variant="subtle" color="purple" onClick={onCancel}>
        {t('assignments.composer.cancel')}
      </Button>
    </Group>
  )
}

export function AssignmentComposer({
  classes,
  activities,
  editMode,
}: AssignmentComposerProps) {
  const reduceMotion = useReducedMotion()
  const { t } = useTranslation('teacher')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [students, setStudents] = useState<Array<{ id: string; username: string; display_name: string | null }>>([])
  const [loadingStudents, setLoadingStudents] = useState(false)

  const preselectedActivityId = searchParams.get('activityId')
  const preselectedClassId = searchParams.get('classId')
  const preselectedStudentId = searchParams.get('studentId') ?? searchParams.get('assignTo')

  const form = useForm<ComposerFormValues>({
    mode: 'controlled',
    initialValues: getInitialValues({
      editMode,
      preselectedActivityId,
      preselectedClassId,
      preselectedStudentId,
    }),
    validate: validateComposerForm,
  })

  const watchTargetType = form.values.targetType
  const watchClassId = form.values.classId
  const watchActivityId = form.values.activityId
  const activityOptions = useMemo(
    () =>
      activities.map((activity) => ({
        value: activity.id,
        label: `${activity.title ?? activity.id}${activity.category ? ` (${activity.category})` : ''}`,
      })),
    [activities],
  )
  const classOptions = useMemo(
    () => classes.map((cls) => ({ value: cls.id, label: cls.name })),
    [classes],
  )
  const studentOptions = useMemo(
    () =>
      students.map((student) => ({
        value: student.id,
        label: student.display_name ?? student.username,
      })),
    [students],
  )

  const fetchStudentsForClass = useCallback((classId: string) => {
    setLoadingStudents(true)
    fetch(`/api/v1/classes/${classId}/students`)
      .then((res) => res.json())
      .then((json) => {
        if (json.data) {
          setStudents(
            json.data.map((s: { id: string; username: string; displayName?: string | null }) => ({
              id: s.id,
              username: s.username,
              display_name: s.displayName ?? null,
            })),
          )
        }
      })
      .catch(() => setStudents([]))
      .finally(() => setLoadingStudents(false))
  }, [])

  useEffect(() => {
    if (editMode || !preselectedStudentId) return

    form.setFieldValue('targetType', 'student')
    form.setFieldValue('studentIds', [preselectedStudentId])

    fetch(`/api/v1/students/${preselectedStudentId}`)
      .then((res) => res.json())
      .then((json) => {
        const classId = json.data?.classId
        if (classId) {
          form.setFieldValue('classId', classId)
          fetchStudentsForClass(classId)
        }
      })
      .catch(() => {
        if (preselectedClassId) fetchStudentsForClass(preselectedClassId)
      })
  }, [editMode, fetchStudentsForClass, form, preselectedClassId, preselectedStudentId])

  const onSubmit = (data: ComposerFormValues) => {
    setError(null)
    startTransition(async () => {
      const payload = {
        activityId: data.activityId,
        classId: data.targetType === 'class' ? data.classId || undefined : undefined,
        studentIds: data.targetType === 'student' ? data.studentIds : undefined,
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : undefined,
        isMandatory: data.isMandatory,
      }

      const result = editMode
        ? await updateAssignment(editMode.assignmentId, {
            dueDate: payload.dueDate ?? null,
            isMandatory: payload.isMandatory,
          })
        : await createAssignment(payload)

      if (result.success) {
        router.push(ROUTES.TEACHER.ASSIGNMENTS)
      } else {
        setError(result.error ?? t('assignments.composer.genericError'))
      }
    })
  }

  const selectedActivity = activities.find((activity) => activity.id === watchActivityId)
  const selectClassTarget = () => {
    form.setFieldValue('targetType', 'class')
    form.setFieldValue('studentIds', [])
  }
  const selectStudentTarget = () => {
    form.setFieldValue('targetType', 'student')
    if (form.values.classId) fetchStudentsForClass(form.values.classId)
  }
  const selectClass = (classId: string) => {
    form.setFieldValue('classId', classId)
    form.setFieldValue('studentIds', [])
    form.validateField('classId')
    if (watchTargetType === 'student' && classId) {
      fetchStudentsForClass(classId)
    } else {
      setStudents([])
    }
  }

  return (
    <div className="p-6 lg:p-10">
      <div className="mx-auto max-w-[720px]">
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card p={{ base: 24, md: 32 }} radius="lg" withBorder shadow="sm">
            <Stack gap={32}>
              <ComposerHeading isEditing={Boolean(editMode)} />

              <form onSubmit={form.onSubmit(onSubmit)} noValidate>
                <Stack gap={24}>
                  <ActivitySelectField
                    form={form}
                    options={activityOptions}
                    selectedActivity={selectedActivity}
                    disabled={Boolean(editMode)}
                  />

                  {!editMode && (
                    <TargetTypePicker
                      targetType={watchTargetType}
                      onSelectClass={selectClassTarget}
                      onSelectStudent={selectStudentTarget}
                    />
                  )}

                  {!editMode && (
                    <ClassSelectField form={form} options={classOptions} onClassChange={selectClass} />
                  )}

                  {!editMode && watchTargetType === 'student' && watchClassId && (
                    <StudentSelectField form={form} options={studentOptions} loading={loadingStudents} />
                  )}

                  <DueDateField form={form} />

                  <Checkbox
                    color="purple"
                    label={t('assignments.composer.mandatory')}
                    styles={{ label: { color: 'var(--color-on-surface)', fontWeight: 500 } }}
                    {...form.getInputProps('isMandatory', { type: 'checkbox' })}
                  />

                  {error && (
                    <Alert
                      role="alert"
                      icon={<Icon name="WarningCircle" size={20} />}
                      color="red"
                      styles={{ root: { backgroundColor: 'var(--color-error-soft)', color: 'var(--color-error)' } }}
                    >
                      {error}
                    </Alert>
                  )}

                  <ComposerActions
                    isPending={isPending}
                    isEditing={Boolean(editMode)}
                    onCancel={() => router.push(ROUTES.TEACHER.ASSIGNMENTS)}
                  />
                </Stack>
              </form>
            </Stack>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
