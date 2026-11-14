import { notFound } from 'next/navigation';
import {
  AdminActivityEditor,
  PageHeader,
} from '@/features/admin';
import {
  type ActivityRow,
  type ActivityTypeRow,
  type ActivityVersionRow,
} from '@/features/api';
import {
  parseActivityRowFromDb,
  parseActivityTypeRowFromDb,
  parseActivityVersionRowFromDb,
} from '@/features/activities/server';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Editor activitate CMS — Administrare',
};

export const dynamic = 'force-dynamic';

export async function getEditorData(activityId: string): Promise<{
  activity: ActivityRow;
  activityType: ActivityTypeRow;
  versions: ActivityVersionRow[];
}> {
  const supabase = await createClient();

  const { data: activityData, error: activityError } = await supabase
    .from('activities')
    .select('*')
    .eq('id', activityId)
    .single();

  if (activityError || !activityData) {
    notFound();
  }

  const activity = parseActivityRowFromDb(
    activityData,
    'admin cms activity editor activity',
  );

  const [typeRes, versionsRes] = await Promise.all([
    supabase
      .from('activity_types')
      .select('*')
      .eq('type_id', activity.template)
      .single(),
    supabase
      .from('activity_versions')
      .select('*')
      .eq('activity_id', activity.id)
      .order('version_number', { ascending: false })
      .range(0, 4),
  ]);

  if (typeRes.error || !typeRes.data) {
    throw typeRes.error ?? new Error('Activity type missing');
  }
  if (versionsRes.error) {
    throw versionsRes.error;
  }

  return {
    activity,
    activityType: parseActivityTypeRowFromDb(
      typeRes.data,
      'admin cms activity editor type',
    ),
    versions: (versionsRes.data ?? []).map((row) =>
      parseActivityVersionRowFromDb(
        row,
        'admin cms activity editor versions',
      ),
    ),
  };
}

export default async function AdminCmsActivityEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { activity, activityType, versions } = await getEditorData(id);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Administrare CMS"
        title={activity.title}
        description="Previzualizează draftul, publică activitatea și verifică istoricul versiunilor înainte să ajungă în fluxul elevilor."
      />

      <AdminActivityEditor
        activity={activity}
        activityType={activityType}
        initialVersions={versions}
      />
    </div>
  );
}
