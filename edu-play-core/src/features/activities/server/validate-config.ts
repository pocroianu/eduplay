import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

import { ApiError } from '@/lib/api';

export interface ConfigValidationError {
  path: string;
  message: string;
  keyword: string;
}

export type ValidateConfigResult =
  | { ok: true }
  | { ok: false; errors: ConfigValidationError[] };

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const compileCache = new WeakMap<object, ValidateFunction>();

function compile(schema: unknown): ValidateFunction | { error: string } {
  if (typeof schema !== 'object' || schema === null) {
    return { error: 'config_schema must be an object' };
  }

  const cached = compileCache.get(schema);
  if (cached) return cached;

  try {
    const fn = ajv.compile(schema);
    compileCache.set(schema, fn);
    return fn;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export function validateConfig(
  schema: unknown,
  data: unknown,
): ValidateConfigResult {
  const compiled = compile(schema);
  if ('error' in compiled) {
    return {
      ok: false,
      errors: [
        {
          path: '',
          message: `Invalid config_schema: ${compiled.error}`,
          keyword: 'schemaCompileError',
        },
      ],
    };
  }

  if (compiled(data)) return { ok: true };

  const errors: ConfigValidationError[] = (compiled.errors ?? []).map((e) => ({
    path: e.instancePath || '',
    message: e.message ?? 'invalid',
    keyword: e.keyword,
  }));

  return { ok: false, errors };
}

export function parseConfigOrThrow(
  schema: unknown,
  data: unknown,
  context: string,
): void {
  const result = validateConfig(schema, data);
  if (result.ok) return;
  throw ApiError.validation(
    'Activity config_data does not match the activity type schema',
    { context, errors: result.errors },
  );
}
