# Deprecated historical requirements copy

This file is a stale duplicate of requirements and setup notes kept under `docker-setup/`. It includes outdated entrypoints, filenames, and process guidance.

Use these current source-of-truth docs instead:
- `../../REQUIREMENTS.md` for maintained requirements
- `../../README.md` for active setup commands
- `../../CLAUDE.md` for current implementation conventions

Keep this file only as historical context.

# EduPlay - Project Requirements Document

## Executive Summary

EduPlay is an educational gaming platform for Romanian children aged 3–12 years (preschool through 2nd grade). The platform delivers interactive learning games while providing educators and parents with tools to manage students, assign content, and track progress.

---

## Table of Contents

1. [Project Goals](#project-goals)
2. [Target Users](#target-users)
3. [Tech Stack](#tech-stack)
4. [Architecture](#architecture)
5. [Project Structure](#project-structure)
6. [Best Practices & Idioms](#best-practices--idioms)
7. [Database Design](#database-design)
8. [Feature Requirements](#feature-requirements)
9. [Game Integration](#game-integration)
10. [UI/UX Requirements](#uiux-requirements)
11. [Testing Strategy](#testing-strategy)
12. [Development Phases](#development-phases)
13. [Environment Configuration](#environment-configuration)

---

## Project Goals

### Primary Objectives

1. **Engage young learners** through age-appropriate, gamified educational content
2. **Support teachers** with classroom management and progress tracking tools
3. **Involve parents** in their children's learning journey
4. **Cover core subjects**: literacy, math, phonics, shapes, colors, vocabulary

### Success Metrics

- Student engagement: average session duration > 10 minutes
- Learning outcomes: measurable progress through game levels
- Teacher adoption: streamlined workflow for assignments and tracking
- Platform growth: support for multiple classes and schools

---

## Target Users

### User Roles

| Role        | Description                                      | Age Group    |
| ----------- | ------------------------------------------------ | ------------ |
| **Student** | Primary user; plays educational games            | 3–12 years   |
| **Teacher** | Creates classes, manages students, assigns games | Adult        |
| **Parent**  | Monitors child's progress, optional involvement  | Adult        |
| **Admin**   | Manages game catalog, platform settings          | Adult        |

### User Personas

#### Student (Ages 3–7)
- Limited reading ability
- Needs large, colorful UI elements
- Motivated by visual rewards (stars, trophies, animations)
- Short attention span; sessions of 5–15 minutes

#### Student (Ages 8–12)
- Can navigate independently
- Appreciates progress tracking and achievements
- Longer attention span; sessions of 15–30 minutes

#### Teacher
- Manages 1–3 classes with 15–25 students each
- Needs quick assignment creation and bulk actions
- Wants at-a-glance progress reports
- Limited time for platform administration

#### Parent
- Wants visibility into child's activities and progress
- May assist younger children with login
- Interested in recommendations for home practice

---

## Tech Stack

| Category        | Technology                              | Rationale                          |
| --------------- | --------------------------------------- | ---------------------------------- |
| Framework       | Next.js 16.1.1 (App Router)             | RSC, Server Actions, Streaming     |
| Language        | TypeScript (Strict Mode)                | Type safety, developer experience  |
| UI Components   | Chakra UI v2                            | Accessible, composable components  |
| Styling         | TailwindCSS                             | Utility-first, rapid prototyping   |
| Animations      | Framer Motion                           | Declarative animations for React   |
| Backend         | Supabase                                | Auth, Postgres, Storage, Realtime  |
| Forms           | React Hook Form + Zod                   | Performance, schema validation     |
| State Management| Zustand + React Query (TanStack Query)  | Server state + client state        |
| Charts          | Recharts                                | React-native charting library      |
| i18n            | next-intl                               | Next.js-native internationalization|
| Mobile          | Expo (React Native)                     | Cross-platform mobile app          |
| Game Engine     | Phaser 3                                | 2D game framework, Phaser Editor   |
| E2E Testing     | Playwright                              | Cross-browser testing, reliable    |
| Unit Testing    | Vitest + Testing Library                | Fast, modern test runner           |
| Linting         | ESLint + Prettier + Husky               | Code quality and consistency       |
| Documentation   | Storybook                               | Component documentation            |

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                            │
├───────────────────┬───────────────────┬─────────────────────────┤
│    Next.js Web    │    Expo Mobile    │   Phaser Games          │
│    (RSC + SPA)    │    (iOS/Android)  │   (iframe embed)        │
└─────────┬─────────┴─────────┬─────────┴────────────┬────────────┘
          │                   │                      │
          │              postMessage                 │
          │                   │                      │
          └───────────────────┼──────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Supabase Platform                        │
├─────────────────┬───────────────────┬───────────────────────────┤
│      Auth       │    PostgreSQL     │         Storage           │
│                 │                   │                           │
│ • Email/Pass    │ • profiles        │ • games bucket            │
│ • Magic Link    │ • classes         │ • game-assets bucket      │
│ • OAuth (future)│ • students        │ • user-uploads bucket     │
│                 │ • games           │                           │
│                 │ • game_progress   │                           │
│                 │ • assignments     │                           │
└─────────────────┴───────────────────┴───────────────────────────┘
```

### Architecture Principles

| Principle | Description |
| --------- | ----------- |
| **Server-First** | Leverage RSC for data fetching; minimize client-side JS |
| **Colocation** | Keep related code together (components, hooks, types, tests) |
| **Feature-Based** | Organize by domain/feature, not by technical layer |
| **Type-Safe End-to-End** | Types flow from DB → API → Components |
| **Progressive Enhancement** | Core functionality works without JS |
| **Optimistic UI** | Immediate feedback with background sync |

---

## Project Structure

### Scalable Feature-Based Architecture

```
eduplay/
├── src/
│   ├── app/                              # Next.js App Router
│   │   ├── (marketing)/                  # Public marketing pages
│   │   │   ├── page.tsx                  # Landing page
│   │   │   ├── about/
│   │   │   └── pricing/
│   │   │
│   │   ├── (auth)/                       # Auth routes (public)
│   │   │   ├── layout.tsx                # Auth layout with illustrations
│   │   │   ├── login/
│   │   │   │   ├── page.tsx
│   │   │   │   └── _components/          # Route-specific components
│   │   │   ├── login/student/            # Student-specific login
│   │   │   ├── register/
│   │   │   ├── forgot-password/
│   │   │   └── verify/
│   │   │
│   │   ├── (dashboard)/                  # Protected platform routes
│   │   │   ├── layout.tsx                # Platform shell with nav
│   │   │   ├── teacher/
│   │   │   │   ├── page.tsx              # Dashboard
│   │   │   │   ├── loading.tsx           # Suspense boundary
│   │   │   │   ├── error.tsx             # Error boundary
│   │   │   │   ├── classes/
│   │   │   │   │   ├── page.tsx          # List classes
│   │   │   │   │   ├── [classId]/
│   │   │   │   │   │   ├── page.tsx      # Class detail
│   │   │   │   │   │   ├── students/
│   │   │   │   │   │   └── settings/
│   │   │   │   │   └── new/
│   │   │   │   ├── students/
│   │   │   │   ├── assignments/
│   │   │   │   └── analytics/
│   │   │   │
│   │   │   ├── student/
│   │   │   │   ├── page.tsx              # Student home
│   │   │   │   ├── games/
│   │   │   │   │   ├── page.tsx          # Browse games
│   │   │   │   │   └── [category]/       # Category filter
│   │   │   │   ├── achievements/
│   │   │   │   └── profile/
│   │   │   │
│   │   │   ├── parent/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── children/
│   │   │   │   │   └── [childId]/
│   │   │   │   └── settings/
│   │   │   │
│   │   │   └── admin/
│   │   │       ├── page.tsx
│   │   │       ├── games/
│   │   │       ├── users/
│   │   │       └── analytics/
│   │   │
│   │   ├── play/                         # Game player (separate layout)
│   │   │   ├── layout.tsx                # Minimal chrome for games
│   │   │   └── [gameId]/
│   │   │       ├── page.tsx
│   │   │       └── _components/
│   │   │
│   │   ├── api/                          # API routes (when needed)
│   │   │   ├── webhooks/
│   │   │   └── cron/
│   │   │
│   │   ├── layout.tsx                    # Root layout
│   │   ├── not-found.tsx                 # 404 page
│   │   ├── error.tsx                     # Global error boundary
│   │   └── global.css                    # Global styles
│   │
│   ├── features/                         # Feature modules (domain-driven)
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   │   ├── login-form.tsx
│   │   │   │   ├── register-form.tsx
│   │   │   │   ├── student-pin-pad.tsx
│   │   │   │   └── index.ts              # Barrel export
│   │   │   ├── hooks/
│   │   │   │   ├── use-auth.ts
│   │   │   │   ├── use-session.ts
│   │   │   │   └── index.ts
│   │   │   ├── actions/                  # Server Actions
│   │   │   │   ├── login.ts
│   │   │   │   ├── register.ts
│   │   │   │   └── logout.ts
│   │   │   ├── queries/                  # Data fetching
│   │   │   │   └── get-session.ts
│   │   │   ├── schemas/                  # Zod schemas
│   │   │   │   ├── login.schema.ts
│   │   │   │   └── register.schema.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   └── index.ts                  # Public API
│   │   │
│   │   ├── classes/
│   │   │   ├── components/
│   │   │   │   ├── class-card.tsx
│   │   │   │   ├── class-list.tsx
│   │   │   │   ├── class-form.tsx
│   │   │   │   ├── class-roster.tsx
│   │   │   │   └── index.ts
│   │   │   ├── hooks/
│   │   │   ├── actions/
│   │   │   ├── queries/
│   │   │   ├── schemas/
│   │   │   ├── types/
│   │   │   └── index.ts
│   │   │
│   │   ├── students/
│   │   │   └── ...
│   │   │
│   │   ├── games/
│   │   │   ├── components/
│   │   │   │   ├── game-card.tsx
│   │   │   │   ├── game-grid.tsx
│   │   │   │   ├── game-player.tsx
│   │   │   │   ├── game-controls.tsx
│   │   │   │   ├── category-tabs.tsx
│   │   │   │   └── index.ts
│   │   │   ├── hooks/
│   │   │   │   ├── use-games.ts
│   │   │   │   ├── use-game-session.ts
│   │   │   │   ├── use-game-communication.ts
│   │   │   │   └── index.ts
│   │   │   ├── lib/
│   │   │   │   ├── game-messages.ts      # postMessage handling
│   │   │   │   └── score-calculator.ts
│   │   │   ├── types/
│   │   │   │   └── messages.ts           # Game message types
│   │   │   └── index.ts
│   │   │
│   │   ├── assignments/
│   │   ├── analytics/
│   │   ├── achievements/
│   │   └── notifications/
│   │
│   ├── shared/                           # Shared utilities (not features)
│   │   ├── components/                   # Generic UI components
│   │   │   ├── ui/                       # Primitive components
│   │   │   │   ├── button.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── modal.tsx
│   │   │   │   ├── toast.tsx
│   │   │   │   ├── skeleton.tsx
│   │   │   │   └── index.ts
│   │   │   ├── layout/
│   │   │   ├── feedback/
│   │   │   ├── animations/               # Reusable animations
│   │   │   │   ├── fade-in.tsx
│   │   │   │   ├── slide-up.tsx
│   │   │   │   ├── bounce.tsx
│   │   │   │   ├── confetti.tsx
│   │   │   │   ├── celebration.tsx
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── hooks/                        # Generic hooks
│   │   │   ├── use-media-query.ts
│   │   │   ├── use-local-storage.ts
│   │   │   ├── use-debounce.ts
│   │   │   ├── use-reduced-motion.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── lib/                          # Utilities and helpers
│   │   │   ├── supabase/
│   │   │   │   ├── client.ts
│   │   │   │   ├── server.ts
│   │   │   │   ├── middleware.ts
│   │   │   │   └── index.ts
│   │   │   ├── utils/
│   │   │   │   ├── cn.ts
│   │   │   │   ├── format-date.ts
│   │   │   │   └── index.ts
│   │   │   ├── constants/
│   │   │   │   ├── routes.ts
│   │   │   │   ├── categories.ts
│   │   │   │   └── index.ts
│   │   │   └── validators/
│   │   │
│   │   └── types/
│   │       ├── database.ts               # Generated from Supabase
│   │       ├── api.ts
│   │       └── index.ts
│   │
│   ├── config/
│   │   ├── site.ts
│   │   ├── navigation.ts
│   │   ├── animations.ts
│   │   └── index.ts
│   │
│   └── proxy.ts
│
├── public/
│   ├── games/
│   ├── images/
│   │   ├── mascot/
│   │   ├── backgrounds/
│   │   └── icons/
│   ├── sounds/
│   └── fonts/
│
├── tests/
│   ├── e2e/
│   │   ├── fixtures/
│   │   ├── pages/                        # Page Object Models
│   │   ├── specs/
│   │   └── utils/
│   ├── unit/
│   └── integration/
│
├── supabase/
│   ├── migrations/
│   ├── functions/
│   ├── seed.sql
│   └── config.toml
│
├── .storybook/
├── docs/
├── scripts/
├── .github/workflows/
├── .husky/
│
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── playwright.config.ts
├── vitest.config.ts
└── package.json
```

### Feature Module Structure

Each feature follows a consistent internal structure:

```
feature-name/
├── components/           # React components specific to this feature
│   ├── component-name.tsx
│   ├── component-name.test.tsx    # Colocated test
│   ├── component-name.stories.tsx # Colocated story
│   └── index.ts                   # Barrel export
├── hooks/                # Custom hooks
│   ├── use-feature.ts
│   └── index.ts
├── actions/              # Server Actions (mutations)
│   ├── create-item.ts
│   ├── update-item.ts
│   └── delete-item.ts
├── queries/              # Data fetching functions
│   ├── get-items.ts
│   └── get-item.ts
├── schemas/              # Zod validation schemas
│   └── item.schema.ts
├── lib/                  # Feature-specific utilities
│   └── helpers.ts
├── types/                # Feature-specific types
│   └── index.ts
└── index.ts              # Public API (what other features can import)
```

---

## Best Practices & Idioms

### Next.js App Router Patterns

#### Server Components by Default

```typescript
// ✅ Good: Server Component (default)
// src/app/(dashboard)/teacher/classes/page.tsx
import { getClasses } from '@/features/classes/queries/get-classes';
import { ClassList } from '@/features/classes/components';

export default async function ClassesPage() {
  const classes = await getClasses();
  
  return (
    <div>
      <h1>My Classes</h1>
      <ClassList classes={classes} />
    </div>
  );
}

// ✅ Good: Client Component only when needed
// src/features/classes/components/class-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClass } from '../actions/create-class';
import { classSchema, type ClassFormData } from '../schemas/class.schema';

export function ClassForm() {
  const form = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
  });
  
  return <form action={createClass}>...</form>;
}
```

#### Server Actions for Mutations

```typescript
// src/features/classes/actions/create-class.ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/shared/lib/supabase/server';
import { classSchema } from '../schemas/class.schema';
import { ROUTES } from '@/shared/lib/constants/routes';

export async function createClass(formData: FormData) {
  const supabase = createServerClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  
  // Validate input
  const validated = classSchema.parse({
    name: formData.get('name'),
    gradeLevel: formData.get('gradeLevel'),
  });
  
  // Create class
  const { error } = await supabase
    .from('classes')
    .insert({
      ...validated,
      teacher_id: user.id,
    });
  
  if (error) throw error;
  
  // Revalidate and redirect
  revalidatePath(ROUTES.TEACHER.CLASSES);
  redirect(ROUTES.TEACHER.CLASSES);
}
```

### TypeScript Patterns

#### Discriminated Unions for State

```typescript
// src/features/games/types/game-state.ts
type GameState =
  | { status: 'idle' }
  | { status: 'loading'; progress: number }
  | { status: 'ready'; gameId: string }
  | { status: 'playing'; gameId: string; score: number }
  | { status: 'completed'; gameId: string; finalScore: number; stars: 1 | 2 | 3 }
  | { status: 'error'; error: Error };

// Usage with exhaustive checking
function GameStatus({ state }: { state: GameState }) {
  switch (state.status) {
    case 'idle':
      return <IdleScreen />;
    case 'loading':
      return <LoadingScreen progress={state.progress} />;
    case 'ready':
      return <ReadyScreen gameId={state.gameId} />;
    case 'playing':
      return <PlayingScreen gameId={state.gameId} score={state.score} />;
    case 'completed':
      return <CompletedScreen stars={state.stars} />;
    case 'error':
      return <ErrorScreen error={state.error} />;
    default:
      const _exhaustive: never = state;
      return null;
  }
}
```

#### Zod Schemas with Type Inference

```typescript
// src/features/classes/schemas/class.schema.ts
import { z } from 'zod';

export const classSchema = z.object({
  name: z
    .string()
    .min(2, 'Class name must be at least 2 characters')
    .max(50, 'Class name must be less than 50 characters'),
  gradeLevel: z.enum(['preschool', 'kindergarten', 'grade-1', 'grade-2'], {
    errorMap: () => ({ message: 'Please select a grade level' }),
  }),
  schoolYear: z
    .string()
    .regex(/^\d{4}-\d{4}$/, 'School year must be in format YYYY-YYYY')
    .optional(),
});

// Infer TypeScript type from schema
export type ClassFormData = z.infer<typeof classSchema>;
```

### React Patterns

#### Composition Pattern

```typescript
// src/shared/components/ui/card.tsx
import { cn } from '@/shared/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-white shadow-lg border-2 border-gray-100',
        className
      )}
      {...props}
    />
  );
}

Card.Header = function CardHeader({ className, ...props }: CardProps) {
  return <div className={cn('p-4 border-b', className)} {...props} />;
};

Card.Content = function CardContent({ className, ...props }: CardProps) {
  return <div className={cn('p-4', className)} {...props} />;
};

Card.Footer = function CardFooter({ className, ...props }: CardProps) {
  return <div className={cn('p-4 border-t', className)} {...props} />;
};

// Usage
<Card>
  <Card.Header>Title</Card.Header>
  <Card.Content>Content here</Card.Content>
  <Card.Footer>Actions</Card.Footer>
</Card>
```

### Animation Patterns

#### Animation Variants System

```typescript
// src/config/animations.ts
import type { Variants } from 'framer-motion';

export const transitions = {
  spring: { type: 'spring', stiffness: 500, damping: 30 },
  springBouncy: { type: 'spring', stiffness: 400, damping: 15 },
  smooth: { type: 'tween', ease: 'easeInOut', duration: 0.3 },
} as const;

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const bounceIn: Variants = {
  initial: { opacity: 0, scale: 0 },
  animate: { 
    opacity: 1, 
    scale: 1,
    transition: transitions.springBouncy,
  },
};

export const wobble: Variants = {
  hover: {
    rotate: [-2, 2, -2, 2, 0],
    transition: { duration: 0.4 },
  },
};

export const float: Variants = {
  animate: {
    y: [-5, 5, -5],
    transition: {
      repeat: Infinity,
      duration: 3,
      ease: 'easeInOut',
    },
  },
};
```

### Barrel Exports & Import Conventions

```typescript
// src/features/classes/index.ts
// Public API - only export what other features need

export { ClassCard } from './components/class-card';
export { ClassList } from './components/class-list';
export { ClassForm } from './components/class-form';
export { useClasses } from './hooks/use-classes';
export { createClass } from './actions/create-class';
export { getClasses } from './queries/get-classes';
export type { Class, ClassFormData } from './types';
export { classSchema } from './schemas/class.schema';

// ✅ Good: Importing from feature public API
import { ClassList, useClasses, createClass } from '@/features/classes';

// ❌ Bad: Deep imports bypass the public API
import { ClassList } from '@/features/classes/components/class-list';
```

### Route Constants

```typescript
// src/shared/lib/constants/routes.ts
export const ROUTES = {
  HOME: '/',
  
  AUTH: {
    LOGIN: '/login',
    LOGIN_STUDENT: '/login/student',
    REGISTER: '/register',
    FORGOT_PASSWORD: '/forgot-password',
  },
  
  TEACHER: {
    DASHBOARD: '/teacher',
    CLASSES: '/teacher/classes',
    CLASS: (id: string) => `/teacher/classes/${id}`,
    STUDENTS: '/teacher/students',
  },
  
  STUDENT: {
    DASHBOARD: '/student',
    GAMES: '/student/games',
    ACHIEVEMENTS: '/student/achievements',
  },
  
  GAME: {
    PLAY: (id: string) => `/play/${id}`,
  },
} as const;
```

---

## Database Design

### Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   profiles   │       │    classes   │       │   students   │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │       │ id (PK)      │       │ id (PK)      │
│ email        │──┐    │ teacher_id   │───────│ class_id     │
│ full_name    │  │    │ name         │       │ parent_id    │──┐
│ role         │  └────│ grade_level  │       │ first_name   │  │
│ avatar_url   │       │ school_year  │       │ last_name    │  │
│ created_at   │       │ created_at   │       │ username     │  │
└──────────────┘       └──────────────┘       │ pin_code     │  │
       │                                      │ avatar_url   │  │
       │                                      │ created_at   │  │
       │                                      └──────────────┘  │
       │                                             │          │
       │  ┌──────────────────────────────────────────┘          │
       │  │                                                     │
       │  │  ┌──────────────┐       ┌────────────────┐          │
       │  │  │    games     │       │ game_progress  │          │
       │  │  ├──────────────┤       ├────────────────┤          │
       │  │  │ id (PK)      │───────│ game_id        │          │
       │  │  │ title        │       │ student_id     │──────────┘
       │  │  │ description  │       │ score          │
       │  │  │ category     │       │ time_spent     │
       │  │  │ difficulty   │       │ attempts       │
       │  │  │ thumbnail    │       │ status         │
       │  │  │ game_url     │       │ progress_data  │
       │  │  │ min_age      │       │ last_played_at │
       │  │  │ max_age      │       │ created_at     │
       │  │  │ is_active    │       └────────────────┘
       │  │  │ created_at   │
       │  │  └──────────────┘
       │  │         │
       │  │         │
       │  │  ┌──────────────────┐
       │  │  │   assignments    │
       │  │  ├──────────────────┤
       │  └──│ student_id       │
       │     │ game_id          │────────────────────┘
       └─────│ assigned_by      │
             │ class_id (opt)   │
             │ due_date         │
             │ is_mandatory     │
             │ status           │
             │ created_at       │
             └──────────────────┘
```

### Table Definitions

#### `profiles`
| Column      | Type                                      | Constraints     |
| ----------- | ----------------------------------------- | --------------- |
| id          | uuid                                      | PK, FK auth.users |
| email       | text                                      | unique, not null |
| full_name   | text                                      | not null        |
| role        | enum (teacher, parent, student, admin)    | not null        |
| avatar_url  | text                                      | nullable        |
| created_at  | timestamptz                               | default now()   |

#### `classes`
| Column      | Type        | Constraints                    |
| ----------- | ----------- | ------------------------------ |
| id          | uuid        | PK, default gen_random_uuid()  |
| teacher_id  | uuid        | FK profiles.id, not null       |
| name        | text        | not null                       |
| grade_level | enum        | preschool, kindergarten, grade-1, grade-2 |
| school_year | text        | e.g., "2024-2025"              |
| created_at  | timestamptz | default now()                  |

#### `students`
| Column      | Type        | Constraints                    |
| ----------- | ----------- | ------------------------------ |
| id          | uuid        | PK, default gen_random_uuid()  |
| class_id    | uuid        | FK classes.id, not null        |
| parent_id   | uuid        | FK profiles.id, nullable       |
| first_name  | text        | not null                       |
| last_name   | text        | not null                       |
| username    | text        | unique, auto-generated         |
| pin_code    | text        | 4-digit PIN for login          |
| avatar_url  | text        | nullable                       |
| birth_date  | date        | nullable                       |
| created_at  | timestamptz | default now()                  |

#### `games`
| Column      | Type        | Constraints                    |
| ----------- | ----------- | ------------------------------ |
| id          | uuid        | PK, default gen_random_uuid()  |
| title       | text        | not null                       |
| description | text        | nullable                       |
| category    | enum        | literacy, math, phonics, shapes, colors, vocabulary |
| difficulty  | enum        | easy, medium, hard             |
| thumbnail   | text        | Storage URL                    |
| game_url    | text        | Storage URL to game bundle     |
| min_age     | integer     | minimum recommended age        |
| max_age     | integer     | maximum recommended age        |
| is_active   | boolean     | default true                   |
| created_at  | timestamptz | default now()                  |

#### `game_progress`
| Column         | Type        | Constraints                    |
| -------------- | ----------- | ------------------------------ |
| id             | uuid        | PK, default gen_random_uuid()  |
| student_id     | uuid        | FK students.id, not null       |
| game_id        | uuid        | FK games.id, not null          |
| score          | integer     | default 0                      |
| time_spent     | integer     | milliseconds                   |
| attempts       | integer     | default 0                      |
| status         | enum        | not_started, in_progress, completed |
| progress_data  | jsonb       | game-specific state            |
| last_played_at | timestamptz | nullable                       |
| created_at     | timestamptz | default now()                  |

#### `assignments`
| Column       | Type        | Constraints                    |
| ------------ | ----------- | ------------------------------ |
| id           | uuid        | PK, default gen_random_uuid()  |
| game_id      | uuid        | FK games.id, not null          |
| student_id   | uuid        | FK students.id, nullable       |
| class_id     | uuid        | FK classes.id, nullable        |
| assigned_by  | uuid        | FK profiles.id, not null       |
| due_date     | timestamptz | nullable                       |
| is_mandatory | boolean     | default false                  |
| status       | enum        | pending, completed, overdue    |
| created_at   | timestamptz | default now()                  |

### Row Level Security (RLS) Policies

| Table         | Policy                                                    |
| ------------- | --------------------------------------------------------- |
| profiles      | Users can read/update own profile                         |
| classes       | Teachers can CRUD own classes; students can read own class |
| students      | Teachers can CRUD students in own classes                 |
| games         | All authenticated users can read; admins can CRUD         |
| game_progress | Students can read/update own; teachers can read for class |
| assignments   | Teachers can CRUD for own classes; students can read own  |

---

## Feature Requirements

### F1: Authentication

- **F1.1 Teacher Registration**: Email/password with verification
- **F1.2 Teacher Login**: Email/password with "Remember me"
- **F1.3 Student Login**: Username + 4-digit PIN with visual PIN pad
- **F1.4 Parent Login**: Email/password with invite code linking
- **F1.5 Role-Based Routing**: Redirect based on role

### F2: Teacher Dashboard

- Overview with stats (students, classes, assignments)
- Quick actions (create class, add student, assign game)

### F3: Class Management

- Create/Edit/Archive classes
- View class roster with bulk actions

### F4: Student Management

- Create students with auto-generated username/PIN
- Printable credential cards

### F5: Games Library

- Browse with filters (category, difficulty, age)
- Assign games to classes or individuals

### F6: Student Dashboard

- Welcome with daily progress
- Game browser with large, colorful cards
- Achievements display

### F7: Game Player

- Loading screen with progress indicator
- Controls (pause, restart, exit, fullscreen, volume)
- Completion celebration

### F8: Parent Portal

- Children list with progress summaries
- Link child via invite code

### F9-F12: Admin, Analytics, Notifications, i18n

- Admin panel for game/user management
- Teacher analytics with reports
- Notification system
- Romanian (default) + English

---

## Game Integration

### Communication Protocol

Games are embedded in an iframe and communicate via `postMessage`.

#### Platform → Game Messages

```typescript
interface GameInitMessage {
  type: "GAME_INIT";
  studentId: string;
  studentName: string;
  savedProgress: object | null;
  settings: {
    locale: string;
    soundEnabled: boolean;
    difficulty: "easy" | "medium" | "hard";
  };
}

interface GameControlMessage {
  type: "GAME_PAUSE" | "GAME_RESUME" | "GAME_RESTART";
}
```

#### Game → Platform Messages

```typescript
interface ProgressUpdateMessage {
  type: "PROGRESS_UPDATE";
  progress: number;
  score: number;
}

interface GameCompleteMessage {
  type: "GAME_COMPLETE";
  score: number;
  maxScore: number;
  timeSpent: number;
  reason: "completed" | "exited" | "timeout";
  progressData: object;
}

interface GameReadyMessage {
  type: "GAME_READY";
}
```

---

## UI/UX Requirements

### Design Philosophy

The platform must deliver a **fun, animated, and toony visual experience** specifically designed for **kids and teachers**.

### Core Visual Style

| Aspect              | Specification                                                   |
| ------------------- | --------------------------------------------------------------- |
| **Overall Aesthetic** | Cartoon/toony style with rounded shapes, bold outlines        |
| **Color Palette**   | Bright, saturated primary colors; soft pastels for backgrounds  |
| **Typography**      | Rounded, friendly fonts (Nunito, Baloo, Comic Neue)             |
| **Illustrations**   | Hand-drawn style characters, mascots, decorative elements       |
| **Shadows & Depth** | Soft drop shadows, layered elements                             |

### Animation Requirements

**Animations are essential for engagement and delight.**

#### Global Animations
- Page transitions: Slide, fade, or bounce
- Button hover/press: Scale up, wobble, glow, bounce
- Loading states: Playful spinners, bouncing dots, animated mascots
- Background elements: Floating shapes, clouds, stars, bubbles

#### Student-Specific Animations
- Login success: Mascot wave, welcome burst with stars
- Game card hover: Card lifts, slight rotation, sparkle
- Star earned: Star bursts, spins, lands in collection
- Achievement unlocked: Trophy flies in with confetti
- Level complete: Full-screen celebration with fireworks

#### Teacher-Specific Animations
- Dashboard load: Stat cards slide in with bounce
- Data updates: Smooth number transitions
- Success actions: Subtle confetti, checkmark animations

### Student Interface Specifications

| Element    | Specification                                                    |
| ---------- | ---------------------------------------------------------------- |
| Buttons    | Min 64x64px, rounded (border-radius: 16px+), bouncy hover        |
| Text       | Min 18px, rounded sans-serif font                                |
| Icons      | Colorful, cartoon-style, animated on interaction                 |
| Cards      | Large, rounded corners, animated shadows, tilt on hover          |
| Navigation | Max 2 levels deep, always visible home with animated mascot      |

### Color Palette

| Usage              | Color          | Hex       |
| ------------------ | -------------- | --------- |
| Primary Action     | Sunny Yellow   | #FFD93D   |
| Secondary Action   | Sky Blue       | #6BCB77   |
| Success            | Grass Green    | #4CAF50   |
| Warning            | Orange Pop     | #FF8C42   |
| Error              | Coral Red      | #FF6B6B   |
| Student Background | Soft Cream     | #FFF8E7   |
| Teacher Background | Light Lavender | #F5F0FF   |

---

## Testing Strategy

### Overview

- **E2E Testing**: Playwright (cross-browser)
- **Unit Testing**: Vitest + Testing Library

### Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e/specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'tablet', use: { ...devices['iPad Pro'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### Page Object Model Example

```typescript
// tests/e2e/pages/student-dashboard.page.ts
import { type Page, type Locator, expect } from '@playwright/test';

export class StudentDashboardPage {
  readonly page: Page;
  readonly welcomeMessage: Locator;
  readonly gameCards: Locator;
  readonly starsCount: Locator;

  constructor(page: Page) {
    this.page = page;
    this.welcomeMessage = page.getByTestId('welcome-message');
    this.gameCards = page.getByTestId('game-card');
    this.starsCount = page.getByTestId('stars-count');
  }

  async goto() {
    await this.page.goto('/student');
  }

  async expectWelcomeMessage(name: string) {
    await expect(this.welcomeMessage).toContainText(name);
  }

  async clickGame(index: number) {
    await this.gameCards.nth(index).click();
  }
}
```

### Test Commands

```bash
npm run test:e2e           # Run all E2E tests
npm run test:e2e:headed    # Run with visible browser
npm run test:e2e:ui        # Interactive UI mode
npm run test:e2e:report    # View HTML report
npm run test:unit          # Run unit tests
npm run test:coverage      # Run with coverage
```

---

## Development Phases

### Phase 1: Foundation (Weeks 1-3)
- Project setup (Next.js 16.1.1, Supabase, Tailwind)
- Database schema and migrations
- Authentication system
- UI component library & animation system
- Playwright & Vitest setup

### Phase 2: Teacher Core (Weeks 4-6)
- Teacher dashboard
- Class & student management
- E2E tests for teacher workflows

### Phase 3: Games Core (Weeks 7-9)
- Games library UI
- Game player with iframe integration
- Progress tracking & assignments

### Phase 4: Student Experience (Weeks 10-11)
- Student dashboard with mascot
- Gamification (stars, badges)
- Celebration animations

### Phase 5: First Games (Weeks 12-14)
- 3-5 initial Phaser games
- Game communication E2E tests

### Phase 6: Parent & Analytics (Weeks 15-17)
- Parent portal
- Teacher analytics & reports

### Phase 7: Polish & Launch (Weeks 18-20)
- Admin panel
- i18n (Romanian + English)
- Security & accessibility audits
- Full E2E test suite

---

## Environment Configuration

### Docker Setup (Recommended)

The project uses Docker Compose to run the full Supabase stack locally. No external Supabase account needed for development.

#### Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose)
- Node.js 20+ (for running outside Docker)
- Make (optional, for convenient commands)

#### Quick Start

```bash
# 1. Clone repository
git clone <repo-url>
cd eduplay

# 2. Copy environment file
cp .env.example .env

# 3. Start everything (first time)
make setup

# Or manually:
docker compose up -d
```

#### Local Development URLs

| Service | URL | Description |
|---------|-----|-------------|
| **App** | http://localhost:3000 | Next.js application |
| **Supabase API** | http://localhost:54421 | Main API endpoint |
| **Supabase Studio** | http://localhost:54423 | Database GUI |
| **Inbucket** | http://localhost:54424 | Email testing UI |
| **PostgreSQL** | localhost:54422 | Direct DB access |

#### Docker Files

```
eduplay/
├── docker-compose.yml      # Full development stack
├── Dockerfile              # Production build
├── Dockerfile.dev          # Development with hot reload
├── .dockerignore           # Excluded files
├── .env.example            # Environment template
├── Makefile                # Convenient commands
└── docker/
    └── kong/
        └── kong.yml        # API gateway config
```

### Environment Variables

```bash
# Supabase (Local Docker - pre-configured in .env.example)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54421
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=EduPlay

# Feature Flags
NEXT_PUBLIC_ENABLE_PARENT_PORTAL=false
NEXT_PUBLIC_ENABLE_ANALYTICS=false
NEXT_PUBLIC_ENABLE_SOUND_EFFECTS=true

# Testing
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000

# Production Only
# SENTRY_DSN=
# NEXT_PUBLIC_SENTRY_DSN=
```

### Development Commands

#### Using Make (Recommended)

```bash
# Setup & Development
make setup          # Full first-time setup
make dev            # Start all services
make stop           # Stop all services
make restart        # Restart all services
make logs           # View all logs
make logs-app       # View Next.js logs only

# Database
make db-studio      # Open Supabase Studio
make db-migrate     # Run migrations
make db-seed        # Seed test data
make db-reset       # Reset database completely
make db-types       # Generate TypeScript types

# Testing
make test           # Run all tests
make test-unit      # Run unit tests only
make test-e2e       # Run E2E tests
make test-e2e-ui    # Run E2E with Playwright UI

# Code Quality
make lint           # Run ESLint
make format         # Format with Prettier
make typecheck      # TypeScript check

# Cleanup
make clean          # Remove build artifacts
make reset          # Full reset (removes volumes)
```

#### Using Docker Compose Directly

```bash
docker compose up -d              # Start all services
docker compose down               # Stop services
docker compose down -v            # Stop + remove data
docker compose logs -f            # View logs
docker compose logs -f app        # View app logs
docker compose exec app sh        # Shell into app container
docker compose exec supabase-db psql -U postgres  # Database CLI
```

#### Without Docker

```bash
npm install                 # Install dependencies
npm run dev                 # Start Next.js
npx supabase start          # Start Supabase CLI (requires Docker)
npx supabase db push        # Apply migrations
npm run generate:types      # Generate DB types
npm run lint                # Lint code
npm run test:e2e            # Run E2E tests
npm run build               # Build for production
```

### Git Commit Convention

```bash
# Format: <type>(<scope>): <subject>
# Types: feat, fix, docs, style, refactor, test, chore

feat(auth): add student PIN login
fix(games): resolve iframe communication bug
test(e2e): add teacher dashboard tests
```

---

## Appendix

### Game Categories

| Category   | Icon | Color   | Description                  |
| ---------- | ---- | ------- | ---------------------------- |
| literacy   | 📖   | #4A90D9 | Letters, reading, writing    |
| math       | 🔢   | #7ED321 | Numbers, counting, operations|
| phonics    | 🔊   | #F5A623 | Letter sounds, pronunciation |
| shapes     | 🔷   | #9B59B6 | Geometric shapes recognition |
| colors     | 🎨   | #E74C3C | Color identification, mixing |
| vocabulary | 💬   | #1ABC9C | Words, objects, categories   |

### Difficulty Levels

| Level  | Stars | Target Age | Description                    |
| ------ | ----- | ---------- | ------------------------------ |
| easy   | ⭐     | 3-5        | Simple tasks, high success rate|
| medium | ⭐⭐   | 5-8        | Moderate challenge             |
| hard   | ⭐⭐⭐  | 8-12       | Complex tasks, requires mastery|
