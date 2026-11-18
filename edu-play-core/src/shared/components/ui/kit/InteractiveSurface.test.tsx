import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InteractiveSurface } from './InteractiveSurface';
import {
HOVER_HIGHLIGHT_TRIGGER_CLASS,
} from './interactionTokens';

describe('InteractiveSurface', () => {
  it('renders a link with EduPlay hover highlight and no lift transform', () => {
    render(
      <InteractiveSurface href="/teacher" aria-label="Open teacher home" className="p-4">
        <span>Teacher home</span>
      </InteractiveSurface>,
    );

    const surface = screen.getByRole('link', { name: /open teacher home/i });
    expect(surface).toHaveAttribute('href', '/teacher');
    expect(surface).toHaveClass('group');
    expect(surface).toHaveClass(HOVER_HIGHLIGHT_TRIGGER_CLASS.split(' ')[0]);
    expect(surface).toHaveClass('motion-reduce:transition-none');
    expect(surface).not.toHaveClass('motion-safe:hover:-translate-y-1');
    expect(surface.querySelector('[data-hover-highlight]')).toBeInTheDocument();
    expect(surface.lastElementChild).toHaveAttribute('data-hover-highlight');
    const highlight = surface.querySelector('[data-hover-highlight]');
    expect(highlight).toHaveClass('bg-current');
    expect(highlight).toHaveClass('motion-safe:duration-[250ms]');
    expect(highlight).toHaveClass('z-20');
    expect(highlight).toHaveClass('motion-safe:ease-[cubic-bezier(0.4,0,0.2,1)]');
    expect(highlight).toHaveStyle({ borderRadius: 'inherit' });
});
});
