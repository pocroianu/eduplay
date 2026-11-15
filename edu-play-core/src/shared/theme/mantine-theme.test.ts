import { rem } from '@mantine/core';
import { describe, expect, it } from 'vitest';
import { eduPlayMantineTheme } from './mantine-theme';

describe('eduPlayMantineTheme', () => {
  it('keeps selectors in CSS classes rather than unsupported inline styles', () => {
    for (const name of ['Button', 'ActionIcon', 'Input']) {
      const component = eduPlayMantineTheme.components?.[name];
      expect(component?.classNames).toBeTruthy();
      const styles = component?.styles as Record<string, Record<string, unknown>> | undefined;
      for (const part of Object.values(styles ?? {})) {
        expect(Object.keys(part).some((key) => key.startsWith('&'))).toBe(false);
      }
    }
  });

  it('uses the configured EduPlay purple as the primary Mantine shade', () => {
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
