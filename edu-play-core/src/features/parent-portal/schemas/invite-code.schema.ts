import { z } from 'zod';

/**
 * Schema for generating a parent invite code.
 * Teacher provides a student ID; the server generates the code.
 */
export const generateInviteCodeSchema = z.object({
  studentId: z
    .string()
    .uuid('ID-ul studentului este invalid'),
});

export type GenerateInviteCodeInput = z.infer<typeof generateInviteCodeSchema>;

/**
 * Response shape returned from the generateInviteCode action.
 */
export interface GenerateInviteCodeResult {
  success: boolean;
  error?: string;
  data?: {
    /** The plain-text invite code (only time it is visible). */
    code: string;
    /** When the code expires (ISO string). */
    expiresAt: string;
    /** Student username for display. */
    studentName: string;
  };
}
