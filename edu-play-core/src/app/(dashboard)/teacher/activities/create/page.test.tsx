import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCreateActivityWizardData } from '@/features/teacher-activities/server';

const redirectError = (path: string) => {
  const err = new Error(`NEXT_REDIRECT:${path}`);
  (err as Error & { __redirect__: string }).__redirect__ = path;
  return err;
};

const redirectMock = vi.fn((path: string) => {
  throw redirectError(path);
});

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}));

vi.mock('@/features/teacher-activities/server', () => ({
  getCreateActivityWizardData: vi.fn(),
}));

const getCreateActivityWizardDataMock = vi.mocked(getCreateActivityWizardData);

import CreateActivityPage from './page';

beforeEach(() => {
  redirectMock.mockClear();
  getCreateActivityWizardDataMock.mockReset();
});

describe('/teacher/activities/create page', () => {
  it('renders the Seesaw workspace with the preserved authoring controls', async () => {
    getCreateActivityWizardDataMock.mockResolvedValue({
      interactiveTypes: [
        {
          typeId: 'listen-tap',
          displayName: 'Ascultă și apasă',
          category: 'literacy',
          rendererKey: 'listen-tap',
          rendererKind: 'iframe',
          authoringMode: 'teacher-simple',
        },
      ],
    });

    const ui = await CreateActivityPage();
    render(ui);

    expect(screen.getByRole('heading', { level: 1, name: /creează activitate/i })).toBeInTheDocument();
    const sourceGroup = screen.getByRole('group', { name: /sursa activității/i });
    expect(sourceGroup).toBeInTheDocument();
    expect(within(sourceGroup).getByRole('button', { name: /încarcă/i })).toBeInTheDocument();
    expect(within(sourceGroup).getByRole('button', { name: /link/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /șablon răspuns elev/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /previzualizare elev/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/titlu activitate/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/instrucțiuni pentru elevi/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /text/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /desen/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /voce/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /familiei după aprobare/i })).not.toBeChecked();
    expect(screen.getByRole('button', { name: /salvează ciorna/i })).toBeInTheDocument();

    expect(screen.queryByRole('combobox', { name: /clasă/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /trimite activitatea/i })).not.toBeInTheDocument();
  });

  it('redirects unauthenticated or non-teacher visitors to login', async () => {
    getCreateActivityWizardDataMock.mockResolvedValue(null);

    await expect(CreateActivityPage()).rejects.toMatchObject({ __redirect__: '/login' });
  });
});
