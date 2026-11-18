import { TeacherPathCreateForm } from '@/features/learning-paths';
import { ROUTES } from '@/shared/lib/constants/routes';
import {
  Button,
  Card,
} from '@/shared/components/ui/kit';
import { requireTeacherPathPageContext } from '../teacher-path-page-auth';

export const metadata = {
  title: 'Parcurs nou · EduPlay',
};

interface TeacherPathNewPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const firstString = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function TeacherPathNewPage({
  searchParams,
}: TeacherPathNewPageProps) {
  await requireTeacherPathPageContext();

  const params = await searchParams;
  const error = firstString(params.error);

  return (
    <div className="min-h-screen bg-surface-container text-on-surface">
      <div className="sticky top-0 z-10 border-b border-outline-variant bg-surface-container-lowest px-6 py-4 lg:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">
              Biblioteca mea
            </p>
            <h1 className="mt-1 font-headline text-2xl font-bold text-on-surface md:text-3xl">
              Parcurs nou
            </h1>
            <p className="mt-1 text-sm font-medium text-on-surface-variant">
              Pornește cu titlul și grupa de vârstă, apoi adaugi pașii.
            </p>
          </div>
          <Button href={ROUTES.TEACHER.PATHS} variant="ghost" size="sm">
            Renunță
          </Button>
        </div>
        <div className="mx-auto mt-4 flex max-w-6xl overflow-x-auto border-b border-outline-variant">
          <span className="border-b-2 border-primary px-4 py-3 text-sm font-bold text-primary-deep">
            1. Detalii parcurs
          </span>
          <span className="border-b-2 border-transparent px-4 py-3 text-sm font-bold text-on-surface-variant">
            2. Pași
          </span>
          <span className="border-b-2 border-transparent px-4 py-3 text-sm font-bold text-on-surface-variant">
            3. Publicare
          </span>
        </div>
      </div>

      <div className="px-6 py-6 lg:px-10">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <Card padding="none" shadow={false} className="overflow-hidden border border-outline-variant">
              <div className="border-b border-outline-variant px-5 py-4">
                <h2 className="text-lg font-bold text-on-surface">
                  Detalii pentru parcurs
                </h2>
                <p className="mt-1 text-sm font-medium text-on-surface-variant">
                  Aceste câmpuri apar în lista profesorului și în sumarul parcursului.
                </p>
              </div>
              <TeacherPathCreateForm initialError={error} />
            </Card>
          </div>

          <aside className="lg:sticky lg:top-36 lg:self-start">
            <Card className="space-y-4 border border-outline-variant bg-surface-container-lowest" shadow={false}>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">
                  Previzualizare
                </p>
                <h2 className="mt-1 text-lg font-bold text-on-surface">
                  Ce urmează
                </h2>
              </div>
              <div className="divide-y divide-outline-variant text-sm font-semibold text-on-surface-variant">
                <div className="py-3">Completezi detaliile de bază.</div>
                <div className="py-3">Adaugi activități ca pași ai parcursului.</div>
                <div className="py-3">Publici parcursul pentru a-l putea atribui.</div>
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
