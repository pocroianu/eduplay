'use client'

import { useEffect } from 'react'
import { Icon } from '@/shared/components/ui/Icon'
import { Button, Card } from '@/shared/components/ui/kit'
import { ROUTES } from '@/shared/lib/constants'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ClassNotificationsError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Class notifications error boundary caught:', error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6">
      <Card className="w-full max-w-md text-center" padding="lg">
        <Icon name="Warning" size="xl" className="mx-auto text-error" aria-hidden />
        <h2 className="mt-4 text-lg font-bold text-on-surface">Eroare la încărcarea notificărilor clasei</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          A apărut o eroare neașteptată. Încercați din nou sau reveniți la clase.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button mode="standard" onClick={reset}>Încercați din nou</Button>
          <Button mode="standard" variant="secondary" href={ROUTES.TEACHER.CLASSES}>Clase</Button>
        </div>
        {error.digest && (
          <p className="mt-4 text-xs text-on-surface-variant">Referință: {error.digest}</p>
        )}
      </Card>
    </div>
  )
}
