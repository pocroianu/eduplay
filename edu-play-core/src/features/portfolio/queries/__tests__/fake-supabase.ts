// Test helper: a thenable Supabase query-builder mock that mirrors the
// chained `.select().eq().in().order()...` API the real client exposes.
// Adapted from `src/features/admin/queries/__tests__/overview.test.ts`.

import { vi, type Mock } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SelectResult {
  data?: unknown;
  count?: number | null;
  error?: { message: string } | null;
}

interface BuilderConfig {
  result: SelectResult;
  trace?: { calls: Array<{ fn: string; args: unknown[] }> };
}

function makeQueryBuilder({ result, trace }: BuilderConfig) {
  const builder: Record<string, unknown> = {};
  const passthrough = [
    'select',
    'eq',
    'in',
    'gt',
    'gte',
    'lt',
    'lte',
    'not',
    'is',
    'or',
    'order',
    'limit',
    'update',
    'insert',
    'delete',
    'maybeSingle',
    'single',
  ];
  for (const fn of passthrough) {
    builder[fn] = vi.fn((...args: unknown[]) => {
      trace?.calls.push({ fn, args });
      // `maybeSingle`/`single` are terminal — return a thenable that
      // resolves to the configured result.
      if (fn === 'maybeSingle' || fn === 'single') {
        return Promise.resolve(result);
      }
      return builder;
    });
  }
  builder.then = (
    onFulfilled: (value: SelectResult) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

export interface FakeClientConfig {
  perTable: Record<string, SelectResult[]>;
}

export interface FakeClient {
  client: SupabaseClient;
  from: Mock;
  fromCalls: string[];
  trace: { calls: Array<{ fn: string; args: unknown[] }> };
}

export function fakeClient(config: FakeClientConfig): FakeClient {
  const seen: Record<string, number> = {};
  const fromCalls: string[] = [];
  const trace = { calls: [] as Array<{ fn: string; args: unknown[] }> };
  const from = vi.fn((table: string) => {
    fromCalls.push(table);
    const queue = config.perTable[table];
    if (!queue || queue.length === 0) {
      throw new Error(`fake supabase: no queued result for table=${table}`);
    }
    const idx = seen[table] ?? 0;
    if (idx >= queue.length) {
      throw new Error(`fake supabase: ran out of results for table=${table}`);
    }
    seen[table] = idx + 1;
    return makeQueryBuilder({ result: queue[idx], trace });
  });
  return { client: { from } as unknown as SupabaseClient, from, fromCalls, trace };
}

export function makeArtifactRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    student_id: '22222222-2222-2222-2222-222222222222',
    class_id: '33333333-3333-3333-3333-333333333333',
    title: 'Drawing',
    artifact_type: 'drawing',
    storage_path: 'students/22222222-2222-2222-2222-222222222222/x.png',
    visibility: 'draft',
    reviewed_by: null,
    reviewed_at: null,
    metadata: {},
    created_at: '2026-05-01T00:00:00.000Z',
    updated_at: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}
