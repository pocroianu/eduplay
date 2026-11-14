import { createTheme, rem, type MantineColorsTuple } from '@mantine/core';

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

const interactiveFocusStyles = {
  '&:focus-visible': {
    outline: '2px solid var(--color-primary)',
    outlineOffset: 2,
  },
} as const;

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
    Button: {
      defaultProps: {
        radius: 'md',
      },
      styles: {
        root: {
          fontWeight: 600,
          minHeight: rem(44),
          ...interactiveFocusStyles,
          '&:where(:not([data-disabled])):hover': {
            backgroundColor: 'var(--color-purple-deep)',
          },
          '&:where(:not([data-disabled])):active': {
            backgroundColor: 'var(--color-purple-deep)',
            transform: 'translateY(1px)',
          },
        },
      },
    },
    ActionIcon: {
      defaultProps: {
        radius: 'md',
      },
      styles: {
        root: {
          minHeight: rem(44),
          minWidth: rem(44),
          ...interactiveFocusStyles,
          '&:where(:not([data-disabled])):hover': {
            backgroundColor: 'var(--color-purple-soft)',
            color: 'var(--color-purple-deep)',
          },
          '&:where(:not([data-disabled])):active': {
            backgroundColor: 'var(--color-purple-soft)',
            color: 'var(--color-purple-deep)',
            transform: 'translateY(1px)',
          },
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
      defaultProps: {
        radius: 'md',
      },
      styles: {
        input: {
          '&:focus, &:focus-within': {
            borderColor: 'var(--color-primary)',
            boxShadow: '0 0 0 2px var(--color-purple-soft)',
          },
        },
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
