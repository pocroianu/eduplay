import { z } from 'zod';

const uuid = z.string().uuid('ID-ul activității este invalid');

/**
 * Schema for inserting a new activity instance. The `config` payload is
 * validated per-type by the registry's `configSchema` before reaching the DB
 * layer; here we only validate the row-level shape.
 */
export const createActivityInstanceSchema = z.object({
  typeId: z.string().min(1, 'Tipul activității este obligatoriu').max(80),
  config: z.unknown(),
  assignedTo: uuid,
  classId: uuid.nullable().optional(),
});

export type CreateActivityInstanceInput = z.infer<
  typeof createActivityInstanceSchema
>;

/**
 * Schema for the activity-instance id parameter — used by the player route
 * and by getActivityInstance.
 */
export const activityInstanceIdSchema = z.object({ id: uuid });
export type ActivityInstanceIdInput = z.infer<typeof activityInstanceIdSchema>;
