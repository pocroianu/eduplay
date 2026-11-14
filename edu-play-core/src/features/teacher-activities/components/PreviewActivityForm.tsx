'use client'

import { useTransition } from 'react'

import { createTeacherActivityPreview } from '../actions'
import { ActivityActionButton, type ActivityActionTone } from './ActivityActionButton'

export function PreviewActivityForm({
  activityId,
  tone = 'secondary',
}: {
  activityId: string
  tone?: ActivityActionTone
}) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      await createTeacherActivityPreview(activityId)
    })
  }

  return (
    <ActivityActionButton
      type="button"
      onClick={handleClick}
      disabled={isPending}
      isPending={isPending}
      aria-label="Previzualizează activitatea"
      tone={tone}
    >
      {isPending ? 'Se încarcă…' : 'Previzualizează'}
    </ActivityActionButton>
  )
}
