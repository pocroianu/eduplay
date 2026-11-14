/**
 * Pure utility functions for converting between camelCase and snake_case,
 * including recursive key transformation for objects and arrays.
 */

/** Convert a snake_case string to camelCase. */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

/** Convert a camelCase string to snake_case. */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

/** Recursively transform all object keys from snake_case to camelCase. */
export function camelCaseKeys<T = Record<string, unknown>>(obj: unknown): T {
  return transformKeys(obj, toCamelCase) as T;
}

/** Recursively transform all object keys from camelCase to snake_case. */
export function snakeCaseKeys<T = Record<string, unknown>>(obj: unknown): T {
  return transformKeys(obj, toSnakeCase) as T;
}

function transformKeys(
  obj: unknown,
  transform: (key: string) => string,
): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (obj instanceof Date) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => transformKeys(item, transform));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      result[transform(key)] = transformKeys(
        (obj as Record<string, unknown>)[key],
        transform,
      );
    }
    return result;
  }

  return obj;
}
