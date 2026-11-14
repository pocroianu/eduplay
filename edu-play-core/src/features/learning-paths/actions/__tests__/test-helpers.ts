// Shared fake Supabase builders for learning-paths action tests.
// Kept outside any `'use server'` context — pure helpers, mocked in.

import { vi } from "vitest";

export interface FakeResult {
  data?: unknown;
  error?: { message: string } | null;
}

export interface InsertCapture {
  table?: string;
  payload?: Record<string, unknown>;
  filters?: Array<[column: string, value: unknown]>;
}

export interface UpsertCapture extends InsertCapture {
  options?: Record<string, unknown>;
}

export function fakeInsertSupabase(result: FakeResult, capture: InsertCapture) {
  const builder: Record<string, unknown> = {};
  builder.insert = vi.fn((payload: Record<string, unknown>) => {
    capture.payload = payload;
    return builder;
  });
  builder.select = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  return {
    from: vi.fn((table: string) => {
      capture.table = table;
      return builder;
    }),
  };
}
