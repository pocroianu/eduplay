import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LinkChildForm } from '@/features/parent-portal';
import { ROUTES } from '@/shared/lib/constants';
import Link from 'next/link';
import { Icon } from '@/shared/components/ui/Icon';

export default async function ParentLinkChildPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(ROUTES.AUTH.LOGIN);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'parent') {
    redirect(ROUTES.AUTH.LOGIN);
  }

  return (
    <div aria-labelledby="parent-link-child-title" className="bg-surface-alt p-6 lg:p-10">
      <div className="mx-auto flex max-w-6xl min-w-0 flex-col gap-6">
        <Link
          href={ROUTES.PARENT.DASHBOARD}
          className="inline-flex w-fit items-center gap-2 text-sm font-bold text-on-surface-variant transition-colors hover:text-primary"
        >
          <Icon name="ArrowLeft" size="sm" aria-hidden />
          Înapoi la panou
        </Link>

        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-start">
          <section className="min-w-0 max-w-full overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-soft-sm">
            <div className="border-b border-outline-variant px-6 py-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary-deep">
                Adaugă familie
              </p>
              <h1
                id="parent-link-child-title"
                className="mt-1 text-[30px] font-bold leading-tight text-on-surface md:text-[36px]"
              >
                Conectează-te la copil
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-on-surface-variant">
                Folosește codul de invitație primit de la profesorul copilului pentru a-ți conecta contul. Vei putea urmări progresul imediat după.
              </p>
            </div>

            <div className="grid gap-0 md:grid-cols-3">
              <div className="border-b border-outline-variant bg-surface-alt p-5 md:border-b-0 md:border-r">
                <p className="text-sm font-bold text-on-surface">
                  Pasul 1
                </p>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                  Primește codul de la profesor.
                </p>
              </div>
              <div className="border-b border-outline-variant bg-surface-alt p-5 md:border-b-0 md:border-r">
                <p className="text-sm font-bold text-on-surface">
                  Pasul 2
                </p>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                  Introdu codul și relația cu copilul.
                </p>
              </div>
              <div className="bg-surface-alt p-5">
                <p className="text-sm font-bold text-on-surface">
                  Pasul 3
                </p>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                  Vezi firul de activitate al familiei.
                </p>
              </div>
            </div>
          </section>

          <div className="min-w-0 max-w-full">
            <LinkChildForm />
          </div>
        </div>
      </div>
    </div>
  );
}
