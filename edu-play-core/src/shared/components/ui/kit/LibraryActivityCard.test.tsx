import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MantineProvider } from '@mantine/core';
import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { LibraryActivityCard } from './LibraryActivityCard';

function renderWithMantine(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

const cardCss = () =>
  readFileSync(join(process.cwd(), 'src/shared/components/ui/kit/LibraryActivityCard.module.css'), 'utf8');


describe('LibraryActivityCard', () => {
  it('renders a Mantine activity card with a separate action link', () => {
    renderWithMantine(
      <LibraryActivityCard
        href="/teacher/library/activity-1"
        title="Sunetul inițial"
        creator="Biblioteca EduPlay"
        meta="Română"
        actionHref="/teacher/assignments/new?activityId=activity-1"
        actionLabel="Atribuie"
        thumbnailTone="green"
      />,
    );

    const card = screen.getByRole('article', { name: /sunetul inițial/i });
    expect(within(card).getByRole('link', { name: /sunetul inițial/i })).toHaveAttribute(
      'href',
      '/teacher/library/activity-1',
    );
    expect(card).toHaveClass('mantine-Card-root');
    expect(card).toHaveClass('teacher-library-interactive');
    expect(within(card).getByText('Biblioteca EduPlay')).toBeInTheDocument();
    expect(within(card).getByText('Română')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Atribuie' })).toHaveClass('mantine-Button-root');
    expect(within(card).getByRole('link', { name: 'Atribuie' })).toHaveAttribute(
      'href',
      '/teacher/assignments/new?activityId=activity-1',
    );
  });

  it('renders the create-card treatment used at the start of library rails', () => {
    renderWithMantine(
      <LibraryActivityCard
        href="/teacher/activities/create"
        title="Creează o activitate sau evaluare automată"
        variant="create"
      />,
    );

    const card = screen.getByRole('article', { name: /creează o activitate/i });
    expect(within(card).getByRole('link', { name: /creează o activitate/i })).toHaveAttribute(
      'href',
      '/teacher/activities/create',
    );
    expect(card).toHaveClass('mantine-Card-root');
    expect(card).toHaveClass('teacher-library-interactive');
    expect(card.className).not.toContain('ep-library-card');
  });

  it('defines Mantine CSS-module hover feedback for card and action surfaces', () => {
    const css = cardCss();

    expect(css).toContain('.cardInteractive:hover');
    expect(css).toContain('box-shadow: var(--shadow-soft);');
    expect(css).toContain('.actionInteractive:hover');
    expect(css).toContain('filter: brightness(0.96);');
  });
});
