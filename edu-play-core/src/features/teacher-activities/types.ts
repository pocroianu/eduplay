export type TeacherActivityMode = 'free-response' | 'interactive'

export interface TeacherAuthorableActivityType {
  typeId: string
  displayName: string
  category: string | null
  rendererKey: string
  rendererKind: 'iframe' | 'react'
  authoringMode: 'admin-only' | 'teacher-simple' | 'hidden'
}

export interface CreateActivityWizardData {
  interactiveTypes: TeacherAuthorableActivityType[]
}

export type TeacherOwnedActivityStatus = 'draft' | 'published' | 'archived' | 'in_review'

export interface TeacherOwnedActivity {
  id: string
  title: string
  template: string
  status: TeacherOwnedActivityStatus
  visibilityScope: 'private' | 'school' | 'public'
  updatedAt: string | null
  createdAt: string | null
  configData: unknown
}

export type TeacherActivitiesTab = 'library' | 'my'
export type TeacherActivitiesStatusFilter = 'all' | TeacherOwnedActivityStatus

export interface FreeResponseLinkResourceInput {
  title: string
  url: string
}

export interface FreeResponseDraftInput {
  title: string
  prompt: string
  allowedTools: {
    text: boolean
    drawing: boolean
    voice: boolean
  }
  shareWithFamilyOnApproval: boolean
  resources?: FreeResponseLinkResourceInput[]
}

export interface EditableFreeResponseDraft extends FreeResponseDraftInput {
  activityId: string
  status: Extract<TeacherOwnedActivityStatus, 'draft'>
  resources: FreeResponseLinkResourceInput[]
}

export type FreeResponseDraftFieldErrors = Partial<Record<keyof FreeResponseDraftInput | 'allowedTools' | 'resources', string>>

export interface SaveFreeResponseDraftResult {
  success: boolean
  error?: string
  fieldErrors?: FreeResponseDraftFieldErrors
  data?: { id: string }
}

export interface UpdateFreeResponseDraftResult {
  success: boolean
  error?: string
  fieldErrors?: FreeResponseDraftFieldErrors
  data?: { id: string }
}

export interface MakeActivityReadyResult {
  success: boolean
  error?: string
  data?: {
    activityId: string
    versionId: string
    versionNumber: number
  }
}

export interface DuplicateTeacherActivityResult {
  success: boolean
  error?: string
  data?: { activityId: string }
}

export interface ArchiveTeacherActivityResult {
  success: boolean
  error?: string
  data?: { activityId: string }
}

export interface RestoreTeacherActivityResult {
  success: boolean
  error?: string
  data?: { activityId: string }
}

export interface TeacherReviewQueueItem {
  submissionId: string
  assignmentId: string
  activityId: string
  activityTitle: string
  studentId: string
  studentName: string
  studentUsername: string
  className: string | null
  attemptNumber: number
  submittedAt: string | null
  text: string
  drawingArtifactId: string | null
  drawingUrl: string | null
  voiceArtifactId: string | null
  voiceUrl: string | null
  voiceDurationMs: number | null
  shareWithFamilyOnApproval: boolean
}

export interface ReviewActivitySubmissionResult {
  success: boolean
  error?: string
}
