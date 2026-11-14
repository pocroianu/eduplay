'use client'

import { useTransition } from 'react'

import { useToast } from '@/shared/components/ui/kit'
import { restoreTeacherActivity } from '../actions'
import { ActivityActionButton, type ActivityActionTone } from './ActivityActionButton'

export function RestoreActivityForm({
  activityId,
  tone = 'restore',
}: {
  activityId: string
  tone?: ActivityActionTone
}) {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function handleClick() {
    startTransition(async () => {
      const result = await restoreTeacherActivity(activityId)
      if (result.success) {
        toast({ message: 'Activitatea a fost restaurată.', variant: 'success' })
      } else {
        toast({ message: result.error ?? 'Nu am putut restaura activitatea.', variant: 'error' })
      }
    })
  }

  return (
    <ActivityActionButton
      type="button"
      onClick={handleClick}
      disabled={isPending}
      isPending={isPending}
      aria-label="Restaurează activitatea"
      tone={tone}
    >
      {isPending ? 'Se restaurează…' : 'Restaurează'}
    </ActivityActionButton>
  )
}
