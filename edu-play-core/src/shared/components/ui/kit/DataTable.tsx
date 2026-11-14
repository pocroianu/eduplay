'use client';

import { Fragment, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import { cn } from '@/shared/lib/utils/cn';
import { EmptyState, type EmptyStateProps } from './EmptyState';

export type SortDirection = 'asc' | 'desc';

export interface DataTableColumn<T> {
  /** Stable key for this column — used as React key and sort identifier. */
  key: string;
  /** Header label rendered in the `<th>` and the mobile card eyebrow. */
  header: ReactNode;
  /** Required cell renderer. Must be side-effect free. */
  cell: (row: T, rowIndex: number) => ReactNode;
  /** When true, the header becomes a sort button. */
  sortable?: boolean;
  /** Tailwind utility for cell text alignment. Defaults to left. */
  align?: 'left' | 'right' | 'center';
  /** Override the stacked-card cell label on mobile. Falls back to `header`. */
  mobileLabel?: ReactNode;
  /**
   * Override cell rendering in the mobile stacked view. Useful when the desktop
   * layout would be too dense for a narrow card. Falls back to `cell`.
   */
  mobileRender?: (row: T, rowIndex: number) => ReactNode;
  /** Hide this column entirely on mobile. */
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  /** Unique key per row. */
  getRowKey: (row: T, rowIndex: number) => string;
  /** Current sort key, or null if none. */
  sortKey?: string | null;
  /** Current sort direction. Defaults to 'asc'. */
  sortDirection?: SortDirection;
  /** Fired when a sortable header is activated (click or keyboard). */
  onSortChange?: (key: string, direction: SortDirection) => void;
  /** Optional row click handler. Makes rows focusable and keyboard-activatable. */
  onRowClick?: (row: T, rowIndex: number) => void;
  /** Rendered when `rows.length === 0`. Either an `EmptyStateProps` shape or a raw node. */
  empty?: EmptyStateProps | ReactNode;
  /** Show a loading skeleton in place of rows. */
  loading?: boolean;
  /** Number of skeleton rows to render while `loading` is true. Defaults to 4. */
  loadingRows?: number;
  /** Accessible description for screen readers. */
  caption?: ReactNode;
  className?: string;
}

const TABLE_SHELL_CLASS =
  'overflow-hidden rounded-lg bg-surface-container-lowest shadow-soft-sm';

function isEmptyStateProps(value: unknown): value is EmptyStateProps {
  return (
    typeof value === 'object' &&
    value !== null &&
    'icon' in (value as Record<string, unknown>) &&
    'title' in (value as Record<string, unknown>)
  );
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  sortKey = null,
  sortDirection = 'asc',
  onSortChange,
  onRowClick,
  empty,
  loading = false,
  loadingRows = 4,
  caption,
  className,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className={cn(TABLE_SHELL_CLASS, className)} aria-busy="true">
        <div className="hidden md:block">
          <table className="w-full border-collapse">
            {caption ? <caption className="sr-only">{caption}</caption> : null}
            <thead>
              <tr className="bg-surface-container">
                {columns.map((col, index) => (
                  <HeaderCell
                    key={col.key}
                    column={col}
                    isFirst={index === 0}
                    isLast={index === columns.length - 1}
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSortChange={onSortChange}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: loadingRows }).map((_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`} className="border-t border-outline-variant/60">
                  {columns.map((col, colIndex) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-6 py-4',
                        colIndex === 0 && 'pl-8',
                        colIndex === columns.length - 1 && 'pr-8',
                      )}
                    >
                      <div className="h-4 w-3/4 animate-pulse motion-reduce:animate-none rounded-full bg-surface-container" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="md:hidden flex flex-col gap-3 p-4">
          {Array.from({ length: loadingRows }).map((_, rowIndex) => (
            <div
              key={`skeleton-mobile-${rowIndex}`}
              className="flex flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-4 shadow-soft-sm"
            >
              {columns
                .filter((c) => !c.hideOnMobile)
                .map((col) => (
                  <div
                    key={col.key}
                    className="flex items-center justify-between gap-4"
                  >
                    <div className="h-3 w-1/3 animate-pulse motion-reduce:animate-none rounded-full bg-surface-container" />
                    <div className="h-3 w-1/4 animate-pulse motion-reduce:animate-none rounded-full bg-surface-container" />
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (rows.length === 0 && empty) {
    return (
      <div className={cn(TABLE_SHELL_CLASS, className)}>
        {isEmptyStateProps(empty) ? <EmptyState {...empty} /> : empty}
      </div>
    );
  }

  return (
    <div className={cn(TABLE_SHELL_CLASS, className)}>
      {/* Desktop: real table with sticky header */}
      <div className="hidden md:block">
        <table className="w-full border-collapse">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-outline-variant bg-surface-container">
              {columns.map((col, index) => (
                <HeaderCell
                  key={col.key}
                  column={col}
                  isFirst={index === 0}
                  isLast={index === columns.length - 1}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSortChange={onSortChange}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <BodyRow
                key={getRowKey(row, rowIndex)}
                row={row}
                rowIndex={rowIndex}
                columns={columns}
                onRowClick={onRowClick}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked Duo card list */}
      <div className="md:hidden flex flex-col gap-3 p-4">
        {rows.map((row, rowIndex) => (
          <MobileCard
            key={getRowKey(row, rowIndex)}
            row={row}
            rowIndex={rowIndex}
            columns={columns}
            onRowClick={onRowClick}
          />
        ))}
      </div>
    </div>
  );
}

type HeaderCellProps<T> = {
  column: DataTableColumn<T>;
  isFirst: boolean;
  isLast: boolean;
  sortKey: string | null;
  sortDirection: SortDirection;
  onSortChange?: (key: string, direction: SortDirection) => void;
};

function HeaderCell<T>({ column, isFirst, isLast, sortKey, sortDirection, onSortChange }: HeaderCellProps<T>) {
  const isActive = sortKey === column.key;
  const ariaSort: 'ascending' | 'descending' | 'none' = isActive
    ? sortDirection === 'asc'
      ? 'ascending'
      : 'descending'
    : 'none';

  const alignClass =
    column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left';

  const basePadding = cn('px-6 py-4', isFirst && 'pl-8', isLast && 'pr-8');

  if (!column.sortable) {
    return (
      <th
        scope="col"
        className={cn(
          basePadding,
          alignClass,
          'text-[11px] font-bold uppercase tracking-widest text-on-surface-variant',
        )}
      >
        {column.header}
      </th>
    );
  }

  const nextDirection: SortDirection = isActive && sortDirection === 'asc' ? 'desc' : 'asc';
  const icon = !isActive ? 'CaretUpDown' : sortDirection === 'asc' ? 'ArrowUp' : 'ArrowDown';

  return (
    <th scope="col" aria-sort={ariaSort} className={cn(basePadding, alignClass)}>
      <button
        type="button"
        onClick={() => onSortChange?.(column.key, nextDirection)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full',
          'text-[11px] font-bold uppercase tracking-widest',
          isActive ? 'text-on-surface' : 'text-on-surface-variant',
          'hover:text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        )}
      >
        <span>{column.header}</span>
        <Icon name={icon} size={18} aria-hidden />
      </button>
    </th>
  );
}

type BodyRowProps<T> = {
  row: T;
  rowIndex: number;
  columns: DataTableColumn<T>[];
  onRowClick?: (row: T, rowIndex: number) => void;
};

function BodyRow<T>({ row, rowIndex, columns, onRowClick }: BodyRowProps<T>) {
  const interactive = Boolean(onRowClick);

  const interactiveProps = interactive
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick: () => onRowClick?.(row, rowIndex),
        onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onRowClick?.(row, rowIndex);
          }
        },
      }
    : {};

  return (
    <tr
      className={cn(
        'border-t border-outline-variant/60',
        'hover:bg-primary-wash/60 transition-colors',
        interactive && 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
      )}
      {...interactiveProps}
    >
      {columns.map((col, index) => {
        const alignClass =
          col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
        const padding = cn('px-6 py-4', index === 0 && 'pl-8', index === columns.length - 1 && 'pr-8');
        return (
          <td key={col.key} className={cn(padding, alignClass, 'text-[15px] text-on-surface align-middle')}>
            {col.cell(row, rowIndex)}
          </td>
        );
      })}
    </tr>
  );
}

type MobileCardProps<T> = {
  row: T;
  rowIndex: number;
  columns: DataTableColumn<T>[];
  onRowClick?: (row: T, rowIndex: number) => void;
};

function MobileCard<T>({ row, rowIndex, columns, onRowClick }: MobileCardProps<T>) {
  const visibleColumns = columns.filter((c) => !c.hideOnMobile);
  const interactive = Boolean(onRowClick);

  const body = visibleColumns.map((col) => {
    const label = col.mobileLabel ?? col.header;
    const content = col.mobileRender ? col.mobileRender(row, rowIndex) : col.cell(row, rowIndex);
    return (
      <Fragment key={col.key}>
        <div className="flex items-start justify-between gap-4 text-sm">
          <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
            {label}
          </span>
          <span className="text-on-surface text-right">{content}</span>
        </div>
      </Fragment>
    );
  });

  const baseClass = cn(
    'flex w-full flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-4 text-left shadow-soft-sm',
    interactive &&
      'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 hover:bg-primary-wash/60 transition-colors',
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={() => onRowClick?.(row, rowIndex)}
        className={baseClass}
      >
        {body}
      </button>
    );
  }

  return <div className={baseClass}>{body}</div>;
}
