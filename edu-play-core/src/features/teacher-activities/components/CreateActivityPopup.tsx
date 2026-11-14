'use client'

import { use, Suspense, useMemo } from 'react'
import { Popup } from '@/shared/components/ui/kit'
import { createClient } from '@/lib/supabase/client'
import { CreateActivityWizard } from './CreateActivityWizard'
import type { TeacherAuthorableActivityType } from '../types'

export interface CreateActivityPopupProps {
  open: boolean
  onClose: () => void
}

async function fetchInteractiveTypes(): Promise<TeacherAuthorableActivityType[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('activity_types')
    .select('type_id, display_name, category, renderer_key, renderer_kind, authoring_mode')
    .order('display_name', { ascending: true })

  return (data ?? [])
    .filter(
      (row) =>
        row.type_id !== 'free-response' &&
        row.authoring_mode === 'teacher-simple' &&
        row.renderer_kind === 'iframe',
    )
    .map((row) => ({
      typeId: row.type_id as string,
      displayName: row.display_name as string,
      category: (row.category as string) || 'general',
      rendererKey: row.renderer_key as string,
      rendererKind: row.renderer_kind as 'iframe',
      authoringMode: row.authoring_mode as 'teacher-simple',
    }))
}

function WizardContent() {
  const interactiveTypes = use(useMemo(() => fetchInteractiveTypes(), []))
  return (
    <div className="-mx-5 -my-5">
      <CreateActivityWizard interactiveTypes={interactiveTypes} />
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <p className="text-sm text-on-surface-variant">Se încarcă...</p>
    </div>
  )
}

function CreateActivityPopup({ open, onClose }: CreateActivityPopupProps) {
  return (
    <Popup
      open={open}
      onClose={onClose}
      variant="modal"
      size="xl"
      title="Creează activitate"
      showClose
    >
      {open && (
        <Suspense fallback={<LoadingFallback />}>
          <WizardContent />
        </Suspense>
      )}
    </Popup>
  )
}
