import { MantineProvider } from '@mantine/core';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { ClassesPageContent } from './ClassesPageContent';

const profile = {
  id: 'teacher-1',
  full_name: 'Ana Popescu',
  email: 'ana@example.test',
  role: 'teacher',
};

const classes = [
  {
    id: 'class-1',
    name: 'Clasa I A',
    description: 'Citire și matematică',
    grade_level: 'grade-1',
    school_year: '2025-2026',
    is_active: true,
  },
  {
    id: 'class-2',
    name: 'Clasa arhivată',
    description: null,
    grade_level: 'grade-2',
    school_year: '2024-2025',
    is_active: false,
  },
];

it('uses pressed filter chips for class status filters', async () => {
  const user = userEvent.setup();

  render(
    <MantineProvider>
    <ClassesPageContent
      profile={profile}
      classes={classes}
      countByClass={{ 'class-1': 3, 'class-2': 1 }}
    />
    </MantineProvider>,
  );

  const group = screen.getByRole('group', { name: /filtrează clasele/i });
  expect(within(group).getByRole('button', { name: /toate/i })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.queryByRole('tablist', { name: /filtrează clasele/i })).not.toBeInTheDocument();

  await user.click(within(group).getByRole('button', { name: /arhivate/i }));

  expect(within(group).getByRole('button', { name: /arhivate/i })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.getByText('Clasa arhivată')).toBeInTheDocument();
  expect(screen.queryByText('Clasa I A')).not.toBeInTheDocument();
});
