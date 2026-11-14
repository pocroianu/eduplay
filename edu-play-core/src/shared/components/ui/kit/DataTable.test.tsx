import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DataTable, type DataTableColumn } from './DataTable';

type Student = { id: string; name: string; progress: number };

const STUDENTS: Student[] = [
  { id: 's1', name: 'Ana', progress: 80 },
  { id: 's2', name: 'Bogdan', progress: 55 },
];

const COLUMNS: DataTableColumn<Student>[] = [
  { key: 'name', header: 'Nume', sortable: true, cell: (r) => r.name },
  { key: 'progress', header: 'Progres', sortable: true, align: 'right', cell: (r) => `${r.progress}%` },
];

describe('DataTable', () => {
  it('renders header and rows on desktop', () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={STUDENTS}
        getRowKey={(r) => r.id}
      />,
    );

    const table = screen.getByRole('table');
    expect(within(table).getByText('Nume')).toBeInTheDocument();
    expect(within(table).getByText('Ana')).toBeInTheDocument();
    expect(within(table).getByText('Bogdan')).toBeInTheDocument();
  });

  it('renders the desktop thead with sticky positioning', () => {
    const { container } = render(
      <DataTable columns={COLUMNS} rows={STUDENTS} getRowKey={(r) => r.id} />,
    );
    const thead = container.querySelector('thead');
    expect(thead?.className).toContain('sticky');
    expect(thead?.className).toContain('top-0');
  });

  it('marks sorted column with aria-sort', () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={STUDENTS}
        getRowKey={(r) => r.id}
        sortKey="name"
        sortDirection="asc"
      />,
    );

    const nameHeader = screen.getByRole('columnheader', { name: /nume/i });
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');

    const progressHeader = screen.getByRole('columnheader', { name: /progres/i });
    expect(progressHeader).toHaveAttribute('aria-sort', 'none');
  });

  it('calls onSortChange when a header is clicked and toggles direction', () => {
    const onSortChange = vi.fn();
    render(
      <DataTable
        columns={COLUMNS}
        rows={STUDENTS}
        getRowKey={(r) => r.id}
        sortKey="name"
        sortDirection="asc"
        onSortChange={onSortChange}
      />,
    );

    const header = screen.getByRole('columnheader', { name: /nume/i });
    fireEvent.click(within(header).getByRole('button'));
    expect(onSortChange).toHaveBeenCalledWith('name', 'desc');
  });

  it('renders raw empty node when rows is empty and a node is provided', () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={[]}
        getRowKey={(r) => r.id}
        empty={<div data-testid="empty-slot">No data</div>}
      />,
    );
    expect(screen.getByTestId('empty-slot')).toBeInTheDocument();
  });

  it('composes EmptyState when empty is given as EmptyStateProps', () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={[]}
        getRowKey={(r) => r.id}
        empty={{
          icon: 'Users',
          title: 'Niciun elev',
          description: 'Adaugă primul tău elev.',
        }}
      />,
    );
    expect(screen.getByText('Niciun elev')).toBeInTheDocument();
    expect(screen.getByText('Adaugă primul tău elev.')).toBeInTheDocument();
  });

  it('renders skeleton rows when loading is true', () => {
    const { container } = render(
      <DataTable columns={COLUMNS} rows={[]} getRowKey={(r) => r.id} loading loadingRows={3} />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.getAttribute('aria-busy')).toBe('true');
    const desktop = container.querySelector('.hidden.md\\:block tbody');
    expect(desktop?.children.length).toBe(3);
  });

  it('fires onRowClick when a row is clicked', () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={COLUMNS}
        rows={STUDENTS}
        getRowKey={(r) => r.id}
        onRowClick={onRowClick}
      />,
    );

    const table = screen.getByRole('table');
    const row = within(table).getByText('Ana').closest('tr');
    expect(row).toBeTruthy();
    fireEvent.click(row!);
    expect(onRowClick).toHaveBeenCalledWith(STUDENTS[0], 0);
  });

  it('renders a mobile stacked card view with each row as a labeled block', () => {
    const { container } = render(
      <DataTable columns={COLUMNS} rows={STUDENTS} getRowKey={(r) => r.id} />,
    );

    const mobileContainer = container.querySelector('.md\\:hidden');
    expect(mobileContainer).toBeTruthy();
    expect(within(mobileContainer as HTMLElement).getAllByText('Nume')).toHaveLength(2);
    expect(within(mobileContainer as HTMLElement).getAllByText('Progres')).toHaveLength(2);
  });

  it('honors hideOnMobile columns in the stacked view', () => {
    const columnsWithHidden: DataTableColumn<Student>[] = [
      { key: 'name', header: 'Nume', cell: (r) => r.name },
      { key: 'progress', header: 'Progres', hideOnMobile: true, cell: (r) => r.progress },
    ];

    const { container } = render(
      <DataTable columns={columnsWithHidden} rows={STUDENTS} getRowKey={(r) => r.id} />,
    );

    const mobileContainer = container.querySelector('.md\\:hidden');
    expect(within(mobileContainer as HTMLElement).queryByText('Progres')).toBeNull();
    expect(within(mobileContainer as HTMLElement).getAllByText('Nume')).toHaveLength(2);
  });
});
