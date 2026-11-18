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

  it('makes plain-text triggers keyboard focusable and shows the tooltip on focus', async () => {
    render(
      <DuoTooltip content="Explicație" delay={0}>
        Termen
      </DuoTooltip>,
    );

    const trigger = screen.getByText('Termen');
    expect(trigger).toHaveAttribute('tabindex', '0');

    fireEvent.focus(trigger);
    expect(await waitFor(() => screen.getByRole('tooltip'))).toHaveTextContent('Explicație');
  });
});
