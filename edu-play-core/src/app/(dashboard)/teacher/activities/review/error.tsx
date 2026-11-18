'use client'

import { useEffect } from 'react'

import { Icon } from '@/shared/components/ui/Icon'
import { Button, Card } from '@/shared/components/ui/kit'
import { ROUTES } from '@/shared/lib/constants'

export default function TeacherActivityReviewError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Teacher activity review error boundary caught:', error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6 lg:p-10">
      <Card className="w-full max-w-md border border-outline-variant text-center" padding="lg" shadow={false}>
        <Icon name="Warning" size="xl" className="mx-auto text-error" aria-hidden />
        <h1 className="mt-4 text-lg font-bold text-on-surface">Nu am putut încărca răspunsurile</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Reîncarcă pagina sau revino la activități și încearcă din nou.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button mode="standard" type="button" onClick={reset}>
            Reîncearcă
          </Button>
          <Button mode="standard" variant="secondary" href={ROUTES.TEACHER.ACTIVITIES}>
            Înapoi la activități
          </Button>
        </div>
        {error.digest && (
          <p className="mt-4 text-xs text-on-surface-variant">Referință: {error.digest}</p>
        )}
      </Card>
    </div>
  )
}
