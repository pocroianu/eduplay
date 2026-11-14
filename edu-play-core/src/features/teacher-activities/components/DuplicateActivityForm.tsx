'use client'

import { useTransition } from 'react'

import { useToast } from '@/shared/components/ui/kit'
import { duplicateTeacherActivity } from '../actions'
import { ActivityActionButton, type ActivityActionTone } from './ActivityActionButton'

export function DuplicateActivityForm({
  activityId,
  tone = 'quiet',
}: {
  activityId: string
  tone?: ActivityActionTone
}) {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function handleClick() {
    startTransition(async () => {
      const result = await duplicateTeacherActivity(activityId)
      if (result.success) {
        toast({ message: 'Activitatea a fost duplicată ca ciornă.', variant: 'success' })
      } else {
        toast({ message: result.error ?? 'Nu am putut duplica activitatea.', variant: 'error' })
      }
    })
  }

  return (
    <ActivityActionButton
      type="button"
      onClick={handleClick}
      disabled={isPending}
      isPending={isPending}
      aria-label="Duplică activitatea"
      tone={tone}
    >
      {isPending ? 'Se duplică…' : 'Duplică'}
    </ActivityActionButton>
  )
}
