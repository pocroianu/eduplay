'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ROUTES } from '@/shared/lib/constants';

interface MarkReadResult {
  success: boolean;
  error?: string;
}

export async function markNotificationAsRead(
  notificationId: string,
): Promise<MarkReadResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Nu sunteți autentificat' };
    }

    const { error } = await supabase
      .from('parent_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('parent_id', user.id)
      .is('read_at', null);

    if (error) {
      console.error('Error marking notification as read:', error);
      return { success: false, error: 'Eroare la actualizarea notificării' };
    }

    revalidatePath(ROUTES.PARENT.DASHBOARD);
    revalidatePath(ROUTES.PARENT.NOTIFICATIONS);
    return { success: true };
  } catch (error) {
    console.error('markNotificationAsRead error:', error);
    return { success: false, error: 'A apărut o eroare neașteptată' };
  }
}

export async function markAllNotificationsAsRead(): Promise<MarkReadResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Nu sunteți autentificat' };
    }

    const { error } = await supabase
      .from('parent_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('parent_id', user.id)
      .is('read_at', null);

    if (error) {
      console.error('Error marking all notifications as read:', error);
      return { success: false, error: 'Eroare la actualizarea notificărilor' };
    }

    revalidatePath(ROUTES.PARENT.DASHBOARD);
    revalidatePath(ROUTES.PARENT.NOTIFICATIONS);
    return { success: true };
  } catch (error) {
    console.error('markAllNotificationsAsRead error:', error);
    return { success: false, error: 'A apărut o eroare neașteptată' };
  }
}
