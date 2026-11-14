import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import { getServerLanguage, preloadNamespaces } from '@/lib/i18n/server';
import { getTeacherOwnedActivities } from '@/features/teacher-activities/server';
import { TeacherLibraryContent } from '@/features/teacher-dashboard';
import type {
  TeacherActivitiesStatusFilter,
  TeacherOwnedActivity,
  TeacherOwnedActivityStatus,
} from '@/features/teacher-activities';
import { ROUTES } from '@/shared/lib/constants';

type OwnedActivitySort = 'newest' | 'oldest' | 'title';

const STATUS_LABELS: Record<TeacherOwnedActivityStatus, string> = {
  draft: 'Ciornă',
  published: 'Gata de atribuit',
  archived: 'Arhivată',
  in_review: 'În revizuire',
};


function parseStatus(status: string | undefined): TeacherActivitiesStatusFilter {
  if (
    status === 'draft' ||
    status === 'published' ||
    status === 'archived' ||
    status === 'in_review'
  ) {
    return status;
  }

  return 'all';
}

function parseSort(sort: string | undefined): OwnedActivitySort {
  if (sort === 'oldest' || sort === 'title') return sort;
  return 'newest';
}

function getActivityDate(activity: TeacherOwnedActivity) {
  return activity.updatedAt ?? activity.createdAt ?? '';
}

function getPromptPreview(activity: TeacherOwnedActivity) {
  const config = activity.configData;
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const prompt = (config as Record<string, unknown>).prompt;
  return typeof prompt === 'string' && prompt.trim() ? prompt.trim() : null;
}


function filterActivities(
  activities: TeacherOwnedActivity[],
  statusFilter: TeacherActivitiesStatusFilter,
  sortBy: OwnedActivitySort,
  query: string,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase('ro');
  const visible = statusFilter === 'all'
    ? activities.filter((activity) => activity.status !== 'archived')
    : activities.filter((activity) => activity.status === statusFilter);

  return visible
    .filter((activity) => {
      if (!normalizedQuery) return true;
      const prompt = getPromptPreview(activity);
      return (
        activity.title.toLocaleLowerCase('ro').includes(normalizedQuery) ||
        activity.template.toLocaleLowerCase('ro').includes(normalizedQuery) ||
        STATUS_LABELS[activity.status].toLocaleLowerCase('ro').includes(normalizedQuery) ||
        (prompt?.toLocaleLowerCase('ro').includes(normalizedQuery) ?? false)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title, 'ro');
      const aTime = new Date(sortBy === 'oldest' ? a.createdAt ?? 0 : getActivityDate(a)).getTime();
      const bTime = new Date(sortBy === 'oldest' ? b.createdAt ?? 0 : getActivityDate(b)).getTime();
      return sortBy === 'oldest' ? aTime - bTime : bTime - aTime;
    });
}


export default async function MyLibraryPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = (await searchParams) ?? {};
  const statusFilter = parseStatus(typeof query.status === 'string' ? query.status : undefined);
  const sortBy = parseSort(typeof query.sort === 'string' ? query.sort : undefined);
  const searchQuery = typeof query.q === 'string' ? query.q : '';
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

  if (!profile || profile.role !== 'teacher') {
    redirect(ROUTES.AUTH.LOGIN);
  }

  const [ownedActivities, lang] = await Promise.all([
    getTeacherOwnedActivities(supabase, user.id),
    getServerLanguage(),
  ]);
  const resources = await preloadNamespaces(lang, ['teacher']);
  const filteredActivities = filterActivities(ownedActivities, statusFilter, sortBy, searchQuery);
  const recentActivities = filteredActivities.slice(0, 6);
  const collectionCount = filteredActivities.length;

  return (
    <I18nProvider lang={lang} resources={resources}>
      <TeacherLibraryContent
        recentActivities={recentActivities}
        collectionCount={collectionCount}
        statusFilter={statusFilter}
        sortBy={sortBy}
        searchQuery={searchQuery}
      />
    </I18nProvider>
  );
}
