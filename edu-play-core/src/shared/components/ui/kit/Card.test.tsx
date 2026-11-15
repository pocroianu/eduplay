import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';
import { Card, CardHeader, CardBody } from './Card';

function renderWithMantine(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe('Card', () => {
  it('renders children with standard defaults', () => {
    renderWithMantine(
      <Card>
        <p>Body</p>
      </Card>,
    );
    expect(screen.getByText('Body')).toBeInTheDocument();
  });
  it('uses EduPlay standard card chrome without scale-hover behavior', () => {
    renderWithMantine(<Card>Standard card</Card>);
    const card = screen.getByText('Standard card').closest('div') as HTMLElement;
    expect(card).toHaveClass('mantine-Card-root');
    expect(card.style.getPropertyValue('--kit-card-bg')).toBe(
      'var(--color-surface-container-lowest)',
    );
    expect(card.style.boxShadow).toBe('var(--shadow-soft-sm)');
    expect(card.className).not.toMatch(/hover:scale-|group-hover:scale-/);
  });

  it('composes CardHeader and CardBody', () => {
    renderWithMantine(
      <Card>
        <CardHeader>
          <h3>Title</h3>
        </CardHeader>
        <CardBody>
          <p>Content</p>
        </CardBody>
      </Card>,
    );
    expect(screen.getByRole('heading', { name: /title/i })).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders kid mode with EduPlay card chrome instead of depth shadows', () => {
    renderWithMantine(
      <Card mode="kid" tone="lime" depth={6}>
        Kid card
      </Card>,
    );
    const card = screen.getByText('Kid card').closest('div') as HTMLElement;
    expect(card).toHaveClass('mantine-Card-root');
    expect(card.style.borderRadius).toBe('8px');
    expect(card.style.boxShadow).toBe('var(--shadow-soft-sm)');
  });

  it('uses thin tonal kid-mode chrome instead of chunky borders', () => {
    renderWithMantine(
      <Card mode="kid" tone="sky" depth={6}>
        Kid card
      </Card>,
    );

    const card = screen.getByText('Kid card').closest('div') as HTMLElement;
    expect(card.style.border).toBe('1px solid var(--color-blue-dim)');
    expect(card.style.boxShadow).toBe('var(--shadow-soft-sm)');
    expect(card.style.border).not.toContain('var(--color-on-surface)');
  });
});
