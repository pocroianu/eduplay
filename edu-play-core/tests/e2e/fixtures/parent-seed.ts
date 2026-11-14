import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  createClient,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

import { studentPinToAuthPassword } from '../../../src/features/auth/utils/student-auth-password';
import type { Database, TablesInsert } from '../../../src/shared/types/database';
import {
  testClass,
  testGame,
  testAdmin,
  testParent,
  testParentChildren,
  testTeacher,
} from './test-data';

const CHILD_ARTIFACTS_BUCKET = 'child-artifacts';
const TEST_INVITE_CODE_HASH =
  '$2b$10$wQxP3O/zUYzARV84YQxwAeKPBDjK7Okaj5s3u8K1SC8APWZHjzG5G';
const ARTIFACT_ASSET_PATH = path.join(
  process.cwd(),
  'tests',
  'e2e',
  'fixtures',
  'assets',
  'parent-seed-artifact.png',
);

type ParentSeedClient = SupabaseClient<Database>;
type ProfileInsert = TablesInsert<'profiles'>;
type ClassInsert = TablesInsert<'classes'>;
type StudentInsert = TablesInsert<'students'>;
type ActivityInsert = TablesInsert<'activities'>;
type ActivityVersionInsert = TablesInsert<'activity_versions'>;
type InviteCodeInsert = TablesInsert<'parent_invite_codes'>;
type ParentChildInsert = TablesInsert<'parent_children'>;
type ChildArtifactInsert = TablesInsert<'child_artifacts'>;
type ActivityProgressInsert = TablesInsert<'activity_progress'>;

export interface ParentSeedChildInput {
  id: string;
  username: string;
  fullName: string;
  pin: string;
}

export interface BuildParentSeedRowsInput {
  teacherId: string;
  parentId: string;
  classId: string;
  gameId: string;
  now: Date;
  contentChildCount: number;
  children: readonly ParentSeedChildInput[];
}

export interface ParentSeedRows {
  profiles: ProfileInsert[];
  classRow: ClassInsert;
  activityRow: ActivityInsert;
  activityVersionRow: ActivityVersionInsert;
  students: StudentInsert[];
  inviteCodes: InviteCodeInsert[];
  parentChildren: ParentChildInsert[];
  familyArtifacts: ChildArtifactInsert[];
  draftArtifacts: ChildArtifactInsert[];
  activityProgress: ActivityProgressInsert[];
}

export interface ParentSeedResult {
  teacherId: string;
  parentId: string;
  classId: string;
  gameId: string;
  children: Array<{
    id: string;
    username: string;
    hasContent: boolean;
  }>;
  familyArtifactIds: string[];
  draftArtifactIds: string[];
}

interface SeedParentE2EDataOptions {
  supabase?: ParentSeedClient;
  now?: Date;
  contentChildCount?: number;
}

