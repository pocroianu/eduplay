import { getAdminClient, logSection, logSuccess, logError } from '../config';
import type { SeedTierData } from '../types';
import type { UserIdMap } from './auth-users';

export interface ClassIdMap {
  classIds: Map<string, string>; // class name → class id
}

export async function seedClasses(data: SeedTierData, userIds: UserIdMap): Promise<ClassIdMap> {
  const client = getAdminClient();
  const classIds = new Map<string, string>();

  logSection(`Creating ${data.classes.length} classes...`);

  for (const cls of data.classes) {
    const teacherId = userIds.teacherIds.get(cls.teacherEmail);
    if (!teacherId) {
      logError(`Teacher not found for class ${cls.name}: ${cls.teacherEmail}`);
      continue;
    }

    const { data: classData, error } = await client
      .from('classes')
      .upsert(
        {
          id: cls.id,
          teacher_id: teacherId,
          name: cls.name,
          description: cls.description,
          grade_level: cls.gradeLevel,
          school_year: cls.schoolYear,
          is_active: true,
        },
        { onConflict: 'id' }
      )
      .select('id')
      .single();

    if (error) {
      logError(`Failed to create class ${cls.name}: ${error.message}`);
      continue;
    }

    classIds.set(cls.name, classData.id);
    logSuccess(`Class: ${cls.name} (${cls.gradeLevel})`);
  }

  return { classIds };
}
