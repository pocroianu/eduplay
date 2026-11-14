import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StudentReport } from './StudentReport';

vi.mock('framer-motion', () => ({
  motion: {
    create: (component: unknown) => component,
    div: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
    rect: ({ children, ...props }: React.ComponentProps<'rect'>) => <rect {...props}>{children}</rect>,
    section: ({ children, ...props }: React.ComponentProps<'section'>) => <section {...props}>{children}</section>,
  },
  useReducedMotion: () => true,
}));

vi.mock('recharts', () => ({
  Bar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Cell: () => <div />,
  CartesianGrid: () => <div />,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
}));

describe('StudentReport', () => {
  it('uses reduced-motion-aware press translation instead of active scaling', () => {
    const content = readFileSync(join(__dirname, 'StudentReport.tsx'), 'utf8');

    expect(content).not.toContain('active:scale');
    expect(content).toContain('motion-safe:active:translate-y-px');
  });

  it('renders report labels with Romanian diacritics', () => {
    render(
      <StudentReport
        student={{
          id: 'student-1',
          name: 'Ana Popescu',
          avatarUrl: null,
          className: 'Clasa A',
          grade: 'Pregătitoare',
        }}
        stats={{ gamesPlayed: 3, avgScore: 58, timeSpentMinutes: 75, streakDays: 2 }}
        subjectProgress={[
          { subject: 'Matematică', shortLabel: 'MAT', score: 72, color: 'primary', hoursSpent: 1.5 },
        ]}
        recentActivity={[]}
        gameHistory={[]}
        improvements={[{ title: 'Matematică', description: 'Exersează numărarea.' }]}
        skills={[{ icon: 'Trophy', label: 'Logică', level: 'Nivel 1', color: 'primary', unlocked: true }]}
        nextReward={{ label: 'Insignă', description: 'Continuă progresul.', progress: 50 }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Performanță generală' })).toBeInTheDocument();
    expect(screen.getByText('Media scorurilor în funcție de disciplină')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Atenție necesară' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Stăpânirea abilităților' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Următoarea recompensă' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /exportă \/ printează/i })).toBeInTheDocument();
  });
});
