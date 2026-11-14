import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { eduPlayMantineTheme } from '@/shared/theme';
import { LearningMap, type LearningStage } from './LearningMap';

vi.mock('framer-motion', async () => {
  const React = await import('react');
  const passthrough = ({ children, ...props }: React.HTMLAttributes<HTMLElement>) =>
    React.createElement('div', props, children);
  return {
    motion: new Proxy(
      {},
      {
        get: (_target, property) =>
          property === 'create' ? (Component: React.ElementType) => Component : passthrough,
      },
    ),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useReducedMotion: () => true,
  };
});

vi.mock('@/shared/components/layout/TopAppBar', () => ({
  TopAppBar: ({
    children,
    tabs = [],
  }: {
    children: React.ReactNode;
    tabs?: Array<{ label: string }>;
  }) => (
    <div>
      <nav>
        {tabs.map((tab) => (
          <span key={tab.label}>{tab.label}</span>
        ))}
      </nav>
      {children}
    </div>
  ),
}));

vi.mock('@/shared/components/layout/BottomNavBar', () => ({
  BottomNavBar: ({ items = [] }: { items?: Array<{ label: string }> }) => (
    <nav aria-label="Navigare rapidă">
      {items.map((item) => (
        <span key={item.label}>{item.label}</span>
      ))}
    </nav>
  ),
}));

const stages: LearningStage[] = [
  {
    id: 'step-1',
    name: 'Numărăm până la 10',
    status: 'current',
    icon: 'Calculator',
    stageNumber: 1,
    lessons: [
      {
        id: 'step-1',
        title: 'Numărăm până la 10',
        description: 'Joacă primul pas',
        href: '/play/activity-1',
      },
    ],
  },
];

function renderWithMantine(element: ReactElement) {
  return render(
    <MantineProvider theme={eduPlayMantineTheme}>
      {element}
    </MantineProvider>,
  );
}

describe('LearningMap', () => {
  it('renders kid-facing Romanian copy with diacritics and descriptive launch names', () => {
    renderWithMantine(
      <LearningMap
        profile={{ full_name: 'Ana Elev', totalStars: 12 }}
        stages={stages}
        overallProgress={40}
        nextLesson={{
          id: 'step-1',
          title: 'Numărăm până la 10',
          description: 'Joacă primul pas',
          href: '/play/activity-1',
        }}
      />,
    );

    expect(screen.getAllByText('Acasă').length).toBeGreaterThan(0);
    expect(screen.getByTestId('learning-map-shell')).toHaveClass('min-h-screen', 'flex-col');
    expect(screen.getByRole('navigation', { name: /navigare rapidă/i })).toBeInTheDocument();
    expect(screen.getByText('Continuă expediția ta!')).toBeInTheDocument();
    expect(screen.getByText('Progres general')).toBeInTheDocument();
    expect(screen.getByText('Ești aici!')).toBeInTheDocument();
    expect(screen.getByText('Următoarea lecție')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /începe jocul/i }),
    ).toHaveAttribute('href', '/play/activity-1');
    expect(
      screen.getByRole('link', {
        name: /etapa curentă: numărăm până la 10/i,
      }),
    ).toHaveAttribute('href', '/play/activity-1');
  });

  it('uses the step launcher href for the next lesson call to action', () => {
    renderWithMantine(
      <LearningMap
        profile={{ full_name: 'Ana Elev' }}
        stages={stages}
        nextLesson={{
          id: 'step-1',
          title: 'Numărăm până la 10',
          description: 'Joacă primul pas',
          href: '/play/activity-1',
        }}
      />,
    );

    expect(screen.getByRole('link', { name: /începe jocul/i })).toHaveAttribute(
      'href',
      '/play/activity-1',
    );
  });

  it('uses the step launcher href for the current stage node', () => {
    renderWithMantine(
      <LearningMap
        profile={{ full_name: 'Ana Elev' }}
        stages={stages}
      />,
    );

    expect(screen.getByRole('link', { name: /etapa curentă/i })).toHaveAttribute(
      'href',
      '/play/activity-1',
    );
  });

  it('hides current-stage launch links when the lesson has no href', () => {
    renderWithMantine(
      <LearningMap
        profile={{ full_name: 'Ana Elev' }}
        stages={[
          {
            id: 'step-1',
            name: 'Șablon vechi',
            status: 'current',
            icon: 'Pencil',
            stageNumber: 1,
            lessons: [{ id: 'step-1', title: 'Șablon vechi' }],
          },
        ]}
      />,
    );

    expect(screen.queryByRole('link', { name: /etapa curentă/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /începe jocul/i })).not.toBeInTheDocument();
  });

  it('renders the empty map as a quiet Seesaw card without the decorative path', () => {
    const { container } = renderWithMantine(
      <LearningMap
        profile={{ full_name: 'Ana Elev' }}
        stages={[]}
        overallProgress={0}
      />,
    );

    expect(screen.getByRole('heading', { name: /nu ai un parcurs activ încă/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /acasă/i })).toHaveStyle({ minHeight: '64px' });
    expect(container.querySelector('#mapGradient')).not.toBeInTheDocument();
  });
});
