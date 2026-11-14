'use client'

import { useEffect } from 'react'
import { Button, Card, ChunkyButton } from '@/shared/components/ui/kit'
import { Icon } from '@/shared/components/ui/Icon';
import { ROUTES } from '@/shared/lib/constants/routes'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GameError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Game error boundary caught:', error)
  }, [error])

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-surface p-6"
    >
      <div className="w-full max-w-[440px]">
        <Card mode="standard" tone="cream" padding="lg" className="text-center">
          <div className="flex flex-col items-center gap-5">
            <div
              aria-hidden="true"
              className="flex h-12 w-12 items-center justify-center rounded-lg bg-error-soft text-error"
            >
              <Icon name="WarningCircle" size="lg" />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="font-headline text-2xl font-semibold text-on-surface">
                Jocul nu s-a putut încărca
              </h2>
              <p className="max-w-[320px] text-base leading-relaxed text-on-surface-variant">
                Ceva nu a mers bine. Hai să mai încercăm o dată!
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button
                mode="kid"
                variant="primary"
                size="lg"
                onClick={reset}
                fullWidth
                className="sm:flex-1"
                aria-label="Reîncearcă jocul"
              >
                <Icon name="ArrowClockwise" size="sm" aria-hidden />
                Reîncearcă
              </Button>
              <ChunkyButton
                variant="gold"
                size="lg"
                href={ROUTES.STUDENT.DASHBOARD}
                full
                className="sm:flex-1"
                aria-label="Înapoi la jocuri"
              >
                <Icon name="ArrowLeft" size="sm" aria-hidden />
                Înapoi
              </ChunkyButton>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
