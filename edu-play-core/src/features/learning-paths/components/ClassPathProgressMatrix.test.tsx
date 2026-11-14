import { MantineProvider } from '@mantine/core';
import type { ReactElement } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ClassPathProgressMatrix } from './ClassPathProgressMatrix';
import { overrideProgress } from '../actions';
import type { ClassPathProgressResult } from '../queries/get-class-path-progress';

const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

vi.mock('../actions', () => ({
  overrideProgress: vi.fn(),
}));

const overrideProgressMock = vi.mocked(overrideProgress);

function renderMatrix(element: ReactElement) {
  return render(<MantineProvider>{element}</MantineProvider>);
}

async function chooseFilterOption(
  user: ReturnType<typeof userEvent.setup>,
  root: HTMLElement,
  buttonName: RegExp,
  optionName: RegExp,
) {
  await user.click(within(root).getByRole('button', { name: buttonName }));
  await user.click(
    await within(root).findByRole('option', {
      name: optionName,
      hidden: true,
    }),
  );
}

const PATH = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Aventura fracțiilor',
  description: null,
  ageMin: null,
  ageMax: null,
  status: 'published',
  ownerKind: 'teacher',
  createdBy: '22222222-2222-4222-8222-222222222222',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
} as const;

const STEPS = [
  {
    id: 'step-1',
    pathId: PATH.id,
    stepOrder: 0,
    kind: 'activity_template',
    targetActivityType: 'drawing-canvas',
    targetActivityConfig: null,
    title: 'Numără până la 10',
    description: null,
    createdAt: '2026-05-01T00:00:00Z',
  },
  {
    id: 'step-2',
    pathId: PATH.id,
    stepOrder: 1,
    kind: 'activity_template',
    targetActivityType: 'drawing-canvas',
    targetActivityConfig: null,
    title: 'Adunări simple',
    description: null,
    createdAt: '2026-05-01T00:00:00Z',
  },
] as const;

function okResult(
  rows: Extract<ClassPathProgressResult, { ok: true }>['rows'],
): ClassPathProgressResult {
  return {
    ok: true,
    path: PATH,
    steps: [...STEPS],
    rows,
  };
}

