import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TeacherLibraryContent } from './TeacherLibraryContent';

describe('TeacherLibraryContent', () => {
  function renderContent() {
    render(
      <MantineProvider>
        <TeacherLibraryContent
          recentActivities={[]}
          collectionCount={0}
          statusFilter="all"
          sortBy="newest"
          searchQuery=""
        />
      </MantineProvider>,
    );
  }

  it('renders Biblioteca mea as the page main landmark', () => {
    renderContent();

    expect(
      screen.getByRole('main', { name: /biblioteca mea/i }),
    ).toBeInTheDocument();
  });

  it('renders unavailable library filters as static Mantine badges', () => {
    renderContent();

    expect(screen.getByText('Toate clasele')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /toate clasele/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /toate subiectele/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /toate limbile/i }),
    ).not.toBeInTheDocument();
  });
});
