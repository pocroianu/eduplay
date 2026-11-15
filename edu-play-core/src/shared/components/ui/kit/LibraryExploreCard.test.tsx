import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LibraryExploreCard } from './LibraryExploreCard';

describe('LibraryExploreCard', () => {
  it('renders an EduPlay collection card with motion-ready interactivity', () => {
    render(
      <LibraryExploreCard
        href="/teacher/libraries/explore?collection=summer"
        title="Învățare de vară"
        meta="48 de lecții"
        variant="collection"
        tone="gold"
      />,
    );

    const article = screen.getByRole('article', { name: /învățare de vară/i });
    const link = within(article).getByRole('link', { name: /învățare de vară/i });
    expect(link).toHaveAttribute('href', '/teacher/libraries/explore?collection=summer');
    expect(link).toHaveClass('seesaw-explore-card__main');
    expect(article).toHaveClass('seesaw-explore-card--collection');
    expect(within(article).getByText('48 de lecții')).toBeInTheDocument();
  });

  it('renders an activity card with a separate animated action button', () => {
    render(
      <LibraryExploreCard
        href="/play/activity/game-1"
        title="Exersează sunetul M"
        creator="Biblioteca EduPlay"
        meta="Clasa I"
        actionLabel="Atribuie"
        onAction={() => undefined}
      />,
    );

    const article = screen.getByRole('article', { name: /exersează sunetul m/i });
    expect(within(article).getByRole('link', { name: /exersează sunetul m/i })).toHaveAttribute(
      'href',
      '/play/activity/game-1',
    );
    const action = within(article).getByRole('button', { name: 'Atribuie' });
    expect(action).toHaveClass('seesaw-explore-card__action');
    expect(action).toHaveClass('seesaw-interactive');
  });
});
