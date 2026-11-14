import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Numpad } from './Numpad';

describe('Numpad', () => {
  it('renders labelled keys for digits 0-9, backspace, and submit', () => {
    render(
      <Numpad onDigit={() => {}} onBackspace={() => {}} onSubmit={() => {}} />,
    );

    for (let i = 0; i <= 9; i++) {
      expect(screen.getByRole('button', { name: `Cifra ${i}` })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: /șterge/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /trimite pin-ul/i })).toBeInTheDocument();
  });

  it('calls onDigit with the pressed digit', () => {
    const onDigit = vi.fn();
    render(
      <Numpad onDigit={onDigit} onBackspace={() => {}} onSubmit={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cifra 7' }));
    expect(onDigit).toHaveBeenCalledWith(7);
  });

  it('disables submit when submitDisabled is true', () => {
    render(
      <Numpad
        onDigit={() => {}}
        onBackspace={() => {}}
        onSubmit={() => {}}
        submitDisabled
      />,
    );
    expect(screen.getByRole('button', { name: /trimite pin-ul/i })).toBeDisabled();
  });

  it('renders every compact key when entrance animation is disabled', () => {
    render(
      <Numpad
        onDigit={() => {}}
        onBackspace={() => {}}
        onSubmit={() => {}}
        density="compact"
        animated={false}
      />,
    );

    expect(screen.getAllByRole('button')).toHaveLength(12);
    expect(screen.getByRole('button', { name: 'Cifra 9' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cifra 0' })).toBeInTheDocument();
  });
});
