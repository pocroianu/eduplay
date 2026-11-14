import { getAdminClient, logSection, logSuccess, logError } from '../config';
import type { SeedTierData } from '../types';
import type { UserIdMap } from './auth-users';

export async function seedParentLinks(data: SeedTierData, userIds: UserIdMap): Promise<void> {
  const client = getAdminClient();
  let linkCount = 0;

  logSection('Creating parent-child links...');

  for (const parent of data.parents) {
    const parentId = userIds.parentIds.get(parent.email);
    if (!parentId) {
      logError(`Parent not found: ${parent.email}`);
      continue;
    }

    for (const child of parent.children) {
      const studentId = userIds.studentIds.get(child.username);
      if (!studentId) {
        logError(`Student not found for parent link: ${child.username}`);
        continue;
      }

      // Create parent_children junction record
      const { error } = await client
        .from('parent_children')
        .upsert(
          {
            parent_id: parentId,
            student_id: studentId,
            relationship_type: child.relationshipType,
            status: 'active',
            linked_at: new Date().toISOString(),
          },
          { onConflict: 'parent_id,student_id' }
        );

      if (error) {
        logError(`Failed to link ${parent.fullName} → ${child.username}: ${error.message}`);
        continue;
      }

      // Also set legacy parent_id on students table (for first parent only)
      await client
        .from('students')
        .update({ parent_id: parentId })
        .eq('id', studentId)
        .is('parent_id', null);

      linkCount++;
    }
  }

  logSuccess(`Created ${linkCount} parent-child links`);
}
