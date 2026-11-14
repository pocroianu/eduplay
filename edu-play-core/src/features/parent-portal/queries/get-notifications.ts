import { createClient } from '@/lib/supabase/server';
import type { NotificationWithStudent } from '../types';

export async function getNotifications(
  parentId: string,
  limit: number = 50,
  offset: number = 0,
): Promise<{ notifications: NotificationWithStudent[]; total: number }> {
  try {
    const supabase = await createClient();

    const { data, error, count } = await supabase
      .from('parent_notifications')
      .select(
        `
        *,
        students:student_id (
          id,
          username,
          avatar_url
        )
      `,
        { count: 'exact' },
      )
      .eq('parent_id', parentId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching notifications:', error);
      return { notifications: [], total: 0 };
    }

    const notifications: NotificationWithStudent[] = (data ?? []).map(
      (row) => {
        const student = row.students as unknown as {
          id: string;
          username: string;
          avatar_url: string | null;
        } | null;

        return {
          id: row.id,
          parent_id: row.parent_id,
          student_id: row.student_id,
          type: row.type,
          title: row.title,
          message: row.message,
          data: row.data,
          read_at: row.read_at,
          created_at: row.created_at,
          student: student
            ? {
                id: student.id,
                username: student.username,
                avatar_url: student.avatar_url ?? undefined,
              }
            : undefined,
        };
      },
    );

    return { notifications, total: count ?? 0 };
  } catch (error) {
    console.error('getNotifications error:', error);
    return { notifications: [], total: 0 };
  }
}
