import { z } from 'zod';

export const classExportParamsSchema = z.object({
  classId: z.string().uuid('Invalid class ID'),
});

export type ClassExportParams = z.infer<typeof classExportParamsSchema>;
