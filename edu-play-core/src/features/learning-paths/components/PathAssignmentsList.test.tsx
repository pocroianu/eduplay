import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  formatAssignmentDueDate,
  formatAssignmentsCount,
  PathAssignmentsList,
} from './PathAssignmentsList';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

describe('formatAssignmentDueDate', () => {
  it('keeps date-only due dates on the entered calendar day', () => {
    expect(formatAssignmentDueDate('2026-06-01')).toBe('1 iun. 2026');
  });
});

describe('formatAssignmentsCount', () => {
  it('returns Romanian labels for assignment counts', () => {
    expect(formatAssignmentsCount(0)).toBe('0 atribuiri');
    expect(formatAssignmentsCount(1)).toBe('1 atribuire');
    expect(formatAssignmentsCount(3)).toBe('3 atribuiri');
  });
});

describe('PathAssignmentsList', () => {
  it('links class assignments to the class progress matrix', () => {
    render(
      <PathAssignmentsList
        pathId="path-1"
        assignments={[
          {
            id: 'assignment-1',
            classId: 'class-1',
            studentId: null,
            targetType: 'class',
            targetName: 'Clasa Curcubeu',
            targetDetail: null,
            dueDate: null,
          },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: /vezi progresul/i })).toHaveAttribute(
      'href',
      '/teacher/classes/class-1/paths/path-1',
    );
  });
});
