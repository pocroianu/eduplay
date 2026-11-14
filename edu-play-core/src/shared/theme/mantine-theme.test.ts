import { rem } from '@mantine/core';
import { describe, expect, it } from 'vitest';
import { eduPlayMantineTheme } from './mantine-theme';

describe('eduPlayMantineTheme', () => {
  it('uses live Seesaw purple as the primary Mantine shade', () => {
    const purple = eduPlayMantineTheme.colors?.purple;

    expect(eduPlayMantineTheme.primaryColor).toBe('purple');
    expect(eduPlayMantineTheme.primaryShade).toBe(6);
    expect(purple?.[6]).toBe('#5F2FA8');
  });

  it('keeps Mantine core controls at the 44px standard target floor', () => {
    const buttonStyles = eduPlayMantineTheme.components?.Button?.styles as
      | { root?: Record<string, unknown> }
      | undefined;
    const actionIconStyles = eduPlayMantineTheme.components?.ActionIcon?.styles as
      | { root?: Record<string, unknown> }
      | undefined;

    expect(buttonStyles?.root).toMatchObject({ minHeight: rem(44) });
    expect(actionIconStyles?.root).toMatchObject({
      minHeight: rem(44),
      minWidth: rem(44),
    });
  });
});
