# Deprecated historical copy

This file is a stale copy of development guidance from the old `docker-setup/` workflow. It still references commands and paths that are no longer the repo entrypoint.

Use these current source-of-truth docs instead:
- `../README.md` for active local startup commands
- `../CLAUDE.md` for current architecture, API, and workflow guidance
- `../REQUIREMENTS.md` for maintained product/application requirements

Keep this file only as historical reference.

# CLAUDE.md - EduPlay Development Guide

> Educational gaming platform for Romanian children (ages 3-12). Next.js 16.1.1 + Supabase + Phaser games.

## Quick Commands

```bash
# Docker (Recommended)
make setup               # Full setup (first time)
make dev                 # Start all services
make stop                # Stop all services
make logs                # View logs
make db-studio           # Open Supabase Studio (localhost:54423)
make db-reset            # Reset database

# Without Docker
npm run dev              # Start Next.js only
npx supabase start       # Start Supabase CLI

# Common
npm run build            # Production build
npm run lint             # Lint code
npm run test:e2e         # Playwright E2E tests
npm run test:unit        # Vitest unit tests
npm run generate:types   # Regenerate DB types after schema changes
```

## Local URLs (Docker)

| Service | URL |
|---------|-----|
| App | http://localhost:3000 |
| Supabase API | http://localhost:54421 |
| Supabase Studio | http://localhost:54423 |
| Email Testing | http://localhost:54424 |
| PostgreSQL | localhost:54422 |

## Project Structure

```
src/
├── app/                  # Next.js App Router (routes only, minimal logic)
│   ├── (auth)/           # Public auth routes
│   ├── (dashboard)/      # Protected routes (teacher/, student/, parent/, admin/)
│   └── games/[gameId]/   # Game player
├── features/             # Domain modules (auth, classes, students, games, etc.)
│   └── {feature}/
│       ├── components/   # Feature-specific components
│       ├── hooks/        # Feature-specific hooks
│       ├── actions/      # Server Actions (mutations)
│       ├── queries/      # Data fetching
│       ├── schemas/      # Zod validation
│       ├── types/
│       └── index.ts      # Public API (barrel export)
├── shared/               # Cross-feature utilities
│   ├── components/ui/    # Primitive UI components
│   ├── hooks/            # Generic hooks
│   ├── lib/              # Utils, Supabase clients, constants
│   └── types/            # Shared types (database.ts is auto-generated)
└── config/               # App configuration
```

## Key Conventions

### Imports
```typescript
// ✅ Import from feature's public API
import { ClassList, useClasses, createClass } from '@/features/classes';

// ❌ Never deep import
import { ClassList } from '@/features/classes/components/class-list';
```

### Components
- **Server Components by default** (no 'use client' unless needed)
- **Client Components only for**: hooks, event handlers, browser APIs
- Colocate tests: `component.tsx` → `component.test.tsx`

### Data Flow
```typescript
// Fetching (Server Component)
const data = await getClasses(); // from features/classes/queries

// Mutations (Server Action)
'use server';
export async function createClass(formData: FormData) {
  // validate → insert → revalidatePath → redirect
}
```

### Validation
```typescript
// Always use Zod schemas
import { z } from 'zod';

export const classSchema = z.object({
  name: z.string().min(2).max(50),
  gradeLevel: z.enum(['preschool', 'kindergarten', 'grade-1', 'grade-2']),
});

export type ClassFormData = z.infer<typeof classSchema>;
```

### Routes
```typescript
// Use constants from @/shared/lib/constants/routes
import { ROUTES } from '@/shared/lib/constants/routes';

redirect(ROUTES.TEACHER.CLASSES);
ROUTES.TEACHER.CLASS(classId); // → /teacher/classes/{id}
```

## UI/UX Rules

### Student UI (Ages 3-12)
- **Min touch target**: 64x64px
- **Min font size**: 18px
- **Colors**: Bright, saturated (see palette below)
- **Animations**: Required on all interactions (use Framer Motion)
- **Sound effects**: On interactions (toggleable)

### Teacher UI
- Cleaner, information-dense
- Faster, subtler animations
- Sidebar navigation

### Color Palette
| Usage | Hex |
|-------|-----|
| Primary (Yellow) | #FFD93D |
| Secondary (Green) | #6BCB77 |
| Success | #4CAF50 |
| Warning | #FF8C42 |
| Error | #FF6B6B |
| Student BG | #FFF8E7 |
| Teacher BG | #F5F0FF |

### Animation Variants
```typescript
import { bounceIn, wobble, float } from '@/config/animations';

// Use predefined variants for consistency
<motion.div variants={bounceIn} />
```

## Database

### Key Tables
- `profiles` - User accounts (extends Supabase auth)
- `classes` - Teacher's classes
- `students` - Student accounts (username + PIN auth)
- `games` - Game catalog
- `game_progress` - Student progress per game
- `assignments` - Teacher-assigned games

### Type Generation
```bash
# After any schema change:
npm run generate:types
# Types go to: src/shared/types/database.ts
```

### Supabase Clients
```typescript
// Client Component
import { createBrowserClient } from '@/shared/lib/supabase/client';

// Server Component / Server Action
import { createServerClient } from '@/shared/lib/supabase/server';
```

## Game Integration

Games run in iframes, communicate via `postMessage`:

```typescript
// Platform → Game
{ type: 'GAME_INIT', studentId, savedProgress, settings }
{ type: 'GAME_PAUSE' | 'GAME_RESUME' | 'GAME_RESTART' }

// Game → Platform
{ type: 'GAME_READY' }
{ type: 'PROGRESS_UPDATE', score, progress }
{ type: 'GAME_COMPLETE', score, maxScore, timeSpent, progressData }
```

## Testing

### E2E (Playwright)
- Use Page Object Model: `tests/e2e/pages/*.page.ts`
- Specs in: `tests/e2e/specs/{feature}/*.spec.ts`
- Run: `npm run test:e2e` or `npm run test:e2e:ui`

### Unit (Vitest)
- Colocate with components when possible
- Shared utils tests: `tests/unit/shared/`

## Common Patterns

### Creating a New Feature
1. Create folder: `src/features/{name}/`
2. Add subfolders: components, hooks, actions, queries, schemas, types
3. Create `index.ts` with public exports
4. Import only from `@/features/{name}`

### Adding a New Route
1. Create page in `src/app/(dashboard)/{role}/{route}/page.tsx` or `src/app/games/[gameId]/page.tsx`
2. Add `loading.tsx` for Suspense boundary
3. Add `error.tsx` for error boundary
4. Add route constant to `ROUTES` in `@/shared/lib/constants/routes`

### Form Pattern
```typescript
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { schema, type FormData } from '../schemas/form.schema';
import { submitAction } from '../actions/submit';

export function MyForm() {
  const form = useForm<FormData>({ resolver: zodResolver(schema) });
  return <form action={submitAction}>...</form>;
}
```

## Don'ts

- ❌ Don't add 'use client' unless necessary
- ❌ Don't deep import from features (use barrel exports)
- ❌ Don't skip animations on student UI
- ❌ Don't hardcode routes (use ROUTES constant)
- ❌ Don't forget to regenerate types after DB changes
- ❌ Don't use small touch targets for kids (<64px)

## Reference Docs

- Full PRD: `../REQUIREMENTS.md`
- Game dev guide: `../public/games/README.md`
