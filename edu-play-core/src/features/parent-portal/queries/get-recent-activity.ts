import { createClient } from '@/lib/supabase/server';
import {
  CHILD_ARTIFACTS_BUCKET,
  DEFAULT_ARTIFACT_SIGNED_URL_TTL_SECONDS,
} from '@/shared/lib/storage/artifact-signed-url';
import type {
  ActivityItem,
  ArtifactActivityItem,
  GameProgressActivityItem,
} from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

const IMAGE_ARTIFACT_TYPES: ReadonlySet<ArtifactActivityItem['artifactType']> =
  new Set(['drawing', 'photo']);

interface StudentLite {
  id: string;
  username: string;
  avatar_url: string | null;
}

interface ActivityLite {
  id: string;
  title: string;
  category: string | null;
}

/**
 * Fetch a parent's linked student IDs along with their displayable name + avatar.
 * Used by both the progress and artifact branches so they don't double-fan-out.
 */
async function getLinkedStudentLookup(
  supabase: SupabaseClient,
  parentId: string,
  studentId?: string,
): Promise<Map<string, StudentLite>> {
  const query = supabase
    .from('parent_children')
    .select('student_id, students ( id, username, avatar_url )')
    .eq('parent_id', parentId)
    .eq('status', 'active');
  if (studentId) query.eq('student_id', studentId);
  const { data: linkedChildren, error: childrenError } = await query;

  if (childrenError) {
    console.error('Error fetching linked children for activity:', childrenError);
    return new Map();
  }

  const lookup = new Map<string, StudentLite>();
  for (const row of linkedChildren ?? []) {
    // Supabase nested selects return arrays even for many-to-one — normalize.
    const rel = (row as { students: StudentLite | StudentLite[] | null })
      .students;
    const student = Array.isArray(rel) ? rel[0] : rel;
    if (student?.id) {
      lookup.set(student.id, student);
    }
  }
  return lookup;
}

async function getRecentGameProgress(
  supabase: SupabaseClient,
  students: Map<string, StudentLite>,
  limit: number,
): Promise<GameProgressActivityItem[]> {
  if (students.size === 0) return [];

  const { data, error } = await supabase
    .from('activity_progress')
    .select(
      `
      student_id,
      activity_id,
      score,
      status,
      last_played_at,
      activities:activity_id (
        id,
        title,
        category
      )
    `,
    )
    .in('student_id', Array.from(students.keys()))
    .not('last_played_at', 'is', null)
    .order('last_played_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent activity progress:', error);
    return [];
  }

  return (data ?? []).map((record) => {
    const student = students.get(record.student_id);
    const activity = record.activities as unknown as ActivityLite | null;

    return {
      kind: 'activity_progress' as const,
      studentId: record.student_id,
      studentName: student?.username ?? 'Necunoscut',
      studentAvatar: student?.avatar_url ?? null,
      gameId: record.activity_id,
      gameTitle: activity?.title ?? 'Activitate necunoscută',
      gameCategory: activity?.category ?? null,
      timestamp: record.last_played_at ?? '',
      score: record.score ?? null,
      status: record.status ?? 'not_started',
    };
  });
}

async function getRecentPublishedArtifacts(
  supabase: SupabaseClient,
  students: Map<string, StudentLite>,
  limit: number,
): Promise<ArtifactActivityItem[]> {
  if (students.size === 0) return [];

  const { data, error } = await supabase
    .from('child_artifacts')
    .select(
      'id, student_id, title, artifact_type, storage_path, reviewed_at',
    )
    .in('student_id', Array.from(students.keys()))
    .eq('visibility', 'family_visible')
    .not('reviewed_at', 'is', null)
    .order('reviewed_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent published artifacts:', error);
    return [];
  }

  const rows = (data ?? []) as Array<{
    id: string;
    student_id: string;
    title: string | null;
    artifact_type: ArtifactActivityItem['artifactType'];
    storage_path: string;
    reviewed_at: string | null;
  }>;

  // Sign thumbnails for image-type artifacts only — keeps the per-render
  // storage cost bounded (10 items max, drawings/photos only).
  const thumbnails = await Promise.all(
    rows.map(async (row) => {
      if (!IMAGE_ARTIFACT_TYPES.has(row.artifact_type)) return null;
      try {
        const { data: signed, error } = await supabase.storage
          .from(CHILD_ARTIFACTS_BUCKET)
          .createSignedUrl(
            row.storage_path,
            DEFAULT_ARTIFACT_SIGNED_URL_TTL_SECONDS,
          );
        if (error || !signed?.signedUrl) return null;
        return signed.signedUrl;
      } catch (err) {
        console.warn('Failed to sign artifact thumbnail', err);
        return null;
      }
    }),
  );

  return rows.map((row, idx) => {
    const student = students.get(row.student_id);
    return {
      kind: 'artifact' as const,
      studentId: row.student_id,
      studentName: student?.username ?? 'Necunoscut',
      studentAvatar: student?.avatar_url ?? null,
      artifactId: row.id,
      artifactTitle: row.title ?? null,
      artifactType: row.artifact_type,
      storagePath: row.storage_path,
      thumbnailUrl: thumbnails[idx] ?? null,
      timestamp: row.reviewed_at ?? '',
    };
  });
}

/**
 * Fetch recent feed entries across all children linked to a parent.
 *
 * Interleaves two streams:
 * - `activity_progress` rows ordered by `last_played_at` (kind: `'activity_progress'` compatibility shape)
 * - `child_artifacts` with visibility `family_visible` ordered by `reviewed_at` (kind: `'artifact'`)
 *
 * The combined list is sorted by timestamp descending and capped to `limit`.
 *
 * RLS: Runs as the authenticated parent. parent_children RLS scopes the
 * student lookup; child_artifacts RLS releases family_visible rows only for
 * children linked to the caller via parent_children.
 *
 * @param parentId - The authenticated parent's profile ID
 * @param studentId - Optional linked child; scoped before either stream is limited
 * @param limit - Maximum number of activity items to return (default: 10)
 * @returns Array of merged feed items (Activity Progress + artifacts)
 */
export async function getRecentActivity(
  parentId: string,
  limit: number = 10,
  studentId?: string,
): Promise<ActivityItem[]> {
  try {
    const supabase = await createClient();
    const students = await getLinkedStudentLookup(supabase, parentId, studentId);

    if (students.size === 0) return [];

    const [progress, artifacts] = await Promise.all([
      getRecentGameProgress(supabase, students, limit),
      getRecentPublishedArtifacts(supabase, students, limit),
    ]);

    const merged: ActivityItem[] = [...progress, ...artifacts];
    merged.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return tb - ta;
    });

    return merged.slice(0, limit);
  } catch (error) {
    console.error('getRecentActivity error:', error);
    return [];
  }
}
