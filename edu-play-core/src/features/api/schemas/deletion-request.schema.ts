import { z } from 'zod';

export const createDeletionRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(500, 'Reason must be at most 500 characters')
    .optional(),
});

export type CreateDeletionRequestInput = z.infer<typeof createDeletionRequestSchema>;
