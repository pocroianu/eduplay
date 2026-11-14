'use server';

import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { createClient } from '@/lib/supabase/server';
import { linkChildSchema, type LinkChildResult } from '../schemas/link-child.schema';
import { ROUTES } from '@/shared/lib/constants';

/**
 * Server Action: Link a parent to a child using an invite code.
 *
 * Flow:
 * 1. Verify parent is authenticated
 * 2. Validate input (invite code + relationship type)
 * 3. Fetch all valid codes (not used, not revoked, not expired)
 * 4. Compare submitted code against each hash with bcrypt
 * 5. Verify parent is not already linked to this child
 * 6. Create parent_children record
 * 7. Mark code as used (set used_at, used_by)
 * 8. Return student info for confirmation message
 */
export async function linkParentToChild(
  input: unknown
): Promise<LinkChildResult> {
  try {
    // 1. Validate input
    const parsed = linkChildSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Datele trimise nu sunt valide.',
      };
    }

    const { inviteCode, relationshipType } = parsed.data;

    // 2. Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Nu ești autentificat.' };
    }

    // 3. Verify user is a parent
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'parent') {
      return { success: false, error: 'Doar părinții pot folosi coduri de invitare.' };
    }

    // 4. Fetch all valid (unused, not revoked, not expired) codes
    const now = new Date().toISOString();
    const { data: validCodes, error: fetchError } = await supabase
      .from('parent_invite_codes')
      .select('id, code_hash, student_id, expires_at')
      .is('used_at', null)
      .eq('is_revoked', false)
      .gte('expires_at', now);

    if (fetchError) {
      console.error('Failed to fetch invite codes:', fetchError);
      return { success: false, error: 'Nu am putut verifica acest cod. Încearcă din nou.' };
    }

    if (!validCodes || validCodes.length === 0) {
      return {
        success: false,
        error: 'Codul de invitare este invalid sau a expirat.',
      };
    }

    // 5. Compare submitted code against all valid code hashes
    let matchedCode: (typeof validCodes)[number] | null = null;

    for (const codeRecord of validCodes) {
      const isMatch = await bcrypt.compare(inviteCode, codeRecord.code_hash);
      if (isMatch) {
        matchedCode = codeRecord;
        break;
      }
    }

    if (!matchedCode) {
      return {
        success: false,
        error: 'Codul de invitare este invalid sau a expirat.',
      };
    }

    // 6. Check if parent is already linked to this student
    const { data: existingLink } = await supabase
      .from('parent_children')
      .select('id, status')
      .eq('parent_id', user.id)
      .eq('student_id', matchedCode.student_id)
      .single();

    if (existingLink) {
      if (existingLink.status === 'active') {
        return {
          success: false,
          error: 'Ești deja asociat cu acest copil.',
        };
      }
      // If the link was previously revoked, we could reactivate it,
      // but for security we treat it as already linked.
      return {
        success: false,
        error: 'Există deja o legătură cu acest copil. Contactează profesorul.',
      };
    }

    // 7. Fetch student info for the confirmation message
    const { data: student } = await supabase
      .from('students')
      .select('id, username, avatar_url')
      .eq('id', matchedCode.student_id)
      .single();

    if (!student) {
      return { success: false, error: 'Elevul asociat codului nu a fost găsit.' };
    }

    // 8. Create parent_children record
    const { data: newLink, error: linkError } = await supabase
      .from('parent_children')
      .insert({
        parent_id: user.id,
        student_id: matchedCode.student_id,
        relationship_type: relationshipType,
        linked_via_code: matchedCode.id,
        linked_at: new Date().toISOString(),
        status: 'active',
      })
      .select('id')
      .single();

    if (linkError) {
      console.error('Failed to create parent-child link:', linkError);
      return {
        success: false,
        error: 'Nu am putut asocia acest copil. Încearcă din nou.',
      };
    }

    // 9. Mark the invite code as used
    const { error: updateError } = await supabase
      .from('parent_invite_codes')
      .update({
        used_at: new Date().toISOString(),
        used_by: user.id,
      })
      .eq('id', matchedCode.id);

    if (updateError) {
      // The link was already created, so we log the error but don't fail
      // The code is effectively consumed by the link creation
      console.error('Failed to mark invite code as used:', updateError);
    }

    // 10. Revalidate relevant paths
    revalidatePath(ROUTES.PARENT.CHILDREN);
    revalidatePath(ROUTES.PARENT.DASHBOARD);

    // 11. Return student info for confirmation
    return {
      success: true,
      data: {
        linkId: newLink.id,
        studentName: student.username,
        studentAvatarUrl: student.avatar_url,
      },
    };
  } catch (error) {
    console.error('linkParentToChild error:', error);
    return {
      success: false,
      error: 'A apărut o eroare neașteptată. Încearcă din nou.',
    };
  }
}
