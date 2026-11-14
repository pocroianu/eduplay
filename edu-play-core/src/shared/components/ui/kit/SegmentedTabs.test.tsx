import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SegmentedTabs, type SegmentedTab } from './SegmentedTabs';

const tabs: SegmentedTab[] = [
  { value: 'teacher', label: 'Profesor', icon: 'GraduationCap' },
  { value: 'parent', label: 'Părinte', icon: 'Users' },
];

describe('SegmentedTabs', () => {
  it('renders as a grouped segmented control with accessible label', () => {
    render(
      <SegmentedTabs
        tabs={tabs}
        value="teacher"
        onChange={() => {}}
        ariaLabel="Alege rolul"
      />,
    );
    expect(screen.getByRole('group', { name: /alege rolul/i })).toBeInTheDocument();
  });

  it('marks the active button with aria-pressed=true', () => {
    render(
      <SegmentedTabs
        tabs={tabs}
        value="parent"
        onChange={() => {}}
        ariaLabel="Alege rolul"
      />,
    );
    expect(screen.getByRole('button', { name: /părinte/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /profesor/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('fires onChange with the tab value', () => {
    const onChange = vi.fn();
    render(
      <SegmentedTabs
        tabs={tabs}
        value="teacher"
        onChange={onChange}
        ariaLabel="Alege rolul"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /părinte/i }));
    expect(onChange).toHaveBeenCalledWith('parent');
  });
});
