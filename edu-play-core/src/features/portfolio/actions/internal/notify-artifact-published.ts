import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ArtifactRow } from '../../queries/types';

export interface NotifyArtifactPublishedInput {
  supabase: SupabaseClient;
  artifact: Pick<ArtifactRow, 'id' | 'student_id' | 'title' | 'artifact_type'>;
}

const NOTIFICATION_TITLE = 'Lucrare nouă publicată';

export function buildArtifactPublishedMessage(
  childName: string | null,
  artifactTitle: string | null,
): string {
  const child = childName?.trim() ? childName.trim() : 'copilul tău';
  const title = artifactTitle?.trim();
  if (title) {
    return `Vulpița a publicat „${title}” pentru ${child}.`;
  }
  return `Vulpița a publicat o lucrare nouă pentru ${child}.`;
}

/**
 * Fan out an `artifact_published` notification to every parent linked to the
 * student. Failures are swallowed (logged) so the publish flow keeps its
 * success contract — parents will still see the artifact in the feed query
 * even if the notification fan-out errors.
 */
export async function notifyArtifactPublished({
  supabase,
  artifact,
}: NotifyArtifactPublishedInput): Promise<void> {
  let childName: string | null = null;
  try {
    const { data: student } = await supabase
      .from('students')
      .select('username')
      .eq('id', artifact.student_id)
      .maybeSingle();
    childName = (student as { username: string | null } | null)?.username ?? null;
  } catch (err) {
    console.warn('notifyArtifactPublished: failed to resolve student name', err);
  }

  const message = buildArtifactPublishedMessage(childName, artifact.title);

  // Defend the publish contract on two fronts: the RPC's `error` channel AND
  // a hard reject from `await supabase.rpc(...)` itself (transient transport
  // / service errors). Either path bubbling out would mark the publish as
  // failed even though the row UPDATE already landed — and a teacher retry
  // would land us in duplicate-notification territory.
  try {
    const { error } = await supabase.rpc('notify_linked_parents', {
      p_student_id: artifact.student_id,
      p_type: 'artifact_published',
      p_title: NOTIFICATION_TITLE,
      p_message: message,
      p_data: {
        artifact_id: artifact.id,
        artifact_type: artifact.artifact_type,
      },
    });

    if (error) {
      console.error(
        'notifyArtifactPublished: notify_linked_parents failed',
        error,
      );
    }
  } catch (err) {
    console.error(
      'notifyArtifactPublished: notify_linked_parents threw',
      err,
    );
  }
}
