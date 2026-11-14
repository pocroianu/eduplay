'use client'

import { useState, useTransition } from 'react'

import { ConfirmDialog, useToast } from '@/shared/components/ui/kit'
import { makeActivityReady } from '../actions'
import { ActivityActionButton, type ActivityActionTone } from './ActivityActionButton'

export function MakeActivityReadyForm({
  activityId,
  tone = 'primary',
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
      const result = await makeActivityReady(activityId)
      if (result.success) {
        toast({ message: 'Activitatea este gata de atribuit!', variant: 'success' })
      } else {
        toast({ message: result.error ?? 'Nu am putut marca activitatea ca gata.', variant: 'error' })
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
        aria-label="Marchează activitatea ca gata"
        tone={tone}
      >
        {isPending ? 'Se procesează…' : 'Marchează ca gata'}
      </ActivityActionButton>
      <ConfirmDialog
        open={confirmOpen}
        title="Marchezi activitatea ca gata?"
        body="Activitatea va putea fi atribuită elevilor. Poți reveni oricând să o editezi din nou."
        confirmLabel="Marchează ca gata"
        cancelLabel="Mai stau pe ea"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
        icon="PaperPlaneTilt"
      />
    </>
  )
}
