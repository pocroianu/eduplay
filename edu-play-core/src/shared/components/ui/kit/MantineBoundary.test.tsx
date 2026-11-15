import { MantineProvider, useMantineTheme } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MantineBoundary } from './MantineBoundary';

function ThemeProbe() {
  const theme = useMantineTheme();
  return <output>{theme.primaryColor}</output>;
}

describe('MantineBoundary', () => {
  it('uses the EduPlay theme for standalone components', () => {
    render(<MantineBoundary><ThemeProbe /></MantineBoundary>);
    expect(screen.getByRole('status')).toHaveTextContent('purple');
  });

  it('preserves an existing provider instead of overriding its theme', () => {
    render(<MantineProvider theme={{ primaryColor: 'pink' }}>
      <MantineBoundary><ThemeProbe /></MantineBoundary>
    </MantineProvider>);
    expect(screen.getByRole('status')).toHaveTextContent('pink');
  });
});
