'use server';

import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { createClient } from '@/lib/supabase/server';
import {
  generateInviteCodeSchema,
  type GenerateInviteCodeResult,
} from '../schemas/invite-code.schema';
import { ROUTES } from '@/shared/lib/constants';

/** Characters used for invite code generation (uppercase + digits, no ambiguous chars). */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const BCRYPT_SALT_ROUNDS = 10;
const EXPIRY_DAYS = 7;

/**
 * Generate a random alphanumeric invite code.
 * Uses crypto.getRandomValues for cryptographic randomness.
 */
function generateRandomCode(): string {
  const array = new Uint32Array(CODE_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array, (v) => CODE_CHARS[v % CODE_CHARS.length]).join('');
}

/**
 * Server Action: Generate a parent invite code for a student.
 *
 * Flow:
 * 1. Verify teacher is authenticated
 * 2. Validate input (student ID)
 * 3. Verify teacher owns the student (via class ownership)
 * 4. Revoke any existing unused codes for this student
 * 5. Generate random 8-char code
 * 6. Hash code with bcrypt before storing
 * 7. Insert hashed code with 7-day expiration
 * 8. Return plain code to teacher (only time it is visible)
 */
export async function generateParentInviteCode(
  input: unknown
): Promise<GenerateInviteCodeResult> {
  try {
    // 1. Validate input
    const parsed = generateInviteCodeSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Datele trimise nu sunt valide.',
      };
    }

    const { studentId } = parsed.data;

    // 2. Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Nu ești autentificat.' };
    }

    // 3. Verify user is a teacher
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'teacher') {
      return { success: false, error: 'Doar profesorii pot genera coduri de invitare.' };
    }

    // 4. Verify teacher owns the student via class ownership
    // Student belongs to a class, and that class must belong to this teacher
    const { data: student } = await supabase
      .from('students')
      .select('id, username, class_id')
      .eq('id', studentId)
      .single();

    if (!student) {
      return { success: false, error: 'Elevul nu a fost găsit.' };
    }

    if (!student.class_id) {
      return {
        success: false,
        error: 'Elevul nu este asociat unei clase.',
      };
    }

    const { data: classData } = await supabase
      .from('classes')
      .select('id, teacher_id')
      .eq('id', student.class_id)
      .eq('teacher_id', user.id)
      .single();

    if (!classData) {
      return {
        success: false,
        error: 'Nu ai permisiunea de a genera coduri pentru acest elev.',
      };
    }

    // 5. Revoke any existing unused/unexpired codes for this student
    // (ensures only 1 active code per student at a time)
    await supabase
      .from('parent_invite_codes')
      .update({ is_revoked: true })
      .eq('student_id', studentId)
      .is('used_at', null)
      .eq('is_revoked', false);

    // 6. Generate code and hash it
    const plainCode = generateRandomCode();
    const codeHash = await bcrypt.hash(plainCode, BCRYPT_SALT_ROUNDS);

    // 7. Calculate expiration (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS);

    // 8. Insert hashed code into database
    const { error: insertError } = await supabase
      .from('parent_invite_codes')
      .insert({
        code_hash: codeHash,
        student_id: studentId,
        teacher_id: user.id,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Failed to insert invite code:', insertError);
      return {
        success: false,
        error: 'Nu am putut genera codul de invitare. Încearcă din nou.',
      };
    }

    // 9. Revalidate relevant paths
    revalidatePath(ROUTES.TEACHER.STUDENT(studentId));
    revalidatePath(ROUTES.TEACHER.STUDENTS);

    // 10. Return the plain code (only time it is visible to the teacher)
    return {
      success: true,
      data: {
        code: plainCode,
        expiresAt: expiresAt.toISOString(),
        studentName: student.username,
      },
    };
  } catch (error) {
    console.error('generateParentInviteCode error:', error);
    return {
      success: false,
      error: 'A apărut o eroare neașteptată. Încearcă din nou.',
    };
  }
}
