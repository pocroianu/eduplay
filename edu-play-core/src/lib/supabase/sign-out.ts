/**
 * Signs the current user out through the browser Supabase client.
 *
 * The client is imported lazily so the `@supabase/*` browser bundle is only
 * fetched when someone actually signs out, instead of shipping with every
 * dashboard shell's first-load JavaScript.
 */
export async function signOutBrowserClient(): Promise<void> {
  const { createClient } = await import('./client')
  await createClient().auth.signOut()
}
