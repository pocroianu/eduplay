import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DuoTooltip } from './DuoTooltip';

describe('DuoTooltip', () => {
  it('uses soft tooltip chrome instead of black ink framing', async () => {
    render(
      <DuoTooltip content="Ajutor rapid" delay={0}>
        <button type="button">Deschide ajutor</button>
      </DuoTooltip>,
    );

    fireEvent.focus(screen.getByRole('button', { name: 'Deschide ajutor' }));

    const tooltip = await waitFor(() => screen.getByRole('tooltip'));
    expect(tooltip).toHaveClass('bg-surface-container-lowest');
    expect(tooltip).toHaveClass('shadow-popover');
    expect(tooltip).not.toHaveClass('border-ink');
    expect(tooltip).not.toHaveStyle({ boxShadow: 'var(--shadow-chunk-sm)' });
  });
});
