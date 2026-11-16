-- Directus bypasses RLS, so public tables are denied by default. New tables
-- must be explicitly reviewed and opted in; no writes are granted here.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM directus_admin;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM directus_admin;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM directus_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM directus_admin;

-- Type metadata describes the catalog's available activity types.
GRANT SELECT ON public.activity_types TO directus_admin;
-- Activities provide catalog presentation and metadata.
GRANT SELECT ON public.activities TO directus_admin;
-- Versions provide the published catalog snapshots.
GRANT SELECT ON public.activity_versions TO directus_admin;
-- Resources describe content linked to activities and versions.
GRANT SELECT ON public.activity_resources TO directus_admin;
-- Learning paths provide curated content groupings.
GRANT SELECT ON public.learning_paths TO directus_admin;
-- Steps describe the content and order of learning paths.
GRANT SELECT ON public.learning_path_steps TO directus_admin;
-- Feature flags provide configuration for the admin content surface.
GRANT SELECT ON public.feature_flags TO directus_admin;

COMMENT ON ROLE directus_admin IS
  'Directus CMS service account. BYPASSRLS, read-only access to an explicit public table allowlist, owns the directus schema. Schema migrations remain the source of truth.';
