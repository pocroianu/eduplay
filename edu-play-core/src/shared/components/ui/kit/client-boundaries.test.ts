import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const MANTINE_CLIENT_PRIMITIVES = [
  'src/shared/components/ui/kit/Card.tsx',
  'src/shared/components/ui/kit/Checkbox.tsx',
  'src/shared/components/ui/kit/TextField.tsx',
  'src/shared/components/ui/kit/TextareaField.tsx',
] as const;

describe('Mantine-backed kit client boundaries', () => {
  it('keeps migrated primitives behind explicit client directives', () => {
    const offenders = MANTINE_CLIENT_PRIMITIVES.filter((file) => {
      const content = readFileSync(join(process.cwd(), file), 'utf8');
      const firstStatement = content.trimStart().split(/\r?\n/, 1)[0];

      return firstStatement !== "'use client';";
    });

    expect(offenders).toEqual([]);
  });
});
