import { z } from 'zod';

/**
 * Schema for linking a parent to a child via invite code.
 */
export const linkChildSchema = z.object({
  inviteCode: z
    .string()
    .length(8, 'Codul de invitare trebuie sa aiba 8 caractere')
    .regex(/^[A-Z0-9]+$/, 'Codul de invitare contine doar litere mari si cifre'),
  relationshipType: z.enum(['mother', 'father', 'guardian', 'other']),
});

export type LinkChildInput = z.infer<typeof linkChildSchema>;

/**
 * Response shape returned from the linkChild action.
 */
export interface LinkChildResult {
  success: boolean;
  error?: string;
  data?: {
    /** The ID of the newly created parent-child link. */
    linkId: string;
    /** Student username for confirmation message. */
    studentName: string;
    /** Student avatar URL if available. */
    studentAvatarUrl?: string | null;
  };
}