export function buildParentSeedRows({
  teacherId,
  parentId,
  classId,
  gameId,
  now,
  contentChildCount,
  children,
}: BuildParentSeedRowsInput): ParentSeedRows {
  const timestamp = now.toISOString();
  const contentChildren = children.slice(0, contentChildCount);

  return {
    profiles: [
      {
        id: teacherId,
        email: testTeacher.email,
        full_name: testTeacher.name,
        role: 'teacher',
        preferred_language: 'ro',
        status: 'active',
      },
      {
        id: testAdmin.id,
        email: testAdmin.email,
        full_name: testAdmin.name,
        role: 'admin',
        preferred_language: 'ro',
        status: 'active',
      },
      {
        id: parentId,
        email: testParent.email,
        full_name: testParent.name,
        role: 'parent',
        preferred_language: 'ro',
        status: 'active',
      },
      ...children.map((child) => ({
        id: child.id,
        email: `${child.username}@student.eduplay.ro`,
        full_name: child.fullName,
        role: 'student',
        preferred_language: 'ro',
        status: 'active',
      })),
    ],
    classRow: {
      id: classId,
      teacher_id: teacherId,
      name: testClass.name,
      description: testClass.description,
      grade_level: testClass.gradeLevel,
      school_year: '2025-2026',
      is_active: true,
    },
    activityRow: {
      id: gameId,
      title: testGame.name,
      description: 'Activitate seed pentru testele E2E parinte',
      template: 'multiple-choice',
      category: testGame.category,
      difficulty: 'easy',
      target_age_min: testGame.minAge,
      target_age_max: testGame.maxAge,
      estimated_duration: 5,
      is_published: true,
      status: 'published',
      visibility_scope: 'public',
    },
    activityVersionRow: {
      id: stableUuid(`activity-version:${gameId}:v1`),
      activity_id: gameId,
      activity_type_id: 'multiple-choice',
      version_number: 1,
      config_data: {},
      config_schema_version: 1,
      published_by_user_id: teacherId,
      published_at: timestamp,
    },
    students: children.map((child) => ({
      id: child.id,
      class_id: classId,
      parent_id: null,
      username: child.username,
      avatar_url: null,
    })),
    inviteCodes: children.map((child) => ({
      id: stableUuid(`parent-invite:${child.id}`),
      code_hash: TEST_INVITE_CODE_HASH,
      student_id: child.id,
      teacher_id: teacherId,
      expires_at: addDays(now, 30).toISOString(),
      used_at: timestamp,
      used_by: parentId,
      is_revoked: false,
      created_at: timestamp,
    })),
    parentChildren: children.map((child) => ({
      id: stableUuid(`parent-child:${parentId}:${child.id}`),
      parent_id: parentId,
      student_id: child.id,
      relationship_type: 'guardian',
      linked_at: timestamp,
      linked_via_code: stableUuid(`parent-invite:${child.id}`),
      status: 'active',
    })),
    familyArtifacts: contentChildren.map((child, index) => ({
      id: stableUuid(`family-artifact:${child.id}`),
      student_id: child.id,
      class_id: classId,
      title: `Lucrare familie ${index + 1}`,
      artifact_type: 'drawing',
      storage_path: `${child.id}/e2e-family-artifact-${index + 1}.png`,
      visibility: 'family_visible',
      reviewed_by: teacherId,
      reviewed_at: addMinutes(now, -(index + 1) * 3).toISOString(),
      created_at: addMinutes(now, -(index + 1) * 10).toISOString(),
      updated_at: addMinutes(now, -(index + 1) * 3).toISOString(),
    })),
    draftArtifacts: contentChildren.slice(0, 1).map((child) => ({
      id: stableUuid(`draft-artifact:${child.id}`),
      student_id: child.id,
      class_id: classId,
      title: 'Lucrare de publicat E2E',
      artifact_type: 'drawing',
      storage_path: `${child.id}/e2e-draft-artifact.png`,
      visibility: 'draft',
      reviewed_by: null,
      reviewed_at: null,
      created_at: addMinutes(now, -45).toISOString(),
      updated_at: addMinutes(now, -45).toISOString(),
    })),
    activityProgress: contentChildren.map((child, index) => ({
      id: stableUuid(`activity-progress:${child.id}:${gameId}`),
      student_id: child.id,
      activity_id: gameId,
      status: 'completed',
      score: 80 + index * 10,
      time_spent: 180 + index * 30,
      attempts: 1,
      last_played_at: addMinutes(now, -(index + 1) * 5).toISOString(),
      completed_at: addMinutes(now, -(index + 1) * 5).toISOString(),
      data: {
        source: 'parent-e2e-seed',
        stars: 3,
      },
    })),
  };
}

export function buildTeacherInsertableArtifactRows(
  rows: readonly ChildArtifactInsert[],
): ChildArtifactInsert[] {
  return rows.map((row) =>
    row.visibility === 'draft'
      ? row
      : {
          ...row,
          visibility: 'draft',
          reviewed_by: null,
          reviewed_at: null,
        },
  );
}

export async function seedParentE2EData(
  options: SeedParentE2EDataOptions = {},
): Promise<ParentSeedResult> {
  const supabase = options.supabase ?? createParentSeedClient();
  const now = options.now ?? new Date();
  const children = testParentChildren.map((child) => ({
    id: child.id,
    username: child.username,
    fullName: child.name,
    pin: child.pin,
  }));

  await ensureAuthUser(supabase, {
    id: testTeacher.id,
    email: testTeacher.email,
    password: testTeacher.password,
    fullName: testTeacher.name,
    role: testTeacher.role,
  });
  await ensureAuthUser(supabase, {
    id: testAdmin.id,
    email: testAdmin.email,
    password: testAdmin.password,
    fullName: testAdmin.name,
    role: testAdmin.role,
  });
  await ensureAuthUser(supabase, {
    id: testParent.id,
    email: testParent.email,
    password: testParent.password,
    fullName: testParent.name,
    role: testParent.role,
  });
  for (const child of children) {
    await ensureAuthUser(supabase, {
      id: child.id,
      email: `${child.username}@student.eduplay.ro`,
      password: child.pin,
      fullName: child.fullName,
      role: 'student',
    });
  }

  const rows = buildParentSeedRows({
    teacherId: testTeacher.id,
    parentId: testParent.id,
    classId: testClass.id,
    gameId: testGame.id,
    now,
    contentChildCount: options.contentChildCount ?? 2,
    children,
  });

  await cleanupGeneratedParentRows(supabase, {
    teacherId: testTeacher.id,
    parentId: testParent.id,
    childIds: children.map((child) => child.id),
  });

  await upsertProfiles(supabase, rows.profiles);
  await upsertActivities(supabase, [rows.activityRow]);
  await insertMissingActivityVersions(supabase, [rows.activityVersionRow]);
  await upsertClasses(supabase, [rows.classRow]);
  await upsertStudents(supabase, rows.students);
  await upsertInviteCodes(supabase, rows.inviteCodes);
  await upsertParentChildren(supabase, rows.parentChildren);
  const teacherSupabase = await createTeacherSeedClient();
  await upsertChildArtifacts(
    teacherSupabase,
    buildTeacherInsertableArtifactRows([
      ...rows.familyArtifacts,
      ...rows.draftArtifacts,
    ]),
  );
  await publishFamilyVisibleArtifacts(teacherSupabase, rows.familyArtifacts);
  await upsertActivityProgress(supabase, rows.activityProgress);
  await uploadArtifactFixtures(supabase, [
    ...rows.familyArtifacts,
    ...rows.draftArtifacts,
  ]);

  return {
    teacherId: testTeacher.id,
    parentId: testParent.id,
    classId: testClass.id,
    gameId: testGame.id,
    children: children.map((child, index) => ({
      id: child.id,
      username: child.username,
      hasContent: index < (options.contentChildCount ?? 2),
    })),
    familyArtifactIds: rows.familyArtifacts.map((artifact) => artifact.id!),
    draftArtifactIds: rows.draftArtifacts.map((artifact) => artifact.id!),
  };
}

