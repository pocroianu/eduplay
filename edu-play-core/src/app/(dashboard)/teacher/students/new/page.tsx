'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Button,
  Card,
  FilterSelect,
  TextField,
  type FilterSelectOption,
} from '@/shared/components/ui/kit'
import { Icon } from '@/shared/components/ui/Icon'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { createStudentSchema, type CreateStudentFormData } from '@/features/teacher-management'
import { ROUTES } from '@/shared/lib/constants'

function generatePassword(): string {
  const words = ['soare', 'luna', 'stea', 'floare', 'copac', 'casa', 'pisica', 'caine']
  const numbers = ['1', '2', '3', '4', '5']
  const word = words[Math.floor(Math.random() * words.length)]
  const num = numbers[Math.floor(Math.random() * numbers.length)]
  return `${word}${num}`
}

function generateUsername(fullName: string): string {
  const parts = fullName.toLowerCase().split(' ')
  const firstName = parts[0] || 'elev'
  const lastName = parts[1] || ''
  const random = Math.floor(Math.random() * 100)
  return `${firstName}${lastName.charAt(0)}${random}`.replace(/[^a-z0-9]/g, '')
}

interface ClassOption {
  id: string
  name: string
}

export default function NewStudentPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [copied, setCopied] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const defaultClassId = searchParams.get('classId') || ''

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<CreateStudentFormData>({
    resolver: zodResolver(createStudentSchema),
    defaultValues: {
      password: generatePassword(),
      classId: defaultClassId,
    },
  })

  const fullName = watch('fullName')
  const password = watch('password')
  const username = watch('username')
  const classOptions = useMemo<FilterSelectOption[]>(
    () => [
      { value: '', label: 'Selectează o clasă' },
      ...classes.map((cls) => ({ value: cls.id, label: cls.name })),
    ],
    [classes],
  )

  useEffect(() => {
    async function fetchClasses() {
      const { data } = await supabase
        .from('classes')
        .select('id, name')
        .order('name')

      if (data) {
        setClasses(data)
      }
    }
    fetchClasses()
  }, [supabase])

  useEffect(() => {
    if (fullName && fullName.length >= 2) {
      setValue('username', generateUsername(fullName))
    }
  }, [fullName, setValue])

  const regeneratePassword = () => {
    setValue('password', generatePassword())
  }

  const copyCredentials = () => {
    const text = `Nume utilizator: ${username}\nParolă: ${password}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const onSubmit = async (data: CreateStudentFormData) => {
    setIsLoading(true)
    try {
      // Use the API route which has admin privileges
      const response = await fetch('/api/v1/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: data.fullName,
          username: data.username,
          password: data.password,
          classId: data.classId || null,
          dateOfBirth: data.dateOfBirth || null,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to create student')
      }

      router.push(ROUTES.TEACHER.STUDENTS)
      router.refresh()
    } catch (error) {
      console.error('Eroare la crearea elevului', error instanceof Error ? error.message : 'Ceva nu a mers bine')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-container text-on-surface">
      <div className="mx-auto max-w-6xl px-6 py-6 lg:px-10">
        <nav aria-label="Navigare" className="mb-6 flex items-center justify-between gap-4">
          <Button href={ROUTES.TEACHER.STUDENTS} variant="ghost" size="sm">
            <Icon name="ArrowLeft" size="sm" aria-hidden />
            Înapoi la elevi
          </Button>
          <span className="rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">
            Adăugare elev
          </span>
        </nav>

        <Card padding="none" shadow={false} className="overflow-hidden border border-outline-variant">
          <div className="border-b border-outline-variant bg-surface-container-lowest px-6 py-5 sm:px-8">
            <div className="flex flex-wrap items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary" aria-hidden>
                <Icon name="UserPlus" size="lg" weight="bold" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">Adăugare elev</p>
                <h1 className="mt-1 font-headline text-2xl font-bold text-on-surface">Adaugă un elev în clasă</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
                  Introdu datele elevului. EduPlay generează automat un nume de utilizator și o parolă ușor de comunicat familiei.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="bg-surface-container-lowest p-6 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-lg border border-outline-variant bg-surface p-5">
              <div className="mb-5 flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1 flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-sm font-bold text-primary-deep"
                >
                  1
                </span>
                <div>
                  <h3 className="font-headline text-lg font-bold text-on-surface">Date elev</h3>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Completează câmpurile curente pentru un elev; fluxul de creare și acreditările generate rămân neschimbate.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-5">
                <TextField
                  label="Numele complet al elevului"
                  placeholder="ex: Maria Popescu"
                  required
                  error={errors.fullName?.message}
                  {...register('fullName')}
                />

                <TextField
                  label="Nume de utilizator"
                  placeholder="ex: mariap1"
                  required
                  helper="Elevul va folosi acest nume pentru a se autentifica."
                  error={errors.username?.message}
                  {...register('username')}
                />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <TextField
                    label="Parolă"
                    required
                    helper="Parolă simplă, ușor de reținut pentru copii."
                    error={errors.password?.message}
                    className="flex-1"
                    {...register('password')}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={regeneratePassword}
                    aria-label="Generează parolă nouă"
                    className="mb-7"
                  >
                    <Icon name="ArrowClockwise" size="sm" aria-hidden />
                    Generează
                  </Button>
                </div>

                <div className="space-y-2">
                  <Controller
                    name="classId"
                    control={control}
                    render={({ field }) => (
                      <FilterSelect
                        label="Clasă"
                        icon="Users"
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        options={classOptions}
                        invalid={Boolean(errors.classId)}
                        ariaDescribedBy={
                          errors.classId ? 'new-student-class-error' : undefined
                        }
                        fullWidth
                        radius="md"
                        width="100%"
                      />
                    )}
                  />
                  {errors.classId?.message ? (
                    <p
                      id="new-student-class-error"
                      role="alert"
                      className="ml-1 flex items-center gap-1.5 text-sm text-error"
                    >
                      <Icon
                        name="XCircle"
                        size={14}
                        weight="fill"
                        aria-hidden
                        className="shrink-0"
                      />
                      {errors.classId.message}
                    </p>
                  ) : null}
                </div>

                <TextField
                  label="Data nașterii"
                  type="date"
                  error={errors.dateOfBirth?.message}
                  {...register('dateOfBirth')}
                />
              </div>
            </div>

            <aside className="flex flex-col gap-4">
              <div className="rounded-lg border border-outline-variant bg-surface p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-muted">
                  Pași rapizi
                </p>
                <ol className="mt-4 space-y-3 text-sm text-on-surface-variant">
                  <li className="flex gap-3">
                    <span className="font-bold text-primary">1.</span>
                    Scrie numele elevului.
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-primary">2.</span>
                    Verifică datele generate.
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-primary">3.</span>
                    Copiază acreditările înainte de salvare, dacă vrei să le trimiți familiei.
                  </li>
                </ol>
              </div>

              {username && password && (
                <Card className="border border-tertiary-container bg-tertiary-container p-5 text-on-tertiary-container" shadow={false}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-widest">
                        Date generate
                      </p>
                      <p className="mt-1 text-sm">
                        Pregătite pentru conectarea elevului.
                      </p>
                    </div>
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-container-lowest text-tertiary"
                    >
                      <Icon name="Check" size="sm" weight="bold" />
                    </span>
                  </div>
                  <code className="mt-4 block overflow-x-auto rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-sm text-on-surface">
                    Utilizator: {username}<br />
                    Parolă: {password}
                  </code>
                  <Button
                    type="button"
                    variant={copied ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={copyCredentials}
                    aria-label="Copiază datele de autentificare"
                    fullWidth
                    className="mt-4"
                  >
                    <Icon name={copied ? 'Check' : 'Copy'} size="sm" aria-hidden />
                    {copied ? 'Copiat' : 'Copiază'}
                  </Button>
                </Card>
              )}
            </aside>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-outline-variant pt-5 sm:flex-row sm:justify-end">
            <Button href={ROUTES.TEACHER.STUDENTS} variant="ghost">
              Anulează
            </Button>
            <Button type="submit" isPending={isLoading}>
              {isLoading ? 'Se creează...' : 'Creează elevul'}
            </Button>
          </div>
        </form>
        </Card>
    </div>
    </div>
  )
}
