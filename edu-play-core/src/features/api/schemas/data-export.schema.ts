import { z } from 'zod';

export const classExportParamsSchema = z.object({
  classId: z.string().uuid('Invalid class ID'),
});
