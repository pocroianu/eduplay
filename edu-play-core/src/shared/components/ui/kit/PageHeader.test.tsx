import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renders a 72px white EduPlay page header with primary actions', () => {
    render(<PageHeader title="Bun venit" eyebrow="Panou profesor" action={<a href="/teacher/activities/create">Creează activitate</a>} />);

    const banner = screen.getByRole('banner', { name: /panou profesor/i });
    expect(banner).toHaveClass('h-[72px]');
    expect(banner).toHaveClass('bg-surface-container-lowest');
    expect(banner).toHaveClass('border-b');
    expect(banner).toHaveClass('border-outline');
    expect(screen.getByRole('heading', { name: 'Bun venit' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /creează activitate/i })).toHaveAttribute('href', '/teacher/activities/create');
  });

  it('renders optional subtitle and merges caller classes', () => {
    render(<PageHeader title="Mesaje" subtitle="Actualizări pentru familie" className="sticky top-0" />);

    const banner = screen.getByRole('banner', { name: 'Mesaje' });
    expect(banner).toHaveClass('sticky');
    expect(banner).toHaveClass('top-0');
    expect(screen.getByText('Actualizări pentru familie')).toBeInTheDocument();
  });
});
