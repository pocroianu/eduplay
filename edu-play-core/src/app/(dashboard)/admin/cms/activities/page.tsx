import { AdminActivitiesTable, PageHeader, StatStrip, type StatStripItem } from '@/features/admin';
import {
  activityRowSchema,
  activityTypeRowSchema,
  type ActivityRow,
  type ActivityTypeRow,
} from '@/features/api';
import {
  buildMeta,
  camelCaseKeys,
  parseRows,
  type PaginationMeta,
} from '@/lib/api';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Activități CMS — Administrare',
};

export const dynamic = 'force-dynamic';

interface ActivityStatusCounts {
  draft: number;
  inReview: number;
  published: number;
  archived: number;
}

const EMPTY_STATUS_COUNTS: ActivityStatusCounts = {
  draft: 0,
  inReview: 0,
  published: 0,
  archived: 0,
};

export async function getInitialActivities(): Promise<{
  activities: ActivityRow[];
  activityTypes: ActivityTypeRow[];
  subjectOptions: string[];
  statusCounts: ActivityStatusCounts;
  meta: PaginationMeta;
}> {
  const supabase = await createClient();
  const pagination = { page: 1, perPage: 20 };
  const [
    activitiesRes,
    typesRes,
    subjectsRes,
    draftCountRes,
    inReviewCountRes,
    publishedCountRes,
    archivedCountRes,
  ] = await Promise.all([
    supabase
      .from('activities')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(0, 19),
    supabase
      .from('activity_types')
      .select('*')
      .order('type_id', { ascending: true }),
    supabase
      .from('activities')
      .select('subject')
      .order('subject', { ascending: true }),
    supabase
      .from('activities')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'draft'),
    supabase
      .from('activities')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'in_review'),
    supabase
      .from('activities')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published'),
    supabase
      .from('activities')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'archived'),
  ]);

  if (activitiesRes.error) {
    throw activitiesRes.error;
  }
  if (typesRes.error) {
    throw typesRes.error;
  }
  if (subjectsRes.error) {
    throw subjectsRes.error;
  }
  for (const result of [
    draftCountRes,
    inReviewCountRes,
    publishedCountRes,
    archivedCountRes,
  ]) {
    if (result.error) {
      throw result.error;
    }
  }

  const subjectOptions = Array.from(
    new Set(
      (subjectsRes.data ?? [])
        .map((row) => row.subject)
        .filter((subject): subject is string => typeof subject === 'string' && subject.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b, 'ro-RO'));

  return {
    activities: parseRows(
      (activitiesRes.data ?? []).map(camelCaseKeys),
      activityRowSchema,
      'admin cms activities page',
    ),
    activityTypes: parseRows(
      (typesRes.data ?? []).map(camelCaseKeys),
      activityTypeRowSchema,
      'admin cms activity types page',
    ),
    subjectOptions,
    statusCounts: {
      draft: draftCountRes.count ?? 0,
      inReview: inReviewCountRes.count ?? 0,
      published: publishedCountRes.count ?? 0,
      archived: archivedCountRes.count ?? 0,
    },
    meta: buildMeta(pagination, activitiesRes.count ?? 0),
  };
}

export default async function AdminCmsActivitiesPage() {
  let activities: ActivityRow[] = [];
  let activityTypes: ActivityTypeRow[] = [];
  let subjectOptions: string[] = [];
  let statusCounts = EMPTY_STATUS_COUNTS;
  let meta = buildMeta({ page: 1, perPage: 20 }, 0);

  try {
    const data = await getInitialActivities();
    activities = data.activities;
    activityTypes = data.activityTypes;
    subjectOptions = data.subjectOptions;
    statusCounts = data.statusCounts;
    meta = data.meta;
  } catch (error) {
    console.error('Eroare la încărcarea activităților CMS:', error);
  }

  const stats: StatStripItem[] = [
    {
      key: 'total',
      label: 'Activități în CMS',
      value: meta.total,
      icon: 'PuzzlePiece',
      hint: 'Primele 20 sunt afișate implicit',
    },
    {
      key: 'draft',
      label: 'Ciorne',
      value: statusCounts.draft,
      icon: 'Pencil',
      hint: 'Pot fi publicate în lot',
    },
    {
      key: 'published',
      label: 'Publicate',
      value: statusCounts.published,
      icon: 'Eye',
      hint: 'Disponibile în fluxul de conținut',
    },
    {
      key: 'archived',
      label: 'Arhivate',
      value: statusCounts.archived,
      icon: 'Trash',
      hint: 'Ascunse, fără ștergere fizică',
    },
  ];

  return (
    <div data-testid="admin-cms-activities-page" className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Administrare CMS"
        title="Activități"
        description="Filtrează activitățile după status, tip și materie, apoi publică drafturile aprobate sau arhivează conținutul retras."
      />

      <StatStrip items={stats} />

      <AdminActivitiesTable
        initialActivities={activities}
        activityTypes={activityTypes}
        subjectOptions={subjectOptions}
        initialMeta={meta}
      />
    </div>
  );
}
