import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assignActivity } from '@/features/activities';
import { TeacherActivityComposer } from '../TeacherActivityComposer';

vi.mock('@/features/activities', () => ({
  assignActivity: vi.fn(),
}));

const CLASS_ID = '22222222-2222-4222-8222-222222222222';
const classes = [{ id: CLASS_ID, name: 'Clasa I' }];

const assignActivityMock = vi.mocked(assignActivity);
const renderComposer = (classList = classes) =>
  render(
    <MantineProvider>
      <TeacherActivityComposer classes={classList} />
    </MantineProvider>,
  );

beforeEach(() => {
  assignActivityMock.mockReset();
  assignActivityMock.mockResolvedValue({
    success: true,
    data: { instanceIds: ['instance-1', 'instance-2'] },
  });
});

describe('TeacherActivityComposer', () => {
  it('sends drawing activities with student-facing instructions', async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.type(
      screen.getByLabelText(/instrucțiuni pentru elevi/i),
      'Desenează animalul preferat.',
    );
    await user.click(screen.getByRole('button', { name: /trimite activitatea/i }));

    await waitFor(() => {
      expect(assignActivityMock).toHaveBeenCalledWith({
        activityTypeId: 'drawing-canvas',
        config: { mode: 'guided', prompt: 'Desenează animalul preferat.' },
        classId: CLASS_ID,
      });
    });
    expect(screen.getByRole('status')).toHaveTextContent(/inbox activități/i);
  });

  it('sends voice activities with the voice prompt mapping', async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.click(screen.getByRole('radio', { name: /înregistrare vocală/i }));
    await user.type(
      screen.getByLabelText(/instrucțiuni pentru elevi/i),
      'Spune o propoziție despre primăvară.',
    );
    await user.click(screen.getByRole('button', { name: /trimite activitatea/i }));

    await waitFor(() => {
      expect(assignActivityMock).toHaveBeenCalledWith({
        activityTypeId: 'voice-recording',
        config: { promptText: 'Spune o propoziție despre primăvară.' },
        classId: CLASS_ID,
      });
    });
  });

  it('blocks blank instructions before calling the server action', async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.click(screen.getByRole('button', { name: /trimite activitatea/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/scrie instrucțiunile/i);
    expect(assignActivityMock).not.toHaveBeenCalled();
  });

  it('shows the server action error without replacing the form with success copy', async () => {
    const user = userEvent.setup();
    assignActivityMock.mockResolvedValueOnce({
      success: false,
      error: 'Nu ai permisiune să trimiți această activitate.',
    });
    renderComposer();

    await user.type(
      screen.getByLabelText(/instrucțiuni pentru elevi/i),
      'Desenează casa preferată.',
    );
    await user.click(screen.getByRole('button', { name: /trimite activitatea/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/nu ai permisiune/i);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps submit disabled and points teachers to class creation when no classes exist', async () => {
    const user = userEvent.setup();
    renderComposer([]);

    expect(screen.getByRole('button', { name: /clasă/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /trimite activitatea/i })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/nu ai clase active/i);
    expect(screen.getByRole('link', { name: /creează clasă/i })).toHaveAttribute(
      'href',
      '/teacher/classes/new',
    );

    await user.click(screen.getByRole('button', { name: /trimite activitatea/i }));

    expect(assignActivityMock).not.toHaveBeenCalled();
  });

  it('uses the shared Mantine Combobox select instead of the native browser control', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/teacher-dashboard/components/TeacherActivityComposer.tsx'),
      'utf8',
    );
    const nativeSelectImport = ['Native', 'Select'].join('');
    const selectTag = `<${'select'}`;

    renderComposer();

    expect(screen.getByRole('button', { name: /clasă/i })).toHaveClass('mantine-InputBase-input');
    expect(source).toContain('FilterSelect');
    expect(source).not.toContain(nativeSelectImport);
    expect(source).not.toContain(selectTag);
  });
});