function createParentSeedClient(): ParentSeedClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Parent E2E seed requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
    );
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function createTeacherSeedClient(): Promise<ParentSeedClient> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error(
      'Parent E2E seed requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY',
    );
  }

  const supabase = createClient<Database>(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error } = await supabase.auth.signInWithPassword({
    email: testTeacher.email,
    password: testTeacher.password,
  });

  if (error) {
    throw new Error(`Failed to authenticate fixture teacher: ${error.message}`);
  }

  return supabase;
}

async function ensureAuthUser(
  supabase: ParentSeedClient,
  input: {
    id: string;
    email: string;
    password: string;
    fullName: string;
    role: 'teacher' | 'parent' | 'student' | 'admin';
  },
): Promise<User> {
  const existing = await findAuthUserByEmail(supabase, input.email);

  if (existing && existing.id !== input.id) {
    const { error } = await supabase.auth.admin.deleteUser(existing.id);
    if (error) {
      throw new Error(
        `Failed to delete mismatched fixture user ${input.email}: ${error.message}`,
      );
    }
  } else if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(input.id, {
      email: input.email,
      email_confirm: true,
      user_metadata: {
        full_name: input.fullName,
        role: input.role,
      },
      ...(await buildPasswordAttributes(input)),
    });
    if (error || !data.user) {
      throw new Error(
        `Failed to update fixture user ${input.email}: ${error?.message ?? 'missing user'}`,
      );
    }
    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    id: input.id,
    email: input.email,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName,
      role: input.role,
    },
    ...(await buildPasswordAttributes(input)),
  });

  if (error || !data.user) {
    throw new Error(
      `Failed to create fixture user ${input.email}: ${error?.message ?? 'missing user'}`,
    );
  }

  return data.user;
}

async function buildPasswordAttributes(input: {
  password: string;
  role: 'teacher' | 'parent' | 'student' | 'admin';
}): Promise<{ password: string } | { password_hash: string }> {
  if (input.role !== 'student') {
    return { password: input.password };
  }

  return { password_hash: await bcrypt.hash(studentPinToAuthPassword(input.password), 10) };
}

