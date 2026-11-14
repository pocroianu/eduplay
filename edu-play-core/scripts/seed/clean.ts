import { getAdminClient, logSection, logSuccess, logError } from './config';
import { getTierSelection } from './phaser-catalog';
import { seedUuid } from './ids';
import type { SeedTierData } from './types';

export async function cleanSeedData(
  data: SeedTierData,
  options: { phaserRoot?: string } = {},
): Promise<void> {
  const client = getAdminClient();

  logSection('Cleaning seed data...');

  const selectedActivities = getTierSelection(data.tier, options.phaserRoot);
  const activityIds = selectedActivities.map((activity) =>
    seedUuid(`baseline:activity:${activity.template}:${activity.sourceActivityId}`),
  );
  const versionIds = selectedActivities.map((activity) =>
    seedUuid(`baseline:activity-version:${activity.template}:${activity.sourceActivityId}:1`),
  );

  const studentUsernames = data.students.map((s) => s.username);
  const studentEmails = studentUsernames.map((u) => `${u}@student.eduplay.ro`);

  const { data: users } = await client.auth.admin.listUsers({ perPage: 1000 });
  const allUsers = users?.users ?? [];

  const studentAuthIds = allUsers
    .filter((u) => studentEmails.includes(u.email ?? ''))
    .map((u) => u.id);

  const parentEmails = data.parents.map((p) => p.email);
  const parentAuthIds = allUsers
    .filter((u) => parentEmails.includes(u.email ?? ''))
    .map((u) => u.id);

  const teacherEmails = data.teachers.map((t) => t.email);
  const teacherAuthIds = allUsers
    .filter((u) => teacherEmails.includes(u.email ?? ''))
    .map((u) => u.id);

  if (parentAuthIds.length) {
    const { error } = await client
      .from('parent_notifications')
      .delete()
      .in('parent_id', parentAuthIds)
      .eq('data->>seedSource', 'baseline');
    if (error) logError(`parent_notifications: ${error.message}`);
    else logSuccess('Deleted baseline parent_notifications records');
  }

  const classIds = data.classes.map((c) => c.id);
  const assignmentIds = classIds.flatMap((classId) =>
    activityIds.map((activityId) => seedUuid(`baseline:assignment:${data.tier}:${classId}:${activityId}`)),
  );

  if (assignmentIds.length) {
    const { error } = await client
      .from('assignments')
      .delete()
      .in('id', assignmentIds);
    if (error) logError(`assignments: ${error.message}`);
    else logSuccess('Deleted baseline Activity assignment records');
  }

  if (studentAuthIds.length && activityIds.length) {
    const { error } = await client
      .from('activity_progress')
      .delete()
      .in('student_id', studentAuthIds)
      .in('activity_id', activityIds);
    if (error) logError(`activity_progress: ${error.message}`);
    else logSuccess('Deleted baseline Activity Progress records');
  }

  // Delete parent_children
  if (parentAuthIds.length) {
    const { error } = await client
      .from('parent_children')
      .delete()
      .in('parent_id', parentAuthIds);
    if (error) logError(`parent_children: ${error.message}`);
    else logSuccess('Deleted parent_children records');
  }

  // Delete students
  if (studentAuthIds.length) {
    const { error } = await client
      .from('students')
      .delete()
      .in('id', studentAuthIds);
    if (error) logError(`students: ${error.message}`);
    else logSuccess('Deleted student records');
  }

  // Delete classes
  if (classIds.length) {
    const { error } = await client
      .from('classes')
      .delete()
      .in('id', classIds);
    if (error) logError(`classes: ${error.message}`);
    else logSuccess('Deleted class records');
  }

  if (versionIds.length) {
    const { error } = await client
      .from('activity_versions')
      .delete()
      .in('id', versionIds);
    if (error) logError(`activity_versions: ${error.message}`);
    else logSuccess('Deleted baseline Activity Versions');
  }

  if (activityIds.length) {
    const { error } = await client
      .from('activities')
      .delete()
      .in('id', activityIds);
    if (error) logError(`activities: ${error.message}`);
    else logSuccess('Deleted baseline Activities');
  }

  // Delete auth users (cascades profiles)
  const allAuthIds = [...teacherAuthIds, ...parentAuthIds, ...studentAuthIds];
  logSection(`Deleting ${allAuthIds.length} auth users...`);

  for (const userId of allAuthIds) {
    const { error } = await client.auth.admin.deleteUser(userId);
    if (error) {
      logError(`Failed to delete auth user ${userId}: ${error.message}`);
    }
  }

  logSuccess(`Cleaned ${allAuthIds.length} seed users and related data`);
}
