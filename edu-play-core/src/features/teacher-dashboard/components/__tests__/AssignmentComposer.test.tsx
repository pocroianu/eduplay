import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssignmentComposer } from '../AssignmentComposer';
import { createAssignment, updateAssignment } from '../../actions/assignment-actions';

const navigationMocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: navigationMocks.push,
    refresh: navigationMocks.refresh,
  }),
  useSearchParams: () => navigationMocks.searchParams,
}));

vi.mock('../../actions/assignment-actions', () => ({
  createAssignment: vi.fn(),
  updateAssignment: vi.fn(),
}));

const ACTIVITY_ID = '11111111-1111-4111-8111-111111111111';
const CLASS_ID = '22222222-2222-4222-8222-222222222222';

const createAssignmentMock = vi.mocked(createAssignment);
const updateAssignmentMock = vi.mocked(updateAssignment);

function renderComposer(element: ReactElement) {
  return render(<MantineProvider>{element}</MantineProvider>);
}

function assignmentComposer() {
  return (
    <AssignmentComposer
      profile={{ id: 'teacher-1', full_name: 'Teacher One' }}
      classes={[{ id: CLASS_ID, name: 'Clasa I' }]}
      activities={[
        {
          id: ACTIVITY_ID,
          title: 'Litere magice',
          category: 'literacy',
          thumbnail_url: null,
        },
      ]}
    />
  );
}

beforeEach(() => {
  navigationMocks.push.mockReset();
  navigationMocks.refresh.mockReset();
  navigationMocks.searchParams = new URLSearchParams();
  createAssignmentMock.mockReset();
  updateAssignmentMock.mockReset();
  createAssignmentMock.mockResolvedValue({ success: true, data: { id: 'assignment-1' } });
});

describe('AssignmentComposer', () => {
  it('renders assignment selects with Mantine Combobox-backed controls', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/teacher-dashboard/components/AssignmentComposer.tsx'),
      'utf8',
    );
    const nativeSelectImport = ['Native', 'Select'].join('');
    const selectTag = `<${'select'}`;
    const { container } = renderComposer(assignmentComposer());

    expect(container.querySelector('#activityId')?.tagName).toBe('BUTTON');
    expect(container.querySelector('#classId')?.tagName).toBe('BUTTON');
    expect(screen.getByRole('button', { name: /activity|activitate/i })).toHaveClass(
      'mantine-InputBase-input',
    );
    expect(screen.getByRole('button', { name: /class|clasă/i })).toHaveClass('mantine-InputBase-input');
    expect(source).toContain('FilterSelect');
    expect(source).toContain('MultiSelect');
    expect(source).not.toContain(nativeSelectImport);
    expect(source).not.toContain(selectTag);
  });

  it('submits the selected class assignment payload', async () => {
    const user = userEvent.setup();
    renderComposer(assignmentComposer());

    await user.click(screen.getByRole('button', { name: /activity|activitate/i }));
    await user.click(await screen.findByRole('option', { name: /litere magice/i, hidden: true }));
    await user.click(screen.getByRole('button', { name: /class|clasă/i }));
    await user.click(await screen.findByRole('option', { name: /clasa i/i, hidden: true }));
    await user.click(screen.getByRole('button', { name: /creează|create/i }));

    await waitFor(() => {
      expect(createAssignmentMock).toHaveBeenCalledWith({
        activityId: ACTIVITY_ID,
        classId: CLASS_ID,
        dueDate: undefined,
        isMandatory: false,
        studentIds: undefined,
      });
    });
    expect(navigationMocks.push).toHaveBeenCalledWith('/teacher/assignments');
  });
});