async function findAuthUserByEmail(
  supabase: ParentSeedClient,
  email: string,
): Promise<User | null> {
  const perPage = 1000;
  for (let page = 1; page < 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`);
    }
    const found = data.users.find((user) => user.email === email);
    if (found) {
      return found;
    }
    if (data.users.length < perPage) {
      return null;
    }
  }
  throw new Error(`Unable to find fixture user ${email}: auth user list is too large`);
}

async function cleanupGeneratedParentRows(
  supabase: ParentSeedClient,
  input: {
    teacherId: string;
    parentId: string;
    childIds: string[];
  },
): Promise<void> {
  await deleteRows(
    supabase
      .from('parent_notifications')
      .delete()
      .eq('parent_id', input.parentId),
    'parent_notifications',
  );

  await deleteRows(
    supabase
      .from('assignments')
      .delete()
      .eq('teacher_id', input.teacherId)
      .in('student_id', input.childIds),
    'assignments',
  );
}

async function uploadArtifactFixtures(
  supabase: ParentSeedClient,
  artifacts: readonly ChildArtifactInsert[],
): Promise<void> {
  const asset = await readFile(ARTIFACT_ASSET_PATH);
  for (const artifact of artifacts) {
    const { error } = await supabase.storage
      .from(CHILD_ARTIFACTS_BUCKET)
      .upload(artifact.storage_path, asset, {
        contentType: 'image/png',
        upsert: true,
      });
    if (error) {
      throw new Error(
        `Failed to upload fixture artifact ${artifact.storage_path}: ${error.message}`,
      );
    }
  }
}

async function upsertProfiles(
  supabase: ParentSeedClient,
  rows: ProfileInsert[],
): Promise<void> {
  const { error } = await supabase.from('profiles').upsert(rows, {
    onConflict: 'id',
  });
  if (error) {
    throw new Error(`Failed to upsert profiles: ${error.message}`);
  }
}

async function upsertActivities(
  supabase: ParentSeedClient,
  rows: ActivityInsert[],
): Promise<void> {
  const { error } = await supabase.from('activities').upsert(rows, {
    onConflict: 'id',
  });
  if (error) {
    throw new Error(`Failed to upsert activities: ${error.message}`);
  }
}

async function insertMissingActivityVersions(
  supabase: ParentSeedClient,
  rows: ActivityVersionInsert[],
): Promise<void> {
  const { error } = await supabase.from('activity_versions').upsert(rows, {
    onConflict: 'id',
    ignoreDuplicates: true,
  });
  if (error) {
    throw new Error(`Failed to insert activity_versions: ${error.message}`);
  }
}

async function upsertClasses(
  supabase: ParentSeedClient,
  rows: ClassInsert[],
): Promise<void> {
  const { error } = await supabase.from('classes').upsert(rows, {
    onConflict: 'id',
  });
  if (error) {
    throw new Error(`Failed to upsert classes: ${error.message}`);
  }
}

async function upsertStudents(
  supabase: ParentSeedClient,
  rows: StudentInsert[],
): Promise<void> {
  const { error } = await supabase.from('students').upsert(rows, {
    onConflict: 'id',
  });
  if (error) {
    throw new Error(`Failed to upsert students: ${error.message}`);
  }
}

async function upsertInviteCodes(
  supabase: ParentSeedClient,
  rows: InviteCodeInsert[],
): Promise<void> {
  const { error } = await supabase.from('parent_invite_codes').upsert(rows, {
    onConflict: 'id',
  });
  if (error) {
    throw new Error(`Failed to upsert parent_invite_codes: ${error.message}`);
  }
}

async function upsertParentChildren(
  supabase: ParentSeedClient,
  rows: ParentChildInsert[],
): Promise<void> {
  const { error } = await supabase.from('parent_children').upsert(rows, {
    onConflict: 'parent_id,student_id',
  });
  if (error) {
    throw new Error(`Failed to upsert parent_children: ${error.message}`);
  }
}

async function upsertChildArtifacts(
  supabase: ParentSeedClient,
  rows: ChildArtifactInsert[],
): Promise<void> {
  const { error } = await supabase.from('child_artifacts').upsert(rows, {
    onConflict: 'id',
  });
  if (error) {
    throw new Error(`Failed to upsert child_artifacts: ${error.message}`);
  }
}

async function publishFamilyVisibleArtifacts(
  supabase: ParentSeedClient,
  rows: ChildArtifactInsert[],
): Promise<void> {
  for (const row of rows) {
    if (row.visibility !== 'family_visible') {
      continue;
    }

    if (!row.id) {
      throw new Error('Cannot publish child artifact fixture without an id');
    }

    const { error } = await supabase
      .from('child_artifacts')
      .update({
        visibility: row.visibility,
        reviewed_by: row.reviewed_by,
        reviewed_at: row.reviewed_at,
        updated_at: row.updated_at,
      })
      .eq('id', row.id);
    if (error) {
      throw new Error(`Failed to publish child_artifacts: ${error.message}`);
    }
  }
}

async function upsertActivityProgress(
  supabase: ParentSeedClient,
  rows: ActivityProgressInsert[],
): Promise<void> {
  const { error } = await supabase.from('activity_progress').upsert(rows, {
    onConflict: 'student_id,activity_id',
  });
  if (error) {
    throw new Error(`Failed to upsert activity_progress: ${error.message}`);
  }
}

async function deleteRows(
  operation: PromiseLike<{ error: { message: string } | null }>,
  label: string,
): Promise<void> {
  const { error } = await operation;
  if (error) {
    throw new Error(`Failed to clean ${label}: ${error.message}`);
  }
}

function stableUuid(input: string): string {
  const bytes = Array.from(new TextEncoder().encode(input));
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-8${hex.slice(2, 5)}-${hex}${hex.slice(0, 4)}`;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}
