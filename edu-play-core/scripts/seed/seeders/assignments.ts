import { getAdminClient, logSection, logSuccess, logError } from '../config';
import { seedUuid } from '../ids';
import type { SeedTierData } from '../types';
import type { UserIdMap } from './auth-users';
import type { ClassIdMap } from './classes';
import type { ActivityInfo } from './activities';

const BASE_DUE_DATE = Date.UTC(2026, 5, 1); // 2026-06-01

export async function seedAssignments(
  data: SeedTierData,
  userIds: UserIdMap,
  classMap: ClassIdMap,
  activities: ActivityInfo[],
): Promise<void> {
  const client = getAdminClient();

  if (!activities.length) {
    logError('No Activities available for assignment seeding');
    return;
  }

  logSection(`Creating Activity assignments (${data.assignmentsPerClass} per class, ${activities.length} Activities available)...`);

  let assignmentCount = 0;

  for (const cls of data.classes) {
    const classId = classMap.classIds.get(cls.name);
    const teacherId = userIds.teacherIds.get(cls.teacherEmail);
    if (!classId || !teacherId) continue;

    for (let i = 0; i < Math.min(data.assignmentsPerClass, activities.length); i++) {
      const activity = activities[i % activities.length];
      const dueDate = new Date(BASE_DUE_DATE + i * 3 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const { error } = await client.from('assignments').upsert(
        {
          id: seedUuid(`baseline:assignment:${data.tier}:${classId}:${activity.id}`),
          teacher_id: teacherId,
          activity_id: activity.id,
          version_id: activity.versionId,
          class_id: classId,
          due_date: dueDate,
          is_mandatory: i < 2,
        },
        { onConflict: 'id' },
      );

      if (error) {
        logError(`Failed assignment for ${cls.name}: ${error.message}`);
        continue;
      }

      assignmentCount++;
    }
  }

  logSuccess(`Created ${assignmentCount} Activity assignments`);
}
