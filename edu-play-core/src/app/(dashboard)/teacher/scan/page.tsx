import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerLanguage, getServerTranslation } from '@/lib/i18n/server';
import type { Language } from '@/lib/i18n/config';
import { createClient } from '@/lib/supabase/server';
import { ROUTES } from '@/shared/lib/constants/routes';
import { Button, Card } from '@/shared/components/ui/kit';
import { Icon } from '@/shared/components/ui/Icon';

async function t(lang: Language, key: string) {
  return getServerTranslation(lang, 'teacher', key);
}

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLanguage();
  return {
    title: await t(lang, 'utility.scan.metadataTitle'),
  };
}

async function requireTeacher() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(ROUTES.AUTH.LOGIN);

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'teacher') {
    redirect(ROUTES.AUTH.LOGIN);
  }
}


export default async function TeacherScanPage() {
  await requireTeacher();

  const lang = await getServerLanguage();
  const [heading, permissionTitle, permissionBody, backHome] = await Promise.all([
    t(lang, 'utility.scan.heading'),
    t(lang, 'utility.scan.permissionTitle'),
    t(lang, 'utility.scan.permissionBody'),
    t(lang, 'utility.scan.backHome'),
  ]);


  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-container px-4 py-8 text-on-surface sm:px-6 lg:px-10">
      <Card className="w-full max-w-2xl overflow-hidden border border-outline-variant bg-surface-container-lowest" padding="none">
        <div className="flex items-center justify-between gap-4 border-b border-outline-variant px-5 py-4">
          <h1 className="font-headline text-2xl font-bold text-on-surface">{heading}</h1>
          <Button href={ROUTES.TEACHER.DASHBOARD} variant="icon" size="sm" aria-label={backHome}>
            <Icon name="X" size="sm" aria-hidden />
          </Button>
        </div>

        <section aria-labelledby="scanner-heading" className="grid gap-5 px-6 py-8 text-center">
          <div className="mx-auto flex aspect-square w-full max-w-sm items-center justify-center rounded-2xl border border-dashed border-outline-variant bg-surface">
            <div>
              <Icon name="CornersOut" size={64} className="mx-auto text-primary-deep" aria-hidden />
              <h2 id="scanner-heading" className="mt-4 font-headline text-xl font-bold text-on-surface">
                {permissionTitle}
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-on-surface-variant">{permissionBody}</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button href={ROUTES.TEACHER.DASHBOARD} variant="secondary" size="sm">
              {backHome}
            </Button>
          </div>
        </section>
      </Card>
    </div>
  );
}
