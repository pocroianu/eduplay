import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActivityCard } from './ActivityCard';

describe('ActivityCard', () => {
  it('renders an activity card with image capsule caption anatomy', () => {
    render(
      <ActivityCard
        href="/teacher/libraries/a1"
        title="Numărăm până la 10"
        creator="EduPlay"
        meta="Matematică"
        imageAlt="Manipulative pentru numărat"
      />,
    );

    const link = screen.getByRole('link', { name: /numărăm până la 10/i });
    expect(link).toHaveAttribute('href', '/teacher/libraries/a1');
    expect(link).toHaveClass('rounded-xl');
    expect(link).toHaveClass('bg-surface-container-lowest');
    expect(link).toHaveClass('shadow-soft-sm');
    expect(
      screen.getByRole('img', { name: /manipulative pentru numărat/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Matematică')).toHaveClass('rounded-pill');
  });

  it('uses supplied image content without adding duplicate image semantics', () => {
    render(
      <ActivityCard
        href="/teacher/libraries/a2"
        title="Citire expresivă"
        creator="Biblioteca clasei"
        meta="Limba română"
        imageAlt="Copii citind"
        image={<img alt="Copii citind în cerc" src="/activity.png" />}
      />,
    );

    expect(
      screen.getByRole('img', { name: /copii citind în cerc/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: /^copii citind$/i }),
    ).not.toBeInTheDocument();
  });
});
