import { z } from 'zod';

import { ApiError } from './errors';

function buildFieldErrors(error: z.ZodError): { fields: Record<string, string[]> } {
  const fields: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.map(String).join('.') || '_root';
    if (!fields[path]) {
      fields[path] = [];
    }
    fields[path].push(issue.message);
  }

  return { fields };
}

export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw ApiError.validation('Request body must be valid JSON');
  }

  const result = schema.safeParse(body);

  if (!result.success) {
    throw ApiError.validation('Invalid request data', buildFieldErrors(result.error));
  }

  return result.data;
}

export function parseQuery<T extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: T,
): z.infer<T> {
  const params: Record<string, string> = {};

  for (const [key, value] of searchParams.entries()) {
    params[key] = value;
  }

  const result = schema.safeParse(params);

  if (!result.success) {
    throw ApiError.validation('Invalid query parameters', buildFieldErrors(result.error));
  }

  return result.data;
}
