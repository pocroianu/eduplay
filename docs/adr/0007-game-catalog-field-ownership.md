# Game catalog field ownership

Status: Proposed

Directus edits catalog presentation; Next.js retains the Activity publish and version workflow. The F9 in-shell registry stays in code ([architecture](../../edu-play-core/ARCHITECTURE.md#L758)). This is a proposed target, not the current behavior.

## Current flow

| Step | Behavior |
| --- | --- |
| Source | An [Activity manifest](../../phaser-projects/activities/fruits-01/activity.json#L1) identifies its renderer and version; [renderer metadata](../../phaser-projects/renderers/multiple-choice/renderer.json#L1) identifies the implementation. |
| Load | The [catalog loader](../../edu-play-core/scripts/seed/phaser-catalog.ts#L100) validates package config, reads localized strings, and derives metadata and stable IDs ([lines 125–157](../../edu-play-core/scripts/seed/phaser-catalog.ts#L125)); it reads renderer metadata [here](../../edu-play-core/scripts/seed/phaser-catalog.ts#L170). |
| Storage | The [seed entry](../../edu-play-core/scripts/seed/index.ts#L130) invokes [renderer sync](../../edu-play-core/scripts/seed/renderer-sync.ts#L39), which builds the host and upserts files under `activity-renderers/activity-host/`; the proxy serves that path ([lines 31–32](../../edu-play-core/scripts/seed/renderer-sync.ts#L31)). |
| Database | The [seeder](../../edu-play-core/scripts/seed/seeders/activities.ts#L22) upserts `activity_types`, upserts `activities` including presentation, config and publication state ([lines 88–112](../../edu-play-core/scripts/seed/seeders/activities.ts#L88)), then inserts or checks immutable `activity_versions` ([lines 47–74](../../edu-play-core/scripts/seed/seeders/activities.ts#L47)). It does not seed `activity_resources`. |

## Decision

Owner means authority for changes after creation; database defaults and timestamp triggers populate system fields. Code-owned identities can also be created by Next.js for teacher Activities. Baseline import is controlled bootstrap, not ongoing publication. Grouped columns share an owner.

| Table | Columns | Owner |
| --- | --- | --- |
| `activity_types` | `type_id`, `display_name`, `category`, `config_schema`, `renderer_key`, `version`, `renderer_kind`, `authoring_mode`, `produces_submission`, `supports_review`, `is_auto_scored`, `created_at`, `updated_at` | code |
| `activities` | `id`, `template`, `default_lang`, `default_theme`, `difficulty`, `target_age_min`, `target_age_max`, `estimated_duration`, `question_count`, `tags`, `subject`, `skills`, `created_by`, `created_at`, `updated_at`, `config_data`, `config_schema_version`, `status`, `is_published`, `visibility_scope` | Next.js |
| `activities` | `title`, `description`, `thumbnail_url`, `category`; proposed `catalog_visible`, `sort_order` | Directus |
| `activity_versions` | `id`, `activity_id`, `activity_type_id`, `version_number`, `config_data`, `config_schema_version`, `published_at`, `published_by_user_id` | Next.js |
| `activity_resources` | `id`, `activity_id`, `version_id`, `resource_type`, `title`, `url`, `sort_order`, `created_by`, `created_at`, `updated_at` | Next.js |

Schema sources: [activities](../../edu-play-core/supabase/migrations/20260413000001_activities_table.sql#L2), [types and versions](../../edu-play-core/supabase/migrations/20260507000000_cms_activity_types_and_versions.sql#L14), [version type](../../edu-play-core/supabase/migrations/20260508000001_cms_lifecycle_hardening.sql#L95), [visibility and type capabilities](../../edu-play-core/supabase/migrations/20260519131224_teacher_private_activity_foundation.sql#L4), and [resources](../../edu-play-core/supabase/migrations/20260520125747_activity_link_resources.sql#L6). `games` was [dropped](../../edu-play-core/supabase/migrations/20260518000000_activity_only_cutover.sql#L117); assignments pin versions but are workflow data. Resource ordering is distinct from catalog ordering.

Directus presentation applies to public catalog Activities, not teacher-private authoring. Catalog visibility only hides a published public Activity from catalog listings; it does not publish, unpublish, change access control, or revoke assignments. `thumbnail_url` already exists; use the separately hardened `assets` integration, never renderer or child-artifact storage. Published snapshots and resources remain immutable. Editorial fields are live presentation, not version snapshots.

## Required follow-ups

| Area | Change |
| --- | --- |
| Schema and reads | Add `activities.catalog_visible boolean NOT NULL DEFAULT false` and nullable `sort_order integer`, with deterministic fallback by ID. Backfill eligible public catalog rows deliberately; update catalog queries to require public, published and catalog-visible. Preserve assignment and direct access semantics. |
| Seed | Split insert/bootstrap from conflict update. Supply required initial presentation defaults only on first insert; on conflict never write Directus columns, lifecycle, draft config, or version snapshots. Move baseline publication/version creation into an explicit Next.js-controlled bootstrap workflow; fail on conflicting immutable versions. Test repeat sync after editorial and lifecycle edits. |
| Grants | In a forward-only migration coordinated with #19, remove existing table-level and inherited/default DML privileges before granting the columns below. Directus has `BYPASSRLS`; table grants alone permit editing private rows. Before enabling writes, enforce the public-catalog row boundary with a restricted updatable view or equivalent database-enforced mechanism, and grant these columns on that surface instead of the base table. Verify effective privileges, role membership, read exposure and Directus introspection. No INSERT/DELETE or version/resource writes. |
| Renderer | Keep build and deployment credentials outside Directus; treat renderer storage writes as code deployment. The [audit](../../PROJECT-AUDIT-2026-11-14.md#L157) flags executable proxy content and broad Directus grants. Harden proxy paths/origin separately; do not grant Directus renderer bucket access. |

Target column grants after the new columns exist, subject to the row-boundary prerequisite above (replace the table with the restricted surface when implemented):

```sql
REVOKE INSERT, UPDATE, DELETE ON public.activities, public.activity_types,
  public.activity_versions, public.activity_resources FROM directus_admin;
GRANT UPDATE (title, description, thumbnail_url, category, catalog_visible, sort_order)
  ON public.activities TO directus_admin;
```

The `REVOKE` is insufficient if privileges are inherited, granted to PUBLIC, or supplied through default privileges. SELECT and asset permissions require a separate least-privilege allowlist; no blanket grants are implied.

## Open questions

- Should catalog visibility default to hidden on first import, and which existing rows should be backfilled visible?
- Should category and other discovery metadata be editorial, and should Activity type labels ever be editable in Directus?
- What restricted database surface and asset reference format should Directus use for public catalog rows and thumbnails?
- Should editorial changes appear immediately on published Activities, or require review and versioned presentation?
- Who runs baseline publication, and how should changed package versions be promoted without disturbing existing assignments?
