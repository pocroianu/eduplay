import { createClient } from '@/lib/supabase/server';
import type { LinkedChildResult } from './types';

/**
 * Fetch all active children linked to a parent via the parent_children table.
 *
 * Joins parent_children -> students to get student details.
 * Only returns children with status = 'active'.
 * Results are ordered by linked_at DESC (most recently linked first).
 *
 * RLS: Runs as the authenticated parent; parent_children RLS policy
 * ensures only the parent's own records are returned.
 *
 * @param parentId - The authenticated parent's profile ID
 * @returns Array of linked children with student info
 */
export async function getLinkedChildren(
  parentId: string
): Promise<LinkedChildResult[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('parent_children')
      .select(
        `
        id,
        relationship_type,
        linked_at,
        student_id,
        students (
          id,
          username,
          avatar_url
        )
      `
      )
      .eq('parent_id', parentId)
      .eq('status', 'active')
      .order('linked_at', { ascending: false });

    if (error) {
      console.error('Error fetching linked children:', error);
      return [];
    }

    if (!data) {
      return [];
    }

    // Map database result to the LinkedChildResult shape
    return data.map((record) => {
      // Supabase returns the joined relation as an object (single) or array
      // parent_children.student_id -> students is a many-to-one, so it comes as an object
      const student = record.students as unknown as {
        id: string;
        username: string;
        avatar_url: string | null;
      } | null;

      return {
        id: record.student_id,
        name: student?.username ?? 'Unknown',
        avatarUrl: student?.avatar_url ?? null,
        relationshipType: record.relationship_type,
        linkedAt: record.linked_at ?? record.id, // fallback should not happen
      };
    });
  } catch (error) {
    console.error('getLinkedChildren error:', error);
    return [];
  }
}
