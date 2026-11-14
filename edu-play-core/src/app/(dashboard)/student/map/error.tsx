'use client'

import { useEffect } from 'react'
import { Icon } from '@/shared/components/ui/Icon'
import { Button, Card } from '@/shared/components/ui/kit'
import { ROUTES } from '@/shared/lib/constants/routes'

interface StudentMapErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function StudentMapError({ error, reset }: StudentMapErrorProps) {
  useEffect(() => {
    console.error('Student map error boundary caught:', error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6">
      <Card className="w-full max-w-md text-center" padding="lg">
        <Icon name="MapTrifold" size="xl" className="mx-auto text-primary" aria-hidden />
        <h2 className="mt-4 text-xl font-semibold text-on-surface">
          Eroare la încărcarea hărții
        </h2>
        <p className="mt-2 text-base text-on-surface-variant">
          Nu am putut încărca parcursul tău. Încearcă din nou sau revino la pagina principală.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button mode="kid" size="lg" onClick={reset}>
            <Icon name="ArrowClockwise" size="sm" aria-hidden />
            Încearcă din nou
          </Button>
          <Button mode="kid" size="lg" variant="secondary" href={ROUTES.STUDENT.DASHBOARD}>
            <Icon name="House" size="sm" aria-hidden />
            Acasă
          </Button>
        </div>
      </Card>
    </div>
  )
}
