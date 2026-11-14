type ClassValue = string | null | false | undefined | ClassValue[];

/**
 * Join className values conditionally, flattening nested arrays and dropping
 * falsy entries. Intentionally tiny — we don't pull in `clsx`/`tailwind-merge`
 * because the UI kit uses variant functions that already produce clean
 * single-source class strings.
 */
export function cn(...values: ClassValue[]): string {
  const parts: string[] = [];
  const walk = (value: ClassValue): void => {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const v of value) walk(v);
      return;
    }
    if (typeof value === 'string') {
      const str = value.trim();
      if (str) parts.push(str);
    }
  };
  for (const v of values) walk(v);
  return parts.join(' ');
}
