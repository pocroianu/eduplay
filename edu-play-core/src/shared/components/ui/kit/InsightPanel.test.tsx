import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InsightPanel } from './InsightPanel';
import { Button } from './Button';

describe('InsightPanel', () => {
  it('renders eyebrow, title, description, and icon', () => {
    const { container } = render(
      <InsightPanel
        icon="Warning"
        title="Atentie necesara"
        description="Trei elevi nu au finalizat tema saptamanii."
      />,
    );
    expect(screen.getByText('INSIGHT')).toBeInTheDocument();
    expect(screen.getByText('Atentie necesara')).toBeInTheDocument();
    expect(screen.getByText('Trei elevi nu au finalizat tema saptamanii.')).toBeInTheDocument();
    // Icon is rendered via the Phosphor shim (EDU-123) — assert on the SVG.
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders a custom eyebrow when provided', () => {
    render(<InsightPanel icon="Info" title="Ceva nou" eyebrow="NOTIFICARE" />);
    expect(screen.getByText('NOTIFICARE')).toBeInTheDocument();
  });

  it('renders the action slot (typically a kit Button)', () => {
    render(
      <InsightPanel
        icon="Warning"
        title="Verifica acum"
        action={
          <Button size="lg" fullWidth>
            Vezi detalii
          </Button>
        }
      />,
    );
    const btn = screen.getByRole('button', { name: /vezi detalii/i });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain('w-full');
  });

  it('marks the icon chip aria-hidden', () => {
    const { container } = render(<InsightPanel icon="Info" title="x" />);
    const chip = container.querySelector('[aria-hidden="true"]');
    expect(chip).toBeTruthy();
    expect(chip?.className).toContain('bg-primary-container/30');
    expect(chip?.className).toContain('text-primary');
  });
});
