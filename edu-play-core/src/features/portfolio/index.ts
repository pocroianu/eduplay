// Portfolio Feature Module - Public API
// Client-safe exports only. Query functions live in `./server` per
// CLAUDE.md § Server/Client Code Separation.

// Types
export type {
  Artifact,
  ArtifactType,
  ArtifactVisibility,
  ActionResult,
} from './types';

// Schemas (Zod schemas are isomorphic — safe to import from client forms).
export {
  createArtifactSchema,
  updateArtifactSchema,
  setArtifactVisibilitySchema,
  recordActivityArtifactSchema,
  recordChildArtifactSchema,
  teacherUploadArtifactSchema,
  MAX_SCREENSHOT_BYTES,
  MAX_AUDIO_BYTES,
  MAX_PHOTO_BYTES,
  AUDIO_MIME_TYPES,
  PHOTO_MIME_TYPES,
  type CreateArtifactInput,
  type UpdateArtifactInput,
  type SetArtifactVisibilityInput,
  type RecordActivityArtifactInput,
  type RecordChildArtifactInput,
  type RecordChildArtifactKind,
  type TeacherUploadArtifactInput,
  type TeacherUploadArtifactKind,
  type AudioMimeType,
  type PhotoMimeType,
} from './schemas';

// Server Actions (already marked with `'use server'`).
export { recordActivityArtifact } from './actions/record-activity-artifact';
export { recordChildArtifact } from './actions/record-child-artifact';

// Components
export {
  TeacherPortfolioCard,
  type TeacherPortfolioCardProps,
} from './components/TeacherPortfolioCard';
export {
  TeacherPortfolioFilters,
  type TeacherPortfolioFiltersProps,
} from './components/TeacherPortfolioFilters';
export {
  TeacherPortfolioQueue,
  type TeacherPortfolioQueueProps,
} from './components/TeacherPortfolioQueue';
export {
  TeacherUploadModal,
  type TeacherUploadModalProps,
  type TeacherUploadStudent,
} from './components/TeacherUploadModal';
export {
  TeacherPortfolioUploadLauncher,
  type TeacherPortfolioUploadLauncherProps,
} from './components/TeacherPortfolioUploadLauncher';
