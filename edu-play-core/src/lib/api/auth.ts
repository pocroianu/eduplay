import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { ApiError } from './errors';

export interface AuthContext {
  user: { id: string; email: string };
  profile: { id: string; role: string; full_name: string };
  supabase: SupabaseClient;
}

export async function requireAuth(): Promise<AuthContext> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || !user.email) {
    throw ApiError.unauthorized();
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    throw ApiError.unauthorized('User profile not found');
  }

  return {
    user: { id: user.id, email: user.email },
    profile: { id: profile.id, role: profile.role, full_name: profile.full_name },
    supabase,
  };
}

export async function requireRole(...roles: string[]): Promise<AuthContext> {
  const ctx = await requireAuth();

  if (!roles.includes(ctx.profile.role)) {
    throw ApiError.forbidden();
  }

  return ctx;
}
