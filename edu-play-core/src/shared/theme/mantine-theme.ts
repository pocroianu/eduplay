import { createTheme, rem, type MantineColorsTuple } from '@mantine/core';
import classes from './mantine-theme.module.css';

const eduPlayPurple: MantineColorsTuple = [
  // Keep this tuple aligned with the canonical EduPlay Purple direction in
  // src/app/globals.css. Mantine requires concrete palette values at theme
  // creation time, so CSS variables cannot be used for the color scale here.
  '#F7F1FF',
  '#F3EBFF',
  '#E8DDFD',
  '#D7C4FB',
  '#BFA2F8',
  '#7B4AC4',
  '#5F2FA8',
  '#4F248D',
  '#330072',
  '#24104F',
];

export const eduPlayMantineTheme = createTheme({
  autoContrast: true,
  cursorType: 'pointer',
  defaultRadius: 'md',
  focusRing: 'auto',
  fontFamily: 'var(--font-body)',
  fontFamilyMonospace: 'var(--font-mono)',
  headings: {
    fontFamily: 'var(--font-display)',
    fontWeight: '800',
  },
  primaryColor: 'purple',
  primaryShade: 6,
  respectReducedMotion: true,
  colors: {
    purple: eduPlayPurple,
  },
  radius: {
    xs: 'var(--radius-sm)',
    sm: 'var(--radius-sm)',
    md: 'var(--radius-lg)',
    lg: 'var(--radius-xl)',
    xl: 'var(--radius-2xl)',
  },
  shadows: {
    xs: 'var(--shadow-soft-sm)',
    sm: 'var(--shadow-soft-sm)',
    md: 'var(--shadow-soft)',
    lg: 'var(--shadow-soft-md)',
    xl: 'var(--shadow-soft-lg)',
  },
  components: {
    CloseButton: {
      styles: { root: { minHeight: rem(44), minWidth: rem(44) } },
    },
    Button: {
      classNames: { root: classes.button },
      defaultProps: {
        radius: 'md',
      },
      styles: {
        root: {
          fontWeight: 600,
          minHeight: rem(44),
        },
      },
    },
    ActionIcon: {
      classNames: { root: classes.actionIcon },
      defaultProps: {
        radius: 'md',
      },
      styles: {
        root: {
          minHeight: rem(44),
          minWidth: rem(44),
        },
      },
    },
    Card: {
      defaultProps: {
        radius: 'md',
        shadow: 'sm',
        withBorder: true,
      },
      styles: {
        root: {
          backgroundColor: 'var(--color-surface-container-lowest)',
          borderColor: 'var(--color-outline-variant)',
        },
      },
    },
    Input: {
      classNames: { input: classes.input },
      defaultProps: {
        radius: 'md',
      },
    },
    InputWrapper: {
      styles: {
        label: {
          color: 'var(--color-on-surface)',
          fontWeight: 600,
        },
        error: {
          color: 'var(--color-error)',
        },
      },
    },
    Paper: {
      defaultProps: {
        radius: 'md',
        shadow: 'sm',
      },
    },
  },
});
