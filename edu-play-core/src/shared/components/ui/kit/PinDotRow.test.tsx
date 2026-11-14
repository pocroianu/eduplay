import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PinDotRow } from './PinDotRow';

describe('PinDotRow', () => {
  it('announces progress for screen readers', () => {
    render(<PinDotRow filled={2} length={4} />);
    expect(screen.getByText('PIN: 2 din 4 cifre')).toBeInTheDocument();
  });

  it('supports a custom prefix', () => {
    render(<PinDotRow filled={1} length={6} ariaLabelPrefix="Cod" />);
    expect(screen.getByText('Cod: 1 din 6 cifre')).toBeInTheDocument();
  });
});
