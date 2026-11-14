import { getAdminClient, logSection, logSuccess, logError } from '../config';
import type { SeedTierData } from '../types';
import type { UserIdMap } from './auth-users';
import type { ClassIdMap } from './classes';

export async function seedStudents(
  data: SeedTierData,
  userIds: UserIdMap,
  classMap: ClassIdMap
): Promise<void> {
  const client = getAdminClient();

  logSection(`Creating ${data.students.length} student records...`);

  for (const student of data.students) {
    const authUserId = userIds.studentIds.get(student.username);
    if (!authUserId) {
      logError(`Auth user not found for student ${student.username}`);
      continue;
    }

    const classId = classMap.classIds.get(student.className);
    if (!classId) {
      logError(`Class not found for student ${student.username}: ${student.className}`);
      continue;
    }

    // Upsert student record (profiles row already created by trigger)
    const { error: studentError } = await client
      .from('students')
      .upsert(
        {
          id: authUserId,
          class_id: classId,
          username: student.username,
        },
        { onConflict: 'id' }
      );

    if (studentError) {
      logError(`Failed to create student record for ${student.username}: ${studentError.message}`);
      continue;
    }

    // Update date_of_birth on profiles
    if (student.dateOfBirth) {
      await client
        .from('profiles')
        .update({ date_of_birth: student.dateOfBirth })
        .eq('id', authUserId);
    }

    logSuccess(`Student record: ${student.fullName} → ${student.className}`);
  }
}
