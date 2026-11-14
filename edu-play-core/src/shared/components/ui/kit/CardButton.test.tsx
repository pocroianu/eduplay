import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CardButton } from './CardButton';
import classes from './CardButton.module.css';

describe('CardButton', () => {
  it('renders a Mantine-backed button for clickable card layouts', () => {
    render(<CardButton aria-label="Deschide cardul">Card</CardButton>);

    const button = screen.getByRole('button', { name: 'Deschide cardul' });
    expect(button).toHaveClass('mantine-UnstyledButton-root');
    expect(button).toHaveClass(classes.root);
  });
});
