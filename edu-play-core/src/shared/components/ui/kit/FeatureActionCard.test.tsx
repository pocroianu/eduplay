import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FeatureActionCard } from './FeatureActionCard';

describe('FeatureActionCard', () => {
  it('renders an EduPlay feature action card without scale-hover behavior', () => {
    render(
      <FeatureActionCard
        href="/teacher/journal/new"
        icon="BookOpen"
        title="Postează în jurnal"
        subtitle="Portofoliu cu fotografii și video"
        tone="journal"
      />,
    );

    const link = screen.getByRole('link', { name: /postează în jurnal/i });
    expect(link).toHaveAttribute('href', '/teacher/journal/new');
    expect(link).toHaveClass('rounded-xl');
    expect(link).toHaveClass('shadow-soft-sm');
    expect(link).toHaveClass('hover:shadow-soft-md');
    expect(link.className).not.toMatch(/scale-/);
  });

  it('uses surface styling for message tone', () => {
    render(
      <FeatureActionCard
        href="/teacher/classes/class-1/families"
        icon="HandHeart"
        title="Invită familii"
        subtitle="Conectează adulții de acasă"
        tone="message"
      />,
    );

    const link = screen.getByRole('link', { name: /invită familii/i });
    expect(link).toHaveAttribute('href', '/teacher/classes/class-1/families');
    expect(link).toHaveClass('bg-surface-container-lowest');
    expect(link).toHaveClass('text-on-surface');
  });
});
