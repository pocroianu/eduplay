import { getAdminClient, logSection, logSuccess, logError } from '../config';
import { seedUuid } from '../ids';
import type { SeedTierData } from '../types';
import type { UserIdMap } from './auth-users';

const BASE_NOTIFICATION_DATE = Date.UTC(2026, 4, 18, 9, 0, 0);

export async function seedNotifications(
  data: SeedTierData,
  userIds: UserIdMap,
): Promise<void> {
  if (data.tier === 'minimal') {
    return;
  }

  const client = getAdminClient();

  logSection('Creating parent notifications...');

  const notificationTypes = [
    'assignment_completed',
    'milestone',
    'assignment_due',
    'achievement',
    'weekly_summary',
  ] as const;

  const messages: Record<string, { title: string; message: string }> = {
    assignment_completed: {
      title: 'Activitate finalizată!',
      message: 'Copilul tău a terminat o activitate cu succes!',
    },
    milestone: {
      title: 'Realizare nouă!',
      message: 'Copilul tău a atins o realizare importantă!',
    },
    assignment_due: {
      title: 'Activitate aproape scadentă',
      message: 'O activitate atribuită este scadentă în curând.',
    },
    achievement: {
      title: 'Bravo!',
      message: 'Copilul tău a obținut un premiu nou!',
    },
    weekly_summary: {
      title: 'Rezumatul săptămânal',
      message: 'Iată ce activități a realizat copilul tău săptămâna aceasta.',
    },
  };

  let notifCount = 0;

  for (const parent of data.parents) {
    const parentId = userIds.parentIds.get(parent.email);
    if (!parentId) continue;

    for (const child of parent.children) {
      const studentId = userIds.studentIds.get(child.username);
      if (!studentId) continue;

      const count = 2 + (notifCount % 2);
      for (let i = 0; i < count; i++) {
        const type = notificationTypes[(notifCount + i) % notificationTypes.length];
        const msg = messages[type];
        const createdAt = new Date(BASE_NOTIFICATION_DATE - (i + 1) * 24 * 60 * 60 * 1000).toISOString();

        const { error } = await client.from('parent_notifications').upsert(
          {
            id: seedUuid(`baseline:notification:${data.tier}:${parentId}:${studentId}:${i}`),
            parent_id: parentId,
            student_id: studentId,
            type,
            title: msg.title,
            message: msg.message,
            data: { seed: true, seedTier: data.tier, seedSource: 'baseline' },
            read_at: i === 0 ? null : createdAt,
            created_at: createdAt,
          },
          { onConflict: 'id' },
        );

        if (error) {
          logError(`Notification for ${parent.fullName}: ${error.message}`);
          continue;
        }
        notifCount++;
      }
    }
  }

  logSuccess(`Created ${notifCount} parent notifications`);
}
