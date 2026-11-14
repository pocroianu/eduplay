# Historical/generated migration note

This file is a phase-completion migration note from earlier parent-portal work. Keep it for historical reference only; do not treat it as the current migration or database source of truth.

Current source-of-truth references:
- the SQL migrations that actually exist in this `supabase/` directory
- `../README.md` for active local-development commands
- `../CLAUDE.md` and `../REQUIREMENTS.md` for current application guidance
- the current GitHub issue and PR for active implementation scope

If migration state conflicts with this document, trust the checked-in SQL files and current code.

# Parent Portal Migrations - Phase 1 Complete

## Overview

Phase 1 of the Parent Portal implementation is complete. All database migrations and RLS policies have been created and are ready to apply.

## Migration Files Created

1. **`01-parent-children.sql`** - Multi-parent support junction table
   - Creates `parent_children` table
   - Migrates existing `students.parent_id` data
   - Adds RLS policies for parents and teachers
   - Maintains backward compatibility

2. **`02-parent-invite-codes.sql`** - Invite code system
   - Creates `parent_invite_codes` table
   - Stores bcrypt-hashed invite codes
   - 7-day expiration, one-time use
   - Adds foreign key to `parent_children.linked_via_code`

3. **`03-parent-notifications.sql`** - Notification system
   - Creates `parent_notifications` table
   - Enables Supabase Realtime for real-time updates
   - Adds helper function `notify_linked_parents()`
   - Supports notification types: game_completed, milestone, achievement, etc.

4. **`04-parent-notification-preferences.sql`** - Notification preferences
   - Creates `parent_notification_preferences` table
   - Auto-creates default preferences for new parents
   - Adds helper function `should_notify_parent()`
   - Supports quiet hours and digest frequency

5. **`05-parent-rls-policies.sql`** - Critical RLS fixes
   - **CRITICAL**: Adds missing RLS policies for parent access
   - Parents can view `game_progress` for linked children
   - Parents can view `assignments` for linked children
   - Parents can view `classes` their children belong to
   - Fixes security vulnerability (parents currently blocked from data)

## How to Apply Migrations

### Option 1: Using Supabase Studio (Recommended for Local Dev)

1. Start Docker services:
   ```bash
   docker compose up -d
   # Or on Windows without make: docker compose up -d
   ```

2. Open Supabase Studio: http://localhost:54423

3. Go to SQL Editor

4. Copy and paste each migration file in order (01 → 05)

5. Execute each migration

### Option 2: Using PostgreSQL CLI

```bash
# Start Docker
docker compose up -d

# Apply migrations in order
docker exec -i edu-play-core-db-1 psql -U postgres -d postgres < supabase/01-parent-children.sql
docker exec -i edu-play-core-db-1 psql -U postgres -d postgres < supabase/02-parent-invite-codes.sql
docker exec -i edu-play-core-db-1 psql -U postgres -d postgres < supabase/03-parent-notifications.sql
docker exec -i edu-play-core-db-1 psql -U postgres -d postgres < supabase/04-parent-notification-preferences.sql
docker exec -i edu-play-core-db-1 psql -U postgres -d postgres < supabase/05-parent-rls-policies.sql
```

### Option 3: Using npm Scripts

```bash
# If there's a migration script in package.json
npm run migrate
```

## After Applying Migrations

### 1. Regenerate TypeScript Types

**CRITICAL**: You MUST regenerate types after applying migrations:

```bash
# Option 1: Using Make (if available)
make db-types

# Option 2: Using npm
npm run generate:types

# Option 3: Direct command
npx supabase gen types typescript --local > src/shared/types/database.ts
```

### 2. Verify Migrations

Run these verification queries in Supabase Studio SQL Editor:

```sql
-- 1. Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('parent_children', 'parent_invite_codes', 'parent_notifications', 'parent_notification_preferences');

-- 2. Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('parent_children', 'parent_invite_codes', 'parent_notifications', 'parent_notification_preferences');

-- 3. Check policies exist
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('parent_children', 'parent_invite_codes', 'parent_notifications', 'parent_notification_preferences', 'game_progress', 'assignments', 'classes');

-- 4. Test data migration (if you have existing students.parent_id data)
SELECT COUNT(*) FROM parent_children; -- Should match count of students with parent_id
SELECT COUNT(*) FROM students WHERE parent_id IS NOT NULL;
```

### 3. Test RLS Policies

Create test accounts and verify access:

```sql
-- As parent user (via Supabase Auth):
-- Should see only linked children's data
SELECT * FROM game_progress; -- Should only show linked children
SELECT * FROM assignments;   -- Should only show linked children
SELECT * FROM students;       -- Should only show linked children

-- Should NOT see unlinked children's data
SELECT * FROM game_progress WHERE student_id = 'unlinked-child-uuid'; -- 0 rows
```

