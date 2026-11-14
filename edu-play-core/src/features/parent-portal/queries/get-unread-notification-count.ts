import { createClient } from '@/lib/supabase/server';

export async function getUnreadNotificationCount(
  parentId: string,
): Promise<number> {
  try {
    const supabase = await createClient();

    const { count, error } = await supabase
      .from('parent_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', parentId)
      .is('read_at', null);

    if (error) {
      console.error('Error fetching unread notification count:', error);
      return 0;
    }

    return count ?? 0;
  } catch (error) {
    console.error('getUnreadNotificationCount error:', error);
    return 0;
  }
}
