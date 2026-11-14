import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ROUTES } from '@/shared/lib/constants';
import { PreferencesProvider } from '@/features/student-profile';
import { getPreferences } from '@/features/student-profile/server';

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(ROUTES.AUTH.LOGIN);
  }

  const preferences = await getPreferences(user.id);

  return <PreferencesProvider initial={preferences}>{children}</PreferencesProvider>;
}
