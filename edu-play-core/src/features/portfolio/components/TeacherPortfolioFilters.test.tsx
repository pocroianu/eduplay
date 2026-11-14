import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { TeacherPortfolioFilters } from './TeacherPortfolioFilters';

const classes = [
  { id: 'cls-1', name: 'Clasa 1A' },
  { id: 'cls-2', name: 'Clasa 1B' },
];

const students = [
  { id: 'stu-1', username: 'andrei.vulpe' },
  { id: 'stu-2', username: 'ana.lup' },
];

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function installResizeObserverMock() {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: ResizeObserverMock,
  });
  Element.prototype.scrollIntoView = () => {};
}

function renderFilters(
  props?: Partial<React.ComponentProps<typeof TeacherPortfolioFilters>>,
) {
  return render(
    <MantineProvider>
      <TeacherPortfolioFilters
        classes={classes}
        students={students}
        filters={{ classId: null, studentId: null, from: null, to: null }}
        {...props}
      />
    </MantineProvider>,
  );
}

describe('TeacherPortfolioFilters', () => {
  beforeEach(() => {
    installResizeObserverMock();
  });

  it('renders class and student filters as Mantine selects with an "all" option each', () => {
    renderFilters();

    expect(screen.getByRole('link', { name: /toți elevii/i })).toHaveClass(
      'mantine-NavLink-root',
    );
    expect(screen.getByRole('link', { name: /andrei\.vulpe/i })).toHaveClass(
      'mantine-NavLink-root',
    );

    const classSelect = screen.getByRole('combobox', {
      name: /filtrează după clasă/i,
    });
    expect(classSelect).toHaveClass('mantine-Select-input');
    expect(classSelect).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Toate clasele', hidden: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Clasa 1A', hidden: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Clasa 1B', hidden: true }),
    ).toBeInTheDocument();

    const studentSelect = screen.getByRole('combobox', {
      name: /filtrează după elev/i,
    });
    expect(studentSelect).toHaveClass('mantine-Select-input');
    expect(
      screen.getByRole('option', { name: 'Toți elevii', hidden: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'andrei.vulpe', hidden: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'ana.lup', hidden: true }),
    ).toBeInTheDocument();
  });

  it('preselects the active filter values from props', () => {
    const { container } = renderFilters({
      filters: {
          classId: 'cls-2',
          studentId: 'stu-1',
          from: '2026-04-01',
          to: '2026-04-30',
        },
    });

    expect(
      container.querySelector('input[type="hidden"][name="classId"]'),
    ).toHaveValue('cls-2');
    expect(
      container.querySelector('input[type="hidden"][name="studentId"]'),
    ).toHaveValue('stu-1');
    expect(
      (screen.getByLabelText('Data de început') as HTMLInputElement).value,
    ).toBe('2026-04-01');
    expect(
      (screen.getByLabelText('Data de sfârșit') as HTMLInputElement).value,
    ).toBe('2026-04-30');
  });

  it('uses GET as the form method targeting /teacher/portfolio', () => {
    const { container } = renderFilters();
    const form = container.querySelector('form');
    expect(form).toBeTruthy();
    expect(form?.getAttribute('method')?.toLowerCase()).toBe('get');
    expect(form?.getAttribute('action')).toBe('/teacher/portfolio');
  });

  it('hides the clear-filters link when no filters are set', () => {
    renderFilters();
    expect(
      screen.queryByRole('link', { name: /șterge filtrele/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the clear-filters link when at least one filter is set', () => {
    renderFilters({
      filters: {
          classId: 'cls-1',
          studentId: null,
          from: null,
          to: null,
        },
    });
    const clear = screen.getByRole('link', { name: /șterge filtrele/i });
    expect(clear.getAttribute('href')).toBe('/teacher/portfolio');
    expect(clear).toHaveClass('mantine-Anchor-root');
  });

  it('keeps active student navigation state on Mantine NavLink roots', () => {
    renderFilters({
      filters: {
          classId: null,
          studentId: 'stu-2',
          from: null,
          to: null,
        },
    });

    const activeStudent = screen.getByRole('link', { name: /ana\.lup/i });
    expect(activeStudent).toHaveClass('mantine-NavLink-root');
    expect(activeStudent).toHaveAttribute('aria-current', 'page');
  });
});
