import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  checkFiles,
  getChangedEntries,
  shouldRunTypesDrift,
  type FileSnapshot,
} from '../../../scripts/check-agent-guardrails';

function file(path: string, content: string): FileSnapshot {
  return { path, content };
}

describe('checkFiles', () => {
  it('flags unsafe patterns in changed production files', () => {
    const violations = checkFiles([
      file(
        'src/app/api/v1/games/route.ts',
        [
          "import { NextResponse } from 'next/server';",
          'export async function POST(request: Request) {',
          '  const body = await request.json();',
          "  return NextResponse.json({ error: 'bad' }, { status: 400 });",
          '}',
        ].join('\n')
      ),
      file(
        'src/features/games/components/GameEmbed.tsx',
        [
          "window.parent.postMessage({ type: 'GAME_COMPLETE' }, '*');",
          "const color = '#ff0000';",
          "const cls = 'bg-[#fff] shadow-[0_1px_2px_red] rounded-[17px]';",
        ].join('\n')
      ),
      file(
        'src/app/(dashboard)/teacher/TeacherDashboardContent.tsx',
        "import { AdminPageHeader } from '@/features/admin/components/overview/AdminPageHeader';\n"
      ),
      file(
        'supabase/migrations/20260512000000_bad_select_policy.sql',
        [
          'CREATE POLICY "teachers see loose students"',
          'ON students',
          'FOR SELECT',
          'USING (class_id IS NULL);',
        ].join('\n')
      ),
    ]);

    expect(violations.map((violation) => violation.rule)).toEqual([
      'api-no-raw-request-json',
      'api-no-raw-nextresponse-json',
      'postmessage-no-wildcard-origin',
      'ui-no-raw-token-values',
      'ui-no-raw-token-values',
      'feature-no-deep-imports',
      'rls-no-null-select-visibility',
    ]);
  });

  it('flags raw API request JSON parsing regardless of parameter name', () => {
    const violations = checkFiles([
      file(
        'src/app/api/v1/games/route.ts',
        [
          'export async function POST(req: Request) {',
          '  const body = await req.json();',
          '  return Response.json({ ok: true });',
          '}',
        ].join('\n')
      ),
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        rule: 'api-no-raw-request-json',
        line: 2,
      }),
    ]);
  });

  it('flags raw API request JSON parsing on contextually typed route handlers', () => {
    const violations = checkFiles([
      file(
        'src/app/api/v1/games/route.ts',
        [
          "import { handleRoute } from '@/lib/api/handle-route';",
          'export const POST = handleRoute(async (req) => {',
          '  const body = await req.json();',
          '  return Response.json({ ok: true });',
          '});',
        ].join('\n')
      ),
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        rule: 'api-no-raw-request-json',
        line: 3,
      }),
    ]);
  });

  it('allows upstream response JSON parsing in API routes', () => {
    const violations = checkFiles([
      file(
        'src/app/api/v1/games/route.ts',
        [
          'export async function POST(req: Request) {',
          "  const upstreamResponse = await fetch('https://example.test/games');",
          '  const payload = await upstreamResponse.json();',
          '  return Response.json(payload);',
          '}',
        ].join('\n')
      ),
    ]);

    expect(violations).toEqual([]);
  });

  it('flags NextResponse.json in parameterless API routes', () => {
    const violations = checkFiles([
      file(
        'src/app/api/v1/health/route.ts',
        [
          "import { NextResponse } from 'next/server';",
          'export async function GET() {',
          "  return NextResponse.json({ ok: true });",
          '}',
        ].join('\n')
      ),
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        rule: 'api-no-raw-nextresponse-json',
        line: 3,
      }),
    ]);
  });

  it('allows approved imports and test-only deep imports', () => {
    const violations = checkFiles([
      file(
        'src/app/(dashboard)/student/page.tsx',
        [
          "import { getGamesWithProgress } from '@/features/games/server';",
          "import { GameCard } from '@/features/games';",
        ].join('\n')
      ),
      file('src/app/(dashboard)/student/loading.tsx', 'export default function Loading() {}'),
      file('src/app/(dashboard)/student/error.tsx', "'use client'; export default function Error() {}"),
      file(
        'tests/unit/features/games/game-card.test.tsx',
        "import { GameCard } from '@/features/games/components/GameCard';\n"
      ),
    ]);

    expect(violations).toEqual([]);
  });

  it('flags changed route pages that lack sibling loading and error boundaries', () => {
    const violations = checkFiles([
      file('src/app/(dashboard)/teacher/reports/page.tsx', 'export default function Page() {}'),
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        rule: 'route-requires-loading-and-error',
        path: 'src/app/(dashboard)/teacher/reports/page.tsx',
      }),
    ]);
  });

  it('flags console.log in changed client components', () => {
    const violations = checkFiles([
      file(
        'src/features/auth/components/login-form.tsx',
        [
          "'use client';",
          '',
          'export function LoginForm() {',
          "  console.log('debug login');",
          '  return null;',
          '}',
        ].join('\n')
      ),
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        rule: 'client-no-console-log',
        path: 'src/features/auth/components/login-form.tsx',
        line: 4,
      }),
    ]);
  });

  it('recognizes client directives without semicolons', () => {
    const violations = checkFiles([
      file(
        'src/features/auth/components/login-form.tsx',
        [
          "'use client'",
          '',
          'export function LoginForm() {',
          "  console.log('debug login');",
          '  return null;',
          '}',
        ].join('\n')
      ),
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        rule: 'client-no-console-log',
        line: 4,
      }),
    ]);
  });

  it('recognizes client directives after leading block comments', () => {
    const violations = checkFiles([
      file(
        'src/features/auth/components/login-form.tsx',
        [
          '/**',
          ' * Login form client behavior.',
          ' */',
          "'use client';",
          '',
          'export function LoginForm() {',
          "  console.log('debug login');",
          '  return null;',
          '}',
        ].join('\n')
      ),
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        rule: 'client-no-console-log',
        line: 7,
      }),
    ]);
  });

  it('rechecks existing console.log when a file becomes a client component', () => {
    const violations = checkFiles([
      {
        path: 'src/features/auth/components/login-form.tsx',
        content: [
          "'use client';",
          '',
          'export function LoginForm() {',
          "  console.log('debug login');",
          '  return null;',
          '}',
        ].join('\n'),
        changedLines: new Set([1]),
        status: 'M',
      },
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        rule: 'client-no-console-log',
        line: 4,
      }),
    ]);
  });

  it('allows console.log in non-client production utilities', () => {
    const violations = checkFiles([
      file(
        'src/lib/server-diagnostics.ts',
        [
          'export function logDiagnostics() {',
          "  console.log('server diagnostics');",
          '}',
        ].join('\n')
      ),
    ]);

    expect(violations).toEqual([]);
  });

  it('flags direct locale date/time formatting in changed UI files', () => {
    const violations = checkFiles([
      file(
        'src/features/parent-portal/components/activity-feed.tsx',
        [
          'export function ActivityFeed({ date }: { date: Date }) {',
          "  const day = date.toLocaleDateString('ro-RO');",
          "  const time = date.toLocaleTimeString('ro-RO');",
          '  return <p>{day} {time}</p>;',
          '}',
        ].join('\n')
      ),
    ]);

    expect(violations.map((violation) => violation.rule)).toEqual([
      'ui-no-direct-locale-formatting',
      'ui-no-direct-locale-formatting',
    ]);
  });

  it('flags direct locale number formatting in changed UI files', () => {
    const violations = checkFiles([
      file(
        'src/features/teacher-dashboard/components/score-summary.tsx',
        [
          'export function ScoreSummary({ count }: { count: number }) {',
          "  return <p>{count.toLocaleString('ro-RO')}</p>;",
          '}',
        ].join('\n')
      ),
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        rule: 'ui-no-direct-locale-formatting',
        line: 2,
      }),
    ]);
  });

  it('allows direct locale formatting in formatter utilities and query files', () => {
    const violations = checkFiles([
      file(
        'src/lib/i18n/formatters.ts',
        [
          'export function formatDate(date: Date) {',
          "  return date.toLocaleDateString('ro-RO');",
          '}',
        ].join('\n')
      ),
      file(
        'src/features/teacher-dashboard/queries/aggregate-dashboard-stats.ts',
        [
          'export function label(date: Date) {',
          "  return date.toLocaleDateString('ro-RO');",
          '}',
        ].join('\n')
      ),
    ]);

    expect(violations).toEqual([]);
  });

  it('allows direct locale formatting in API routes', () => {
    const violations = checkFiles([
      file(
        'src/app/api/v1/reports/route.ts',
        [
          'export async function GET() {',
          "  const label = Number(12).toLocaleString('ro-RO');",
          '  return Response.json({ label });',
          '}',
        ].join('\n')
      ),
    ]);

    expect(violations).toEqual([]);
  });

  it('ignores historical violations outside changed lines', () => {
    const violations = checkFiles([
      {
        path: 'src/features/games/components/GameEmbed.tsx',
        content: [
          "'use client'",
          "window.parent.postMessage({ type: 'GAME_COMPLETE' }, '*');",
          'export function GameEmbed() {',
          "  return <p>New copy only</p>;",
          '}',
        ].join('\n'),
        changedLines: new Set([4]),
        status: 'M',
      },
    ]);

    expect(violations).toEqual([]);
  });

  it('flags new route pages without boundaries without forcing old pages to comply', () => {
    const modifiedPageViolations = checkFiles([
      {
        path: 'src/app/(dashboard)/teacher/reports/page.tsx',
        content: 'export default function Page() { return null; }',
        changedLines: new Set([1]),
        status: 'M',
      },
    ]);
    const newPageViolations = checkFiles([
      {
        path: 'src/app/(dashboard)/teacher/new-report/page.tsx',
        content: 'export default function Page() { return null; }',
        changedLines: new Set([1]),
        status: 'A',
      },
    ]);

    expect(modifiedPageViolations).toEqual([]);
    expect(newPageViolations).toEqual([
      expect.objectContaining({
        rule: 'route-requires-loading-and-error',
      }),
    ]);
  });

  it('flags wildcard postMessage in changed static game bundles', () => {
    const violations = checkFiles([
      {
        path: 'public/games/mock-game/index.html',
        content: "<script>window.parent.postMessage({ type: 'GAME_COMPLETE' }, '*')</script>",
        changedLines: new Set([1]),
        status: 'M',
      },
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        rule: 'postmessage-no-wildcard-origin',
        path: 'public/games/mock-game/index.html',
      }),
    ]);
  });

  it('checks the changed wildcard origin line for multiline postMessage calls', () => {
    const violations = checkFiles([
      {
        path: 'public/games/mock-game/index.html',
        content: [
          '<script>',
          'window.parent.postMessage(',
          "  { type: 'GAME_COMPLETE' },",
          "  '*'",
          ');',
          '</script>',
        ].join('\n'),
        changedLines: new Set([4]),
        status: 'M',
      },
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        rule: 'postmessage-no-wildcard-origin',
        line: 4,
      }),
    ]);
  });

  it('flags wildcard postMessage when a transfer list follows the target origin', () => {
    const violations = checkFiles([
      {
        path: 'public/games/mock-game/assets/runtime.js',
        content: "window.parent.postMessage({ type: 'GAME_COMPLETE' }, '*', [port]);",
        changedLines: new Set([1]),
        status: 'M',
      },
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        rule: 'postmessage-no-wildcard-origin',
        line: 1,
      }),
    ]);
  });

  it('flags wildcard postMessage targetOrigin options', () => {
    const violations = checkFiles([
      {
        path: 'public/games/mock-game/assets/runtime.js',
        content:
          "window.parent.postMessage({ type: 'GAME_COMPLETE' }, { targetOrigin: '*' });",
        changedLines: new Set([1]),
        status: 'M',
      },
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        rule: 'postmessage-no-wildcard-origin',
        line: 1,
      }),
    ]);
  });

  it('flags template-literal wildcard postMessage target origins', () => {
    const violations = checkFiles([
      {
        path: 'public/games/mock-game/assets/runtime.js',
        content: [
          'window.parent.postMessage({ type: "GAME_COMPLETE" }, `*`);',
          'window.parent.postMessage({ type: "GAME_COMPLETE" }, { targetOrigin: `*` });',
        ].join('\n'),
        changedLines: new Set([1, 2]),
        status: 'M',
      },
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        rule: 'postmessage-no-wildcard-origin',
        line: 1,
      }),
      expect.objectContaining({
        rule: 'postmessage-no-wildcard-origin',
        line: 2,
      }),
    ]);
  });

  it('ignores postMessage-like text outside executable calls', () => {
    const violations = checkFiles([
      {
        path: 'public/games/mock-game/assets/runtime.js',
        content: [
          "// window.parent.postMessage({ type: 'GAME_COMPLETE' }, '*');",
          "const example = \"window.parent.postMessage({ type: 'GAME_COMPLETE' }, '*')\";",
        ].join('\n'),
        changedLines: new Set([1, 2]),
        status: 'M',
      },
    ]);

    expect(violations).toEqual([]);
  });

  it('does not scan unrelated wildcard strings after a safe postMessage call', () => {
    const violations = checkFiles([
      {
        path: 'public/games/mock-game/assets/runtime.js',
        content: [
          "window.parent.postMessage({ type: 'GAME_COMPLETE' }, allowedOrigin);",
          "expectSymbol(token, '*');",
        ].join('\n'),
        changedLines: new Set([2]),
        status: 'M',
      },
    ]);

    expect(violations).toEqual([]);
  });

  it('flags wildcard postMessage in changed static game JavaScript bundles', () => {
    const violations = checkFiles([
      {
        path: 'public/games/mock-game/assets/runtime.js',
        content: "window.parent.postMessage({ type: 'GAME_COMPLETE' }, '*');",
        changedLines: new Set([1]),
        status: 'M',
      },
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        rule: 'postmessage-no-wildcard-origin',
        path: 'public/games/mock-game/assets/runtime.js',
      }),
    ]);
  });

  it('does not treat post-policy IS NULL statements as part of the policy', () => {
    const violations = checkFiles([
      file(
        'supabase/migrations/20260512000000_valid_policy_then_index.sql',
        [
          'CREATE POLICY "teachers see class students"',
          'ON students',
          'FOR SELECT',
          "USING (class_id = current_setting('app.class_id')::uuid);",
          '',
          'CREATE INDEX students_active_idx',
          'ON students (id)',
          'WHERE deleted_at IS NULL;',
        ].join('\n')
      ),
    ]);

    expect(violations).toEqual([]);
  });

  it('treats FOR ALL policies as SELECT-visible policies', () => {
    const violations = checkFiles([
      file(
        'supabase/migrations/20260512000000_bad_all_policy.sql',
        [
          'CREATE POLICY "teachers see loose students"',
          'ON students',
          'FOR ALL',
          'USING (class_id IS NULL);',
        ].join('\n')
      ),
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        rule: 'rls-no-null-select-visibility',
      }),
    ]);
  });

  it('treats policies without explicit commands as SELECT-visible policies', () => {
    const violations = checkFiles([
      file(
        'supabase/migrations/20260512000000_bad_default_policy.sql',
        [
          'CREATE POLICY "teachers see loose students"',
          'ON students',
          'USING (class_id IS NULL);',
        ].join('\n')
      ),
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        rule: 'rls-no-null-select-visibility',
      }),
    ]);
  });

  it('allows scoped NULL predicates in SELECT-visible RLS policies', () => {
    const violations = checkFiles([
      file(
        'supabase/migrations/20260512000000_scoped_null_policy.sql',
        [
          'CREATE POLICY "assigned students can view learning paths"',
          'ON learning_path_assignments',
          'FOR SELECT',
          'USING (',
          '  class_id IN (SELECT class_id FROM students WHERE user_id = auth.uid())',
          '  OR (class_id IS NULL AND student_id IN (SELECT id FROM students WHERE user_id = auth.uid()))',
          ');',
        ].join('\n')
      ),
    ]);

    expect(violations).toEqual([]);
  });

  it('does not scan historical line-level violations when changed diff lines are empty', () => {
    const violations = checkFiles([
      {
        path: 'src/features/games/components/GameEmbed.tsx',
        content: [
          "'use client'",
          "window.parent.postMessage({ type: 'GAME_COMPLETE' }, '*');",
          'export function GameEmbed() {',
          '  return null;',
          '}',
        ].join('\n'),
        changedLines: new Set(),
        status: 'M',
      },
    ]);

    expect(violations).toEqual([]);
  });

  it('does not scan historical RLS policies when changed diff lines are empty', () => {
    const violations = checkFiles([
      {
        path: 'supabase/migrations/20260512000000_bad_select_policy.sql',
        content: [
          'CREATE POLICY "teachers see loose students"',
          'ON students',
          'FOR SELECT',
          'USING (class_id IS NULL);',
        ].join('\n'),
        changedLines: new Set(),
        status: 'M',
      },
    ]);

    expect(violations).toEqual([]);
  });

  it('flags missing boundaries for copied or renamed route pages', () => {
    const violations = checkFiles([
      {
        path: 'src/app/(dashboard)/teacher/copied/page.tsx',
        content: 'export default function Page() { return null; }',
        changedLines: new Set(),
        status: 'R',
      },
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        rule: 'route-requires-loading-and-error',
      }),
    ]);
  });

  it('ignores raw token fixtures in colocated tests', () => {
    const violations = checkFiles([
      file(
        'src/features/games/components/game-card.test.tsx',
        [
          "const fixture = { color: '#fff', className: 'bg-[#fff]' };",
          'expect(fixture.color).toBeDefined();',
        ].join('\n')
      ),
    ]);

    expect(violations).toEqual([]);
  });

  it('allows raw token-like fixtures outside UI files', () => {
    const violations = checkFiles([
      file(
        'src/lib/color-parser.ts',
        [
          "const sample = '#fff';",
          "const arbitraryClass = 'bg-[#fff]';",
        ].join('\n')
      ),
    ]);

    expect(violations).toEqual([]);
  });

  it('allows same-feature internal imports', () => {
    const violations = checkFiles([
      file(
        'src/features/games/components/GameCard.tsx',
        "import { getGameStats } from '@/features/games/queries/get-game-stats';"
      ),
    ]);

    expect(violations).toEqual([]);
  });

  it('flags side-effect and dynamic feature deep imports', () => {
    const violations = checkFiles([
      file(
        'src/features/teacher-dashboard/components/DeepImportProbe.tsx',
        [
          "import '@/features/games/components/internal-setup';",
          "await import('@/features/classes/components/ClassCard');",
        ].join('\n')
      ),
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        rule: 'feature-no-deep-imports',
        line: 1,
      }),
      expect.objectContaining({
        rule: 'feature-no-deep-imports',
        line: 2,
      }),
    ]);
  });

  it('checks the changed specifier line for multiline dynamic deep imports', () => {
    const violations = checkFiles([
      {
        path: 'src/features/teacher-dashboard/components/DeepImportProbe.tsx',
        content: [
          'await import(',
          "  '@/features/classes/components/ClassCard'",
          ');',
        ].join('\n'),
        changedLines: new Set([2]),
        status: 'M',
      },
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        rule: 'feature-no-deep-imports',
        line: 2,
      }),
    ]);
  });
});

