import { z } from 'zod';

import { ApiError } from './errors';

/**
 * Runtime parsers for Supabase rows at API/DB boundaries.
 *
 * Use these to validate the shape of data returned from Supabase before
 * sending it to clients. They surface drift between the generated
 * `database.ts` types and the live schema as a 500 (with structured
 * server logs) rather than letting bad shapes flow silently to consumers.
 *
 * Parse the camelCase entity (i.e., after `camelCaseKeys`) so the schema
 * doubles as the public API contract.
 */

const MAX_LOGGED_ISSUES = 5;

function logSchemaDrift(context: string, error: z.ZodError): void {
  const issues = error.issues.slice(0, MAX_LOGGED_ISSUES).map((issue) => ({
    path: issue.path.map(String).join('.') || '_root',
    code: issue.code,
    message: issue.message,
  }));

  console.error('[parseRow] schema drift detected', {
    context,
    issueCount: error.issues.length,
    issues,
  });
}

/**
 * Validate a single Supabase row against a Zod schema.
 *
 * Throws `ApiError(INTERNAL_ERROR)` if the row fails validation. The
 * underlying Zod issues are logged server-side; the client sees only a
 * generic message so we never leak schema details.
 */
export function parseRow<T extends z.ZodType>(
  row: unknown,
  schema: T,
  context: string,
): z.infer<T> {
  const result = schema.safeParse(row);

  if (!result.success) {
    logSchemaDrift(context, result.error);
    throw new ApiError('INTERNAL_ERROR', 'Database row failed validation');
  }

  return result.data;
}

/**
 * Validate an array of Supabase rows. Each row is parsed individually so
 * the log identifies which index drifted.
 */
export function parseRows<T extends z.ZodType>(
  rows: readonly unknown[],
  schema: T,
  context: string,
): z.infer<T>[] {
  return rows.map((row, index) => parseRow(row, schema, `${context}[${index}]`));
}

/**
 * Validate a row that may be `null` or `undefined`. Returns `null` for
 * absent values; throws on shape mismatch.
 */
export function parseMaybeRow<T extends z.ZodType>(
  row: unknown,
  schema: T,
  context: string,
): z.infer<T> | null {
  if (row === null || row === undefined) {
    return null;
  }
  return parseRow(row, schema, context);
}
