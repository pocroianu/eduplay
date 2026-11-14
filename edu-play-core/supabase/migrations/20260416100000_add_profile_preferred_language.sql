-- Add preferred_language column to profiles for user-selected UI language persistence.
-- Default 'ro' because Romanian is the canonical language per F12.
-- CHECK constraint keeps values in sync with SUPPORTED_LANGUAGES in src/lib/i18n/config.ts.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'ro';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_preferred_language_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_preferred_language_check
      CHECK (preferred_language IN ('ro', 'en'));
  END IF;
END
$$;

COMMENT ON COLUMN public.profiles.preferred_language IS
  'User-selected UI language. ''ro'' (default) or ''en''. Must match SUPPORTED_LANGUAGES in src/lib/i18n/config.ts.';
