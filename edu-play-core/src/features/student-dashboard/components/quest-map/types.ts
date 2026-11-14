import type { SubjectPillProps } from '@/shared/components/ui/kit'

export type QuestNodeState = 'done' | 'active' | 'locked' | 'upcoming'

export type QuestSubjectTone = NonNullable<SubjectPillProps['tone']>

export interface QuestUnit {
  id: string
  label: string
  state: QuestNodeState
  tone: QuestSubjectTone
  nodeColor: string
  href: string
  progress: number
  total: number
}

export interface QuestLesson {
  id: string
  title: string
  subjectTone: QuestSubjectTone
  subjectLabel: string
  durationMinutes: number
  done: boolean
  href: string
}