describe('ClassPathProgressMatrix', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    overrideProgressMock.mockReset();
  });

  it('renders not-found and not-assigned states explicitly', () => {
    const { rerender } = renderMatrix(
      <ClassPathProgressMatrix
        classId="class-1"
        pathId="path-1"
        result={{ ok: false, reason: 'not_found' }}
      />,
    );

    expect(screen.getByText('Nu am găsit parcursul')).toBeInTheDocument();

    rerender(
      <MantineProvider>
        <ClassPathProgressMatrix
          classId="class-1"
          pathId="path-1"
          result={{ ok: false, reason: 'not_assigned' }}
        />
      </MantineProvider>,
    );

    expect(screen.getByText('Parcurs neatribuit clasei')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /deschide parcursul/i }),
    ).toHaveAttribute('href', '/teacher/paths/path-1');
  });

  it('distinguishes an assigned class with no students from no progress yet', () => {
    const { rerender } = renderMatrix(
      <ClassPathProgressMatrix
        classId="class-1"
        pathId={PATH.id}
        result={okResult([])}
      />,
    );

    expect(screen.getByText('Clasa nu are elevi încă')).toBeInTheDocument();

    rerender(
      <MantineProvider>
        <ClassPathProgressMatrix
          classId="class-1"
          pathId={PATH.id}
          result={okResult([
            {
              student: {
                studentId: 'student-1',
                username: 'ana',
                fullName: 'Ana Pop',
              },
              progress: null,
            },
          ])}
        />
      </MantineProvider>,
    );

    expect(screen.getByText('Nu există progres înregistrat încă')).toBeInTheDocument();
    expect(screen.getByText('Ana Pop')).toBeInTheDocument();
    expect(screen.getByText('@ana')).toBeInTheDocument();
  });

  it('renders student status, current step, last completed step, and completion date', () => {
    renderMatrix(
      <ClassPathProgressMatrix
        classId="class-1"
        pathId={PATH.id}
        result={okResult([
          {
            student: {
              studentId: 'student-1',
              username: 'ana',
              fullName: 'Ana Pop',
            },
            progress: {
              id: 'progress-1',
              studentId: 'student-1',
              pathId: PATH.id,
              currentStepId: 'step-2',
              lastCompletedStepId: 'step-1',
              status: 'completed',
              startedAt: '2026-05-01T09:00:00Z',
              completedAt: '2026-05-10T12:00:00Z',
              updatedAt: '2026-05-10T12:00:00Z',
            },
          },
        ])}
      />,
    );

    const row = screen.getByTestId('class-path-progress-row-student-1');
    expect(
      screen.getByRole('table', { name: /progresul clasei pentru aventura fracțiilor/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Elev' })).toHaveAttribute(
      'scope',
      'col',
    );
    expect(within(row).getByText('Finalizat')).toBeInTheDocument();
    expect(within(row).getByText('2. Adunări simple')).toBeInTheDocument();
    expect(within(row).getByText('1. Numără până la 10')).toBeInTheDocument();
    expect(within(row).getByText(/10 mai 2026/)).toBeInTheDocument();
  });

  it('requires explicit confirmation before marking a row completed', async () => {
    const user = userEvent.setup();
    overrideProgressMock.mockResolvedValue({
      success: true,
      data: {
        progress: {
          id: 'progress-1',
          studentId: 'student-1',
          pathId: PATH.id,
          currentStepId: null,
          lastCompletedStepId: null,
          status: 'completed',
          startedAt: '2026-05-01T09:00:00Z',
          completedAt: '2026-05-10T12:00:00Z',
          updatedAt: '2026-05-10T12:00:00Z',
        },
      },
    });

    renderMatrix(
      <ClassPathProgressMatrix
        classId="class-1"
        pathId={PATH.id}
        result={okResult([
          {
            student: {
              studentId: 'student-1',
              username: 'ana',
              fullName: 'Ana Pop',
            },
            progress: null,
          },
        ])}
      />,
    );

    const row = screen.getByTestId('class-path-progress-row-student-1');
    await user.click(within(row).getByRole('button', { name: /corectează/i }));
    await chooseFilterOption(
      user,
      row,
      /acțiune pentru ana pop/i,
      /marchează finalizat/i,
    );

    expect(
      within(row).getByRole('button', { name: /aplică modificarea/i }),
    ).toBeDisabled();

    await user.click(
      within(row).getByLabelText(/confirm că vreau să corectez manual/i),
    );
    await user.click(
      within(row).getByRole('button', { name: /aplică modificarea/i }),
    );

    await waitFor(() => expect(overrideProgressMock).toHaveBeenCalledTimes(1));
    expect(overrideProgressMock).toHaveBeenCalledWith({
      studentId: 'student-1',
      pathId: PATH.id,
      status: 'completed',
    });
    expect(await within(row).findByRole('status')).toHaveTextContent(
      /progresul a fost actualizat/i,
    );
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('reopens a row in progress at the selected path step', async () => {
    const user = userEvent.setup();
    overrideProgressMock.mockResolvedValue({
      success: true,
      data: {
        progress: {
          id: 'progress-1',
          studentId: 'student-1',
          pathId: PATH.id,
          currentStepId: 'step-2',
          lastCompletedStepId: null,
          status: 'in_progress',
          startedAt: '2026-05-01T09:00:00Z',
          completedAt: null,
          updatedAt: '2026-05-10T12:00:00Z',
        },
      },
    });

    renderMatrix(
      <ClassPathProgressMatrix
        classId="class-1"
        pathId={PATH.id}
        result={okResult([
          {
            student: {
              studentId: 'student-1',
              username: 'ana',
              fullName: 'Ana Pop',
            },
            progress: {
              id: 'progress-1',
              studentId: 'student-1',
              pathId: PATH.id,
              currentStepId: null,
              lastCompletedStepId: 'step-2',
              status: 'completed',
              startedAt: '2026-05-01T09:00:00Z',
              completedAt: '2026-05-10T12:00:00Z',
              updatedAt: '2026-05-10T12:00:00Z',
            },
          },
        ])}
      />,
    );

    const row = screen.getByTestId('class-path-progress-row-student-1');
    await user.click(within(row).getByRole('button', { name: /corectează/i }));
    await chooseFilterOption(
      user,
      row,
      /acțiune pentru ana pop/i,
      /redeschide la pas/i,
    );
    await chooseFilterOption(
      user,
      row,
      /pas de reluare/i,
      /2\. adunări simple/i,
    );
    await user.click(
      within(row).getByLabelText(/confirm că vreau să corectez manual/i),
    );
    await user.click(
      within(row).getByRole('button', { name: /aplică modificarea/i }),
    );

    await waitFor(() => expect(overrideProgressMock).toHaveBeenCalledTimes(1));
    expect(overrideProgressMock).toHaveBeenCalledWith({
      studentId: 'student-1',
      pathId: PATH.id,
      status: 'in_progress',
      currentStepId: 'step-2',
    });
  });

  it('marks a row as manually overridden', async () => {
    const user = userEvent.setup();
    overrideProgressMock.mockResolvedValue({
      success: true,
      data: {
        progress: {
          id: 'progress-1',
          studentId: 'student-1',
          pathId: PATH.id,
          currentStepId: null,
          lastCompletedStepId: null,
          status: 'overridden',
          startedAt: '2026-05-01T09:00:00Z',
          completedAt: null,
          updatedAt: '2026-05-10T12:00:00Z',
        },
      },
    });

    renderMatrix(
      <ClassPathProgressMatrix
        classId="class-1"
        pathId={PATH.id}
        result={okResult([
          {
            student: {
              studentId: 'student-1',
              username: 'ana',
              fullName: 'Ana Pop',
            },
            progress: null,
          },
        ])}
      />,
    );

    const row = screen.getByTestId('class-path-progress-row-student-1');
    await user.click(within(row).getByRole('button', { name: /corectează/i }));
    await chooseFilterOption(
      user,
      row,
      /acțiune pentru ana pop/i,
      /marchează corectat manual/i,
    );
    await user.click(
      within(row).getByLabelText(/confirm că vreau să corectez manual/i),
    );
    await user.click(
      within(row).getByRole('button', { name: /aplică modificarea/i }),
    );

    await waitFor(() => expect(overrideProgressMock).toHaveBeenCalledTimes(1));
    expect(overrideProgressMock).toHaveBeenCalledWith({
      studentId: 'student-1',
      pathId: PATH.id,
      status: 'overridden',
    });
  });
});
