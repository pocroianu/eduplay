'use client'

import { useState, useTransition } from 'react'

import { ConfirmDialog, useToast } from '@/shared/components/ui/kit'
import { archiveTeacherActivity } from '../actions'
import { ActivityActionButton, type ActivityActionTone } from './ActivityActionButton'

export function ArchiveActivityForm({
  activityId,
  tone = 'quiet',
}: {
  activityId: string
  tone?: ActivityActionTone
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function handleConfirm() {
    setConfirmOpen(false)
    startTransition(async () => {
      const result = await archiveTeacherActivity(activityId)
      if (result.success) {
        toast({ message: 'Activitatea a fost arhivată.', variant: 'success' })
      } else {
        toast({ message: result.error ?? 'Nu am putut arhiva activitatea.', variant: 'error' })
      }
    })
  }

  return (
    <>
      <ActivityActionButton
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={isPending}
        isPending={isPending}
        aria-label="Arhivează activitatea"
        tone={tone}
      >
        {isPending ? 'Se arhivează…' : 'Arhivează'}
      </ActivityActionButton>
      <ConfirmDialog
        open={confirmOpen}
        title="Arhivezi activitatea?"
        body="Activitatea va fi mutată în secțiunea Arhivate. O poți restaura oricând."
        confirmLabel="Arhivează"
        cancelLabel="Anulează"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
        destructive
        icon="Archive"
      />
    </>
  )
}
