import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SectionHeader } from './SectionHeader';

describe('SectionHeader', () => {
  it('renders title as h2', () => {
    render(<SectionHeader title="Hello world" />);
    const h = screen.getByRole('heading', { level: 2, name: /hello world/i });
    expect(h).toBeInTheDocument();
  });

  it('renders eyebrow and subtitle when provided', () => {
    render(
      <SectionHeader
        eyebrow="Part 2"
        title="Learning is fun"
        subtitle="Hands-on Romanian-language games."
      />,
    );
    expect(screen.getByText('Part 2')).toBeInTheDocument();
    expect(screen.getByText(/hands-on romanian-language games/i)).toBeInTheDocument();
  });

  it('centers content when align=center', () => {
    const { container } = render(<SectionHeader align="center" title="C" />);
    const titleBlock = container.querySelector('.flex.flex-col');
    expect(titleBlock).toHaveClass('items-center');
  });

  it('renders children (secondary action slot)', () => {
    render(
      <SectionHeader title="T">
        <button type="button">Go</button>
      </SectionHeader>,
    );
    expect(screen.getByRole('button', { name: /go/i })).toBeInTheDocument();
  });

  it('renders an icon chip when the icon prop is provided', () => {
    const { container } = render(
      <SectionHeader title="Misiunile Zilei" icon="ClipboardText" />,
    );
    const chip = container.querySelector('[aria-hidden="true"]');
    expect(chip).toBeInTheDocument();
    expect(chip?.className).toContain('bg-primary-soft');
  });

  it('applies the iconTone color pair', () => {
    const { container } = render(
      <SectionHeader title="Badges" icon="Sparkle" iconTone="tertiary" />,
    );
    const chip = container.querySelector('[aria-hidden="true"]');
    expect(chip?.className).toContain('bg-primary-soft');
    expect(chip?.className).toContain('text-primary-deep');
  });

  it('renders the action slot for a "Vezi tot"-style link', () => {
    render(
      <SectionHeader
        title="Jocuri Recente"
        action={
          <a href="/student/games" data-testid="see-all">
            Vezi tot
          </a>
        }
      />,
    );
    expect(screen.getByTestId('see-all')).toBeInTheDocument();
  });
});
