import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Pill } from './Pill';

describe('Pill', () => {
  it('renders children and leading slot', () => {
    render(
      <Pill leading={<span data-testid="ico">i</span>}>Info</Pill>,
    );
    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.getByTestId('ico')).toBeInTheDocument();
  });

  it('includes ink border in kid mode when outlined', () => {
    const { container } = render(
      <Pill mode="kid" tone="sky" outlined>
        Hello
      </Pill>,
    );
    const pill = container.querySelector('.mantine-Badge-root') as HTMLElement;
    expect(pill.style.border).toContain('2px');
  });

  it('omits border when outlined=false in kid mode', () => {
    const { container } = render(
      <Pill mode="kid" tone="sky" outlined={false}>
        Hello
      </Pill>,
    );
    const pill = container.querySelector('.mantine-Badge-root') as HTMLElement;
    expect(pill.style.border).toBe('');
  });
});
