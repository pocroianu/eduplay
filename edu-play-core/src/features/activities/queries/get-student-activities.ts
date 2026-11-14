import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { ActivityInstance } from '../types';
import {
  ACTIVITY_INSTANCE_SELECT,
  mapActivityInstanceRow,
  type ActivityInstanceRow,
} from './types';

const studentIdSchema = z.string().uuid();

/**
 * Lists the creative activity instances assigned to one student. The caller
 * passes the student id from the authenticated context; RLS still enforces
 * that a student session can only see rows assigned to itself.
 */
export async function getStudentActivities(
  supabase: SupabaseClient,
  studentId: string,
): Promise<ActivityInstance[]> {
  const parsed = studentIdSchema.safeParse(studentId);
  if (!parsed.success) return [];

  const { data, error } = await supabase
    .from('activity_instances')
    .select(ACTIVITY_INSTANCE_SELECT)
    .eq('assigned_to', parsed.data)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`getStudentActivities failed: ${error.message}`);
  }

  return ((data ?? []) as ActivityInstanceRow[]).map(mapActivityInstanceRow);
}
