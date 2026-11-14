import { getAdminClient, logSection, logSuccess, logError } from '../config';
import { seedUuid } from '../ids';
import type { SeedTierData, ProgressStatus } from '../types';
import type { UserIdMap } from './auth-users';
import type { ActivityInfo } from './activities';

const BASE_PLAYED_AT = Date.UTC(2026, 4, 18, 12, 0, 0); // 2026-05-18T12:00:00Z

export async function seedActivityProgress(
  data: SeedTierData,
  userIds: UserIdMap,
  activities: ActivityInfo[],
): Promise<void> {
  const client = getAdminClient();

  if (!activities.length) {
    logError('No Activities available for progress seeding');
    return;
  }

  logSection(`Creating Activity Progress (${data.progressPerStudent} per Learner)...`);

  const statuses: ProgressStatus[] = ['completed', 'in_progress', 'not_started', 'completed'];
  let progressCount = 0;

  for (let si = 0; si < data.students.length; si++) {
    const student = data.students[si];
    const studentId = userIds.studentIds.get(student.username);
    if (!studentId) continue;

    for (let ai = 0; ai < Math.min(data.progressPerStudent, activities.length); ai++) {
      const activity = activities[ai % activities.length];
      const status = statuses[(si + ai) % statuses.length];
      const score = status === 'completed'
        ? 60 + ((si * 7 + ai * 13) % 41)
        : status === 'in_progress'
          ? 20 + ((si * 3 + ai * 11) % 40)
          : null;
      const timeSpent = status !== 'not_started' ? 60 + ((si * 5 + ai * 9) % 240) : 0;
      const attempts = status === 'completed' ? 1 + ((si + ai) % 3) : status === 'in_progress' ? 1 : 0;
      const lastPlayedAt = status !== 'not_started'
        ? new Date(BASE_PLAYED_AT - (si + ai) * 24 * 60 * 60 * 1000).toISOString()
        : null;
      const completedAt = status === 'completed' ? lastPlayedAt : null;

      const { error } = await client.from('activity_progress').upsert(
        {
          id: seedUuid(`baseline:activity-progress:${studentId}:${activity.id}`),
          student_id: studentId,
          activity_id: activity.id,
          last_version_id: activity.versionId,
          status,
          score,
          time_spent: timeSpent,
          attempts,
          last_played_at: lastPlayedAt,
          completed_at: completedAt,
          data: { seed: true, seedTier: data.tier, seedSource: 'baseline' },
        },
        { onConflict: 'student_id,activity_id' },
      );

      if (error) {
        logError(`Activity Progress for ${student.username} on ${activity.title}: ${error.message}`);
        continue;
      }

      progressCount++;
    }
  }

  logSuccess(`Created ${progressCount} Activity Progress records`);
}
