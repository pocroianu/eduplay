import type { ActionResult } from '../types';

export type NativeSubmissionResult = ActionResult<NativeSubmissionReceipt> & {
  canEdit?: boolean;
};

export interface NativeSubmissionReceipt {
  submissionId: string;
  artifactId: string;
  progressionPending: boolean;
}
