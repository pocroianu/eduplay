// Test helper: a thenable Supabase query-builder mock that mirrors the
// chained `.select().eq()...` API the real client exposes. Adapted from the
// portfolio module's identical helper.

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
    'or',
    'is',
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
  return {
    client: { from } as unknown as SupabaseClient,
    from,
    fromCalls,
    trace,
  };
}

export function makeActivityInstanceRow(
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    type_id: 'drawing-canvas',
    config: { promptText: 'Desenează ceva frumos' },
    assigned_to: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
    class_id: '6ba7b811-9dad-41d1-80b4-00c04fd430c8',
    source_learning_path_step_id: null,
    result_summary: null,
    created_by: '6ba7b812-9dad-41d1-80b4-00c04fd430c8',
    created_at: '2026-05-01T00:00:00.000Z',
    updated_at: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}
