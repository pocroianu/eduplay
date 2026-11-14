'use client'

import { Button as MantineButton, ThemeIcon, rem } from '@mantine/core'
import { useForm } from '@mantine/form'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { Card, FilterChipGroup, TextField } from '@/shared/components/ui/kit'
import { Icon } from '@/shared/components/ui/Icon'
import { createClient } from '@/lib/supabase/client'
import { createClassSchema, type CreateClassFormData } from '@/features/teacher-management'
import { ROUTES } from '@/shared/lib/constants'

const GRADE_OPTIONS = [
  { value: 'preschool', labelKey: 'createClass.option.preschool', shortLabel: 'PK-TK' },
  { value: 'kindergarten', labelKey: 'createClass.option.kindergarten', shortLabel: 'K' },
  { value: 'grade-1', labelKey: 'createClass.option.grade1', shortLabel: '1' },
  { value: 'grade-2', labelKey: 'createClass.option.grade2', shortLabel: '2' },
] as const

function getCurrentSchoolYear(date = new Date()) {
  const calendarYear = date.getFullYear()
  const schoolYearStart = date.getMonth() >= 8 ? calendarYear : calendarYear - 1
  return `${schoolYearStart}-${schoolYearStart + 1}`
}

function validateClassForm(values: CreateClassFormData) {
  const result = createClassSchema.safeParse(values)

  if (result.success) {
    return {}
  }

  const fieldErrors = result.error.flatten().fieldErrors

  return {
    name: fieldErrors.name?.[0],
    description: fieldErrors.description?.[0],
    gradeLevel: fieldErrors.gradeLevel?.[0],
    schoolYear: fieldErrors.schoolYear?.[0],
  }
}

export default function NewClassPage() {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { t } = useTranslation('teacher')

  const form = useForm<CreateClassFormData>({
    mode: 'controlled',
    initialValues: {
      name: '',
      description: '',
      gradeLevel: undefined,
      schoolYear: getCurrentSchoolYear(),
    },
    validate: validateClassForm,
  })

  const onSubmit = async (data: CreateClassFormData) => {
    setIsLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Not authenticated')
      }

      const { error } = await supabase.from('classes').insert({
        teacher_id: user.id,
        name: data.name,
        description: data.description || null,
        grade_level: data.gradeLevel || null,
        school_year: data.schoolYear || null,
      })

      if (error) throw error

      router.push(ROUTES.TEACHER.CLASSES)
      router.refresh()
    } catch (error) {
      console.error('Error creating class', error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  const selectedGrade = form.values.gradeLevel ?? ''
  const { error: _nameError, ...nameInputProps } = form.getInputProps('name')
  const gradeItems = GRADE_OPTIONS.map((option) => ({
    value: option.value,
    label: option.shortLabel,
    ariaLabel: t(option.labelKey),
  }))

  return (
    <main className="min-h-screen bg-surface-container text-on-surface">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-5 py-8">
        <nav aria-label="Navigation" className="mb-4">
          <MantineButton
            component={Link}
            href={ROUTES.TEACHER.CLASSES}
            variant="subtle"
            leftSection={<Icon name="ArrowLeft" size="sm" aria-hidden />}
            styles={{
              root: {
                borderRadius: rem(6),
                color: 'var(--color-on-surface-variant)',
                fontFamily: 'var(--font-lexend)',
                fontWeight: 700,
                minHeight: rem(44),
                paddingInline: rem(12),
              },
            }}
          >
            {t('createClass.back')}
          </MantineButton>
        </nav>

        <Card padding="none" shadow={false} className="overflow-hidden border border-outline-variant bg-surface-container-lowest">
          <form onSubmit={form.onSubmit(onSubmit)} noValidate>
            <div className="space-y-6 px-6 py-6 sm:px-10 sm:py-8">
              <div className="text-center">
                <h1 className="font-headline text-3xl font-bold text-on-surface">{t('createClass.heading')}</h1>
                <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-on-surface-variant">
                  {t('createClass.subtitle')}
                </p>
              </div>

              <MantineButton
                type="button"
                disabled
                aria-describedby="google-classroom-note"
                fullWidth
                justify="center"
                leftSection={
                  <ThemeIcon
                    aria-hidden="true"
                    color="var(--color-primary-soft)"
                    c="var(--color-primary)"
                    radius="md"
                    size={36}
                    variant="light"
                  >
                    <Icon name="Archive" size="sm" weight="bold" />
                  </ThemeIcon>
                }
                styles={{
                  root: {
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-outline-variant)',
                    borderRadius: rem(8),
                    color: 'var(--color-on-surface-variant)',
                    fontFamily: 'var(--font-lexend)',
                    fontSize: rem(14),
                    fontWeight: 700,
                    minHeight: rem(56),
                  },
                }}
              >
                {t('createClass.importGoogle')}
              </MantineButton>
              <p id="google-classroom-note" className="-mt-4 text-center text-xs font-semibold text-on-surface-muted">
                {t('createClass.importNote')}
              </p>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-outline-variant" />
                <span className="text-sm font-bold text-on-surface-muted">{t('createClass.or')}</span>
                <div className="h-px flex-1 bg-outline-variant" />
              </div>

              <TextField
                label={t('createClass.name')}
                placeholder="Ex: Grupa Mare A"
                required
                error={typeof form.errors.name === 'string' ? form.errors.name : undefined}
                {...nameInputProps}
              />

              <fieldset className="space-y-3">
                <legend className="text-center text-sm font-bold text-on-surface">{t('createClass.gradeTitle')}</legend>
                <FilterChipGroup
                  ariaLabel={t('createClass.gradeTitle')}
                  items={gradeItems}
                  value={selectedGrade}
                  onChange={(value) => {
                    form.setFieldValue('gradeLevel', value ? (value as CreateClassFormData['gradeLevel']) : undefined)
                    form.validateField('gradeLevel')
                  }}
                  allowDeselect
                  radius="md"
                  size="lg"
                  styles={{
                    root: {
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                      width: '100%',
                    },
                    chip: {
                      width: '100%',
                    },
                  }}
                />
                {form.errors.gradeLevel ? (
                  <p className="text-sm font-semibold text-error">{String(form.errors.gradeLevel)}</p>
                ) : null}
              </fieldset>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-outline-variant bg-surface-container px-6 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-10">
              <MantineButton
                component={Link}
                href={ROUTES.TEACHER.CLASSES}
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
                {t('createClass.cancel')}
              </MantineButton>
              <MantineButton
                type="submit"
                loading={isLoading}
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
                {isLoading ? t('createClass.submitting') : t('createClass.submit')}
              </MantineButton>
            </div>
          </form>
        </Card>
      </div>
    </main>
  )
}
