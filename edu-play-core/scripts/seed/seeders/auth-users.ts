import type { User } from '@supabase/supabase-js';

import { getAdminClient, logSection, logSuccess, logError } from '../config';
import { studentPinToAuthPassword } from '../../../src/features/auth/utils/student-auth-password';
import type { SeedTierData } from '../types';

export interface UserIdMap {
  teacherIds: Map<string, string>; // email → auth user id
  parentIds: Map<string, string>;  // email → auth user id
  studentIds: Map<string, string>; // username → auth user id
}

async function findAuthUserByEmail(email: string): Promise<User | null> {
  const client = getAdminClient();
  const perPage = 1000;
  for (let page = 1; page < 20; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Failed to list auth users: ${error.message}`);
    const found = data.users.find((user) => user.email === email);
    if (found) return found;
    if (data.users.length < perPage) return null;
  }
  throw new Error(`Unable to find seed user ${email}: auth user list is too large`);
}

async function ensureUser(
  id: string,
  email: string,
  password: string,
  fullName: string,
  role: 'teacher' | 'parent' | 'student',
): Promise<string | null> {
  const client = getAdminClient();
  const existing = await findAuthUserByEmail(email);

  if (existing && existing.id !== id) {
    const { error } = await client.auth.admin.deleteUser(existing.id);
    if (error) {
      logError(`Failed to delete mismatched ${role} ${email}: ${error.message}`);
      return null;
    }
  } else if (existing) {
    const { error } = await client.auth.admin.updateUserById(id, {
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });
    if (error) {
      logError(`Failed to update ${role} ${fullName} (${email}): ${error.message}`);
      return null;
    }
    return id;
  }

  const { data: userData, error } = await client.auth.admin.createUser({
    id,
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });

  if (!error && userData?.user) {
    return userData.user.id;
  }

  logError(`Failed to create ${role} ${fullName} (${email}): ${error?.message}`);
  return null;
}

export async function seedAuthUsers(data: SeedTierData): Promise<UserIdMap> {
  const teacherIds = new Map<string, string>();
  const parentIds = new Map<string, string>();
  const studentIds = new Map<string, string>();

  logSection(`Creating ${data.teachers.length} teachers...`);
  for (const teacher of data.teachers) {
    const id = await ensureUser(teacher.id, teacher.email, teacher.password, teacher.fullName, 'teacher');
    if (id) {
      teacherIds.set(teacher.email, id);
      logSuccess(`Teacher: ${teacher.fullName} (${teacher.email})`);
    }
  }

  logSection(`Creating ${data.parents.length} parents...`);
  for (const parent of data.parents) {
    const id = await ensureUser(parent.id, parent.email, parent.password, parent.fullName, 'parent');
    if (id) {
      parentIds.set(parent.email, id);
      logSuccess(`Parent: ${parent.fullName} (${parent.email})`);
    }
  }

  logSection(`Creating ${data.students.length} Learners...`);
  for (const student of data.students) {
    const email = `${student.username}@student.eduplay.ro`;
    const id = await ensureUser(student.id, email, studentPinToAuthPassword(student.pin), student.fullName, 'student');
    if (id) {
      studentIds.set(student.username, id);
      logSuccess(`Learner: ${student.fullName} (${student.username} / PIN: ${student.pin})`);
    }
  }

  return { teacherIds, parentIds, studentIds };
}
