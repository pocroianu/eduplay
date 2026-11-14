import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ROUTES } from '@/shared/lib/constants';
import { getNotifications } from '@/features/parent-portal/server';
import { NotificationList } from '@/features/parent-portal';

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(ROUTES.AUTH.LOGIN);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'parent') {
    redirect(ROUTES.AUTH.LOGIN);
  }

  const { notifications, total } = await getNotifications(user.id, 50, 0);

  return (
    <div className="p-6 lg:p-10">
      <NotificationList notifications={notifications} total={total} />
    </div>
  );
}
