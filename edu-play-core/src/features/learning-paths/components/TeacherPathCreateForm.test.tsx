import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPath } from '../actions/create-path';
import { TeacherPathCreateForm } from './TeacherPathCreateForm';

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock('../actions/create-path', () => ({
  createPath: vi.fn(),
}));

function renderForm(initialError?: string) {
  return render(
    <MantineProvider>
      <TeacherPathCreateForm initialError={initialError} />
    </MantineProvider>,
  );
}

const createdPath = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Citire ghidată',
  description: null,
  ageMin: 5,
  ageMax: 7,
  status: 'draft' as const,
  ownerKind: 'teacher' as const,
  createdBy: '22222222-2222-4222-8222-222222222222',
  createdAt: '2026-06-08T00:00:00Z',
  updatedAt: '2026-06-08T00:00:00Z',
};

describe('TeacherPathCreateForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the current server error in the Mantine alert surface', () => {
    renderForm('Nu am putut crea parcursul.');

    expect(screen.getByRole('alert')).toHaveTextContent('Nu am putut crea parcursul.');
  });

  it('validates title length before calling the server action', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/titlu/i), 'A');
    await user.click(screen.getByRole('button', { name: /creează parcurs/i }));

    expect(await screen.findByText('Titlul trebuie să aibă cel puțin 2 caractere')).toBeInTheDocument();
    expect(createPath).not.toHaveBeenCalled();
  });

  it('submits normalized Mantine Form values and redirects to the created path', async () => {
    const user = userEvent.setup();
    vi.mocked(createPath).mockResolvedValue({
      success: true,
      data: { path: createdPath },
    });

    renderForm();

    await user.type(screen.getByLabelText(/titlu/i), 'Citire ghidată');
    await user.type(screen.getByLabelText(/descriere/i), 'Primele activități pentru grupă');
    await user.type(screen.getByLabelText(/vârstă minimă/i), '5');
    await user.type(screen.getByLabelText(/vârstă maximă/i), '7');
    await user.click(screen.getByRole('button', { name: /creează parcurs/i }));

    await waitFor(() => {
      expect(createPath).toHaveBeenCalledWith({
        title: 'Citire ghidată',
        description: 'Primele activități pentru grupă',
        ageMin: 5,
        ageMax: 7,
      });
    });
    expect(pushMock).toHaveBeenCalledWith(`/teacher/paths/${createdPath.id}`);
    expect(refreshMock).toHaveBeenCalled();
  });
});