## New Tables Schema

### parent_children
- `id` (UUID, PK)
- `parent_id` (UUID, FK → profiles)
- `student_id` (UUID, FK → students)
- `relationship_type` (TEXT: mother, father, guardian, other)
- `linked_at` (TIMESTAMPTZ)
- `linked_via_code` (UUID, FK → parent_invite_codes)
- `status` (TEXT: active, revoked)
- `created_at`, `updated_at`

### parent_invite_codes
- `id` (UUID, PK)
- `code_hash` (TEXT) - bcrypt hash of 8-char code
- `student_id` (UUID, FK → students)
- `teacher_id` (UUID, FK → profiles)
- `expires_at` (TIMESTAMPTZ) - 7 days default
- `used_at` (TIMESTAMPTZ)
- `used_by` (UUID, FK → profiles)
- `is_revoked` (BOOLEAN)
- `created_at`

### parent_notifications
- `id` (UUID, PK)
- `parent_id` (UUID, FK → profiles)
- `student_id` (UUID, FK → students)
- `type` (TEXT: game_completed, milestone, etc.)
- `title` (TEXT)
- `message` (TEXT)
- `data` (JSONB)
- `read_at` (TIMESTAMPTZ)
- `created_at`

### parent_notification_preferences
- `id` (UUID, PK)
- `parent_id` (UUID, FK → profiles)
- Boolean flags for each notification type
- `digest_frequency` (TEXT: realtime, daily, weekly)
- `quiet_hours_start`, `quiet_hours_end` (TIME)
- `created_at`, `updated_at`

## Updated Middleware

The middleware has been updated to protect `/parent` routes:

- **File**: `src/lib/supabase/middleware.ts`
- **Change**: Added `/parent` to `protectedPaths` array
- **Effect**: Unauthenticated users are redirected to `/login`
- **Parent redirect**: Logged-in parents now redirect to `/parent` from auth pages

## Feature Module Structure

Created `src/features/parent-portal/` with subdirectories:
- `components/` - UI components (empty, Phase 2-4)
- `hooks/` - React hooks (empty, Phase 2-4)
- `actions/` - Server Actions (empty, Phase 2-4)
- `queries/` - Data fetching (empty, Phase 2-4)
- `schemas/` - Zod validation (empty, Phase 2-4)
- `types/` - TypeScript types (populated)
- `index.ts` - Public API barrel export

## Next Steps (Phase 2)

Once migrations are applied and types regenerated:

1. Implement invite code generation (teacher action)
2. Implement invite code validation and linking (parent action)
3. Build `InviteCodeGenerator` component for teacher UI
4. Build `LinkChildForm` component for parent UI
5. Update parent registration flow to handle invite codes

## Troubleshooting

### "Table already exists" errors
- Safe to ignore if re-running migrations
- Migrations use `IF NOT EXISTS` clauses

### "Relation does not exist" errors
- Ensure migrations run in order (01 → 05)
- 02 references 01 (foreign key to parent_children)

### TypeScript type errors after migration
- **Solution**: Run `npm run generate:types`
- The `database.ts` file needs to be regenerated

### RLS policy conflicts
- If you see "policy already exists", drop and recreate:
  ```sql
  DROP POLICY IF EXISTS "policy_name" ON table_name;
  ```

## Rollback (if needed)

To rollback migrations (⚠️ DESTRUCTIVE):

```sql
-- Drop tables in reverse order
DROP TABLE IF EXISTS parent_notification_preferences CASCADE;
DROP TABLE IF EXISTS parent_notifications CASCADE;
DROP TABLE IF EXISTS parent_invite_codes CASCADE;
DROP TABLE IF EXISTS parent_children CASCADE;

-- Drop helper functions
DROP FUNCTION IF EXISTS notify_linked_parents;
DROP FUNCTION IF EXISTS should_notify_parent;
DROP FUNCTION IF EXISTS create_parent_notification_preferences;

-- Drop triggers
DROP TRIGGER IF EXISTS on_parent_profile_created ON profiles;

-- Remove RLS policies from existing tables
DROP POLICY IF EXISTS "Parents can view their children's game progress" ON game_progress;
DROP POLICY IF EXISTS "Parents can view their children's assignments" ON assignments;
DROP POLICY IF EXISTS "Parents can view classes their children belong to" ON classes;
DROP POLICY IF EXISTS "Parents can view their children via junction table" ON students;
```

## Support

If you encounter issues:
1. Check Docker logs: `docker compose logs db`
2. Check Supabase Studio SQL Editor for error messages
3. Verify migrations were applied in correct order
4. Ensure types were regenerated after migrations