describe('shouldRunTypesDrift', () => {
  it('only requires the Supabase type drift check when migrations changed', () => {
    expect(shouldRunTypesDrift(['src/app/page.tsx'])).toBe(false);
    expect(shouldRunTypesDrift(['supabase/migrations/20260512000000_new_table.sql'])).toBe(true);
  });

  it('requires the Supabase type drift check when migrations are deleted', () => {
    expect(
      shouldRunTypesDrift([
        {
          path: 'supabase/migrations/20260512000000_removed_table.sql',
          status: 'D',
          changedLines: new Set(),
        },
      ])
    ).toBe(true);
  });
});

describe('getChangedEntries', () => {
  it('scopes tracked and untracked changes to a project nested inside a Git repository', () => {
    const repository = mkdtempSync(path.join(tmpdir(), 'eduplay-guardrails-'));
    const project = path.join(repository, 'edu-play-core');
    const runGit = (args: string[], cwd = repository) =>
      execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

    try {
      mkdirSync(path.join(project, 'src'), { recursive: true });
      mkdirSync(path.join(repository, 'phaser-projects'), { recursive: true });
      writeFileSync(path.join(project, 'src/example.ts'), 'export const value = 1;\n');
      writeFileSync(path.join(repository, 'phaser-projects/example.ts'), 'export const value = 1;\n');
      runGit(['init', '--quiet']);
      runGit(['add', '.']);
      runGit(['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'baseline']);

      writeFileSync(path.join(project, 'src/example.ts'), 'export const value = 2;\n');
      writeFileSync(path.join(project, 'src/untracked.ts'), 'export const local = true;\n');
      writeFileSync(path.join(repository, 'phaser-projects/example.ts'), 'export const value = 2;\n');
      mkdirSync(path.join(project, 'supabase/migrations'), { recursive: true });
      writeFileSync(path.join(project, 'supabase/migrations/20261114000000_example.sql'), '-- example\n');
      runGit(['add', 'supabase/migrations'], project);

      const entries = getChangedEntries({
        git: (args) => runGit(args, project),
        env: { AGENT_GUARDRAILS_BASE: 'HEAD' },
      });

      expect(entries.map((entry) => entry.path).sort()).toEqual([
        'src/example.ts',
        'src/untracked.ts',
        'supabase/migrations/20261114000000_example.sql',
      ]);
      expect(entries.find((entry) => entry.path === 'src/example.ts')?.changedLines).toEqual(new Set([1]));
      expect(shouldRunTypesDrift(entries)).toBe(true);
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });

  it('uses another available base when origin/main is absent', () => {
    const calls: string[][] = [];
    const entries = getChangedEntries({
      git: (args) => {
        calls.push(args);
        if (args[0] === 'merge-base' && args[1] === 'origin/main') {
          throw new Error('missing origin/main');
        }
        if (args[0] === 'merge-base' && args[1] === 'main') {
          return 'abc123';
        }
        if (args.includes('--name-status') && args.includes('abc123...HEAD')) {
          return 'M\tsrc/app/page.tsx';
        }
        if (args.includes('--unified=0') && args.includes('abc123...HEAD')) {
          return [
            'diff --git a/src/app/page.tsx b/src/app/page.tsx',
            '--- a/src/app/page.tsx',
            '+++ b/src/app/page.tsx',
            '@@ -1 +1 @@',
            '-old',
            '+new',
          ].join('\n');
        }

        return '';
      },
      env: {},
    });

    expect(entries).toEqual([
      expect.objectContaining({
        path: 'src/app/page.tsx',
        status: 'M',
        changedLines: new Set([1]),
      }),
    ]);
    expect(calls).not.toContainEqual(['diff', '--name-only', '--diff-filter=ACMR', 'HEAD']);
  });

  it('fetches the Jenkins change target when the remote base ref is absent locally', () => {
    const calls: string[][] = [];
    let fetchedTarget = false;
    const entries = getChangedEntries({
      git: (args) => {
        calls.push(args);
        if (args[0] === 'merge-base' && args[1] === 'origin/main') {
          if (!fetchedTarget) throw new Error('missing origin/main');
          return 'abc123';
        }
        if (args[0] === 'fetch') {
          fetchedTarget = true;
          return '';
        }
        if (args.includes('--name-status') && args.includes('abc123...HEAD')) {
          return 'M\tsrc/app/page.tsx';
        }
        if (args.includes('--unified=0') && args.includes('abc123...HEAD')) {
          return [
            'diff --git a/src/app/page.tsx b/src/app/page.tsx',
            '--- a/src/app/page.tsx',
            '+++ b/src/app/page.tsx',
            '@@ -1 +1 @@',
            '-old',
            '+new',
          ].join('\n');
        }

        return '';
      },
      env: { CHANGE_TARGET: 'main' },
    });

    expect(entries).toEqual([
      expect.objectContaining({
        path: 'src/app/page.tsx',
        changedLines: new Set([1]),
      }),
    ]);
    expect(calls).toContainEqual([
      'fetch',
      '--depth=200',
      'origin',
      'main:refs/remotes/origin/main',
    ]);
  });

  it('includes untracked files in local guardrail scans', () => {
    const calls: string[][] = [];
    const entries = getChangedEntries({
      git: (args) => {
        calls.push(args);
        if (args[0] === 'merge-base') {
          return 'abc123';
        }
        if (args[0] === 'ls-files') {
          return [
            'supabase/migrations/20260512000000_new_policy.sql',
            'public/games/new-game/assets/runtime.js',
          ].join('\n');
        }

        return '';
      },
      env: {},
    });

    expect(entries).toEqual([
      expect.objectContaining({
        path: 'supabase/migrations/20260512000000_new_policy.sql',
        status: 'A',
      }),
      expect.objectContaining({
        path: 'public/games/new-game/assets/runtime.js',
        status: 'A',
      }),
    ]);
    expect(calls).toContainEqual(['ls-files', '--others', '--exclude-standard']);
    expect(shouldRunTypesDrift(entries)).toBe(true);
  });

  it('fails with setup guidance when no base ref can be resolved', () => {
    expect(() =>
      getChangedEntries({
        git: (args) => {
          if (args[0] === 'merge-base') throw new Error('missing base');
          return '';
        },
        env: {},
      })
    ).toThrow(/AGENT_GUARDRAILS_BASE/);
  });
});
