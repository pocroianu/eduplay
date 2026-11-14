import {
  ApiError,
  camelCaseKeys,
  handleRoute,
  parseBody,
  parseRow,
  parseRows,
  requireRole,
  success,
} from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/server';
import { recordAdminAction } from '@/lib/admin/audit';
import {
  adminLinkedChildRowSchema,
  adminLinkedClassRowSchema,
  adminUserAuditHeadRowSchema,
  adminUserDetailRowSchema,
  adminUserStatusRowSchema,
  updateAdminUserSchema,
} from '@/features/admin/api/schemas';
import { z } from 'zod';

interface UserContext {
  params: Promise<{ id: string }>;
}

const userIdSchema = z.string().uuid('Invalid user id');

// 100 years; Supabase represents "permanent" ban as a long duration string.
const PERMA_BAN = '876000h';

// ---------------------------------------------------------------------------
// GET /api/v1/admin/users/:id — profile + linked records
// ---------------------------------------------------------------------------
export const GET = handleRoute(async (_req, context) => {
  const { supabase } = await requireRole('admin');
  const { id } = await (context as UserContext).params;
  const userId = userIdSchema.parse(id);

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, status, avatar_url, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  if (!profile) throw ApiError.notFound('User');

  const adminClient = createAdminClient();

  const [classes, children, authResult, auditHead] = await Promise.all([
    profile.role === 'teacher'
      ? supabase
          .from('classes')
          .select('id, name, grade_level, school_year, is_active')
          .eq('teacher_id', userId)
      : Promise.resolve({ data: [], error: null }),
    profile.role === 'parent'
      ? supabase
          .from('students')
          .select('id, username')
          .eq('parent_id', userId)
      : Promise.resolve({ data: [], error: null }),
    adminClient.auth.admin.getUserById(userId),
    supabase
      .from('audit_logs')
      .select('id, action, table_name, changed_at')
      .eq('changed_by', userId)
      .order('changed_at', { ascending: false })
      .limit(5),
  ]);

  const parsedProfile = parseRow(
    camelCaseKeys(profile),
    adminUserDetailRowSchema,
    'GET /api/v1/admin/users/:id',
  );
  const parsedClasses = parseRows(
    (classes.data ?? []).map(camelCaseKeys),
    adminLinkedClassRowSchema,
    'GET /api/v1/admin/users/:id classes',
  );
  const parsedChildren = parseRows(
    (children.data ?? []).map(camelCaseKeys),
    adminLinkedChildRowSchema,
    'GET /api/v1/admin/users/:id children',
  );
  const parsedAuditHead = parseRows(
    (auditHead.data ?? []).map(camelCaseKeys),
    adminUserAuditHeadRowSchema,
    'GET /api/v1/admin/users/:id auditHead',
  );

  return success({
    ...parsedProfile,
    lastSignInAt: authResult.data.user?.last_sign_in_at ?? null,
    bannedUntil: authResult.data.user?.banned_until ?? null,
    classes: parsedClasses,
    children: parsedChildren,
    auditHead: parsedAuditHead,
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/admin/users/:id — toggle status
// ---------------------------------------------------------------------------
export const PATCH = handleRoute(async (req, context) => {
  const { supabase, user } = await requireRole('admin');
  const { id } = await (context as UserContext).params;
  const userId = userIdSchema.parse(id);
  const patch = await parseBody(req, updateAdminUserSchema);

  if (userId === user.id && patch.status === 'suspended') {
    throw ApiError.validation('Admins cannot suspend themselves');
  }

  const { data: before, error: loadError } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, status')
    .eq('id', userId)
    .maybeSingle();

  if (loadError) throw new ApiError('INTERNAL_ERROR', loadError.message);
  if (!before) throw ApiError.notFound('User');

  const adminClient = createAdminClient();

  // Mirror the change into auth.users so a suspended user actually
  // cannot log in — RLS-only would still allow signInWithPassword.
  const banUpdate = patch.status === 'suspended'
    ? { ban_duration: PERMA_BAN }
    : { ban_duration: 'none' };
  const { error: banError } = await adminClient.auth.admin.updateUserById(
    userId,
    banUpdate,
  );
  if (banError) {
    throw new ApiError('INTERNAL_ERROR', banError.message);
  }

  const { data: after, error: updateError } = await adminClient
    .from('profiles')
    .update({ status: patch.status })
    .eq('id', userId)
    .select('id, email, full_name, role, status')
    .single();

  if (updateError || !after) {
    throw new ApiError(
      'INTERNAL_ERROR',
      updateError?.message ?? 'Failed to update profile',
    );
  }

  await recordAdminAction({
    actorId: user.id,
    action: patch.status === 'suspended' ? 'user_suspended' : 'user_reactivated',
    resourceType: 'profiles',
    resourceId: userId,
    before: { status: before.status },
    after: { status: after.status },
  });

  return success(
    parseRow(
      camelCaseKeys(after),
      adminUserStatusRowSchema,
      'PATCH /api/v1/admin/users/:id',
    ),
  );
});
