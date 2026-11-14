import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DuoCard } from './DuoCard';

describe('DuoCard', () => {
  it('renders children in the plain variant by default', () => {
    render(<DuoCard>Hello card</DuoCard>);

    const el = screen.getByText('Hello card').closest('div')!;
    expect(el).toHaveClass('bg-surface-container-lowest');
    expect(el).toHaveClass('rounded-lg');
    expect(el).toHaveClass('shadow-soft-sm');
    expect(el).not.toHaveClass('border-2');
  });

  it('supports the explicit plain variant', () => {
    render(<DuoCard variant="plain">Plain card</DuoCard>);

    const el = screen.getByText('Plain card').closest('div')!;
    expect(el).toHaveClass('bg-surface-container-lowest');
    expect(el).toHaveClass('rounded-lg');
    expect(el).toHaveClass('shadow-soft-sm');
  });

  it('applies raised feature-card chrome without black ink framing', () => {
    render(<DuoCard variant="chunky">Chunky</DuoCard>);

    const el = screen.getByText('Chunky').closest('div')!;
    expect(el).toHaveClass('rounded-xl');
    expect(el).toHaveClass('shadow-soft');
    expect(el).not.toHaveClass('border-ink');
    expect(el).not.toHaveClass('shadow-chunk-lg');
  });

  it('renders hero variant with solid accent background style', () => {
    render(
      <DuoCard variant="hero" tone="coral">
        Hero
      </DuoCard>,
    );
    const el = screen.getByText('Hero').closest('div')!;
    expect(el.style.background).toBe('var(--color-coral)');
    expect(el).not.toHaveClass('border-ink');
    expect(el).toHaveStyle({ boxShadow: 'var(--shadow-soft)' });
  });

  it('hero variant defaults to green journal tone', () => {
    render(<DuoCard variant="hero">Green hero</DuoCard>);
    const el = screen.getByText('Green hero').closest('div')!;
    expect(el.style.background).toBe('var(--color-success-journal)');
  });

  it('hero variant supports pink tone', () => {
    render(
      <DuoCard variant="hero" tone="pink">
        Pink hero
      </DuoCard>,
    );
    const el = screen.getByText('Pink hero').closest('div')!;
    expect(el.style.background).toBe('var(--color-pink)');
  });

  it('renders inset variant with quiet panel surface', () => {
    render(<DuoCard variant="inset">Inset</DuoCard>);

    const el = screen.getByText('Inset').closest('div')!;
    expect(el).toHaveClass('bg-surface-container');
    expect(el).toHaveClass('rounded-lg');
    expect(el.style.boxShadow).toBe('var(--shadow-inner-soft)');
  });

  it('plain variant accepts a tone for soft accent wash', () => {
    render(<DuoCard tone="blue">Toned</DuoCard>);

    const el = screen.getByText('Toned').closest('div')!;
    expect(el.style.backgroundColor).toBe('var(--color-blue-wash)');
    expect(el.style.borderLeft).toBe('');
  });

  it('treats neutral tone as no-tone', () => {
    render(<DuoCard tone="neutral">Neutral</DuoCard>);

    const el = screen.getByText('Neutral').closest('div')!;
    expect(el.style.backgroundColor).toBe('');
    expect(el.style.borderLeft).toBe('');
  });

  it.each(['plain', 'chunky', 'hero', 'inset'] as const)(
    'composes boolean interactive with the %s variant',
    (variant) => {
      render(
        <DuoCard variant={variant} interactive>
          {variant} interactive
        </DuoCard>,
      );

      const el = screen.getByText(`${variant} interactive`);
      expect(el).toHaveClass('cursor-pointer');
      expect(el).not.toHaveClass('hover:-translate-y-0.5');
      expect(el).not.toHaveClass('transition-all');
    },
  );

  it('renders as an anchor and preserves link chrome when as="a"', () => {
    render(
      <DuoCard as="a" href="/dev/duo-kit">
        Link card
      </DuoCard>,
    );

    const el = screen.getByText('Link card').closest('a')!;
    expect(el).toHaveAttribute('href', '/dev/duo-kit');
    expect(el.style.textDecoration).toBe('none');
    expect(el.style.color).toBe('inherit');
  });

  it('chunky variant ignores tone for accent wash', () => {
    render(
      <DuoCard variant="chunky" tone="coral">
        Chunky toned
      </DuoCard>,
    );
    const el = screen.getByText('Chunky toned').closest('div')!;
    expect(el.style.backgroundColor).toBe('');
    expect(el.style.borderLeft).toBe('');
  });

  it('forwards className', () => {
    render(<DuoCard className="my-custom">Content</DuoCard>);
    const el = screen.getByText('Content').closest('div')!;
    expect(el).toHaveClass('my-custom');
  });

  it('forwards HTML attributes', () => {
    render(<DuoCard data-testid="card-el">Content</DuoCard>);
    expect(screen.getByTestId('card-el')).toBeInTheDocument();
  });

  it('forwards style prop on default variant', () => {
    render(<DuoCard style={{ margin: '8px' }}>Styled</DuoCard>);
    const el = screen.getByText('Styled').closest('div')!;
    expect(el.style.margin).toBe('8px');
  });

  it('merges style prop on hero variant', () => {
    render(
      <DuoCard variant="hero" style={{ margin: '12px' }}>
        Hero styled
      </DuoCard>,
    );
    const el = screen.getByText('Hero styled').closest('div')!;
    expect(el.style.margin).toBe('12px');
    expect(el.style.background).toBe('var(--color-success-journal)');
  });

  it('merges style prop on inset variant', () => {
    render(
      <DuoCard variant="inset" style={{ margin: '16px' }}>
        Inset styled
      </DuoCard>,
    );
    const el = screen.getByText('Inset styled').closest('div')!;
    expect(el.style.margin).toBe('16px');
    expect(el.style.boxShadow).toBe('var(--shadow-inner-soft)');
  });
});
