'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { ROUTES } from '@/shared/lib/constants';
import { CONSENT_KEYS } from '@/features/activities';

const setChildConsentSchema = z.object({
  childId: z.string().uuid('ID copil invalid'),
  consentKey: z.enum(CONSENT_KEYS, { message: 'Cheie de consimțământ invalidă' }),
  value: z.boolean(),
});

export type SetChildConsentInput = z.infer<typeof setChildConsentSchema>;

export interface SetChildConsentResult {
  success: boolean;
  error?: string;
}

/**
 * Server Action: Toggle a single parent-granted consent flag for one child.
 *
 * Goes through the SECURITY DEFINER `set_child_consent` RPC (see migration
 * `20260502000001_student_consents.sql`) so the parent_children link check
 * and the audit-trigger attribution land server-side without an extra
 * column-scoped UPDATE policy on `students`. The audit trigger captures the
 * change with `auth.uid()` (the parent), so PRIVACY.md §7 audit
 * requirements are met without additional logging here.
 */
export async function setChildConsent(
  input: unknown,
): Promise<SetChildConsentResult> {
  const parsed = setChildConsentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Date invalide',
    };
  }

  const { childId, consentKey, value } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Nu ești autentificat' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || profile.role !== 'parent') {
    return {
      success: false,
      error: 'Doar părinții pot modifica consimțământul copilului',
    };
  }

  const { error } = await supabase.rpc('set_child_consent', {
    p_child_id: childId,
    p_consent_key: consentKey,
    p_value: value,
  });

  if (error) {
    return {
      success: false,
      error:
        error.code === '42501'
          ? 'Nu ai permisiunea să modifici consimțământul pentru acest copil'
          : 'Nu am putut salva consimțământul. Încearcă din nou.',
    };
  }

  revalidatePath(ROUTES.PARENT.CHILD(childId));

  return { success: true };
}
