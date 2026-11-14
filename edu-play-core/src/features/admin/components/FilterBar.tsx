'use client';

import type { ReactNode } from 'react';
import { TextInput } from '@mantine/core';
import { FilterChipGroup } from '@/shared/components/ui/kit/FilterChipGroup';
import { Icon } from '@/shared/components/ui/Icon';
import { cn } from '@/shared/lib/utils/cn';

export interface FilterChip<TValue extends string = string> {
  value: TValue;
  label: ReactNode;
  /** Optional badge count rendered after the label. */
  count?: number;
}

export interface FilterBarProps<TValue extends string = string> {
  /** Search input value (controlled). */
  searchValue: string;
  /** Search change handler. */
  onSearchChange: (value: string) => void;
  /** Search input placeholder. */
  searchPlaceholder?: string;
  /** Accessible label for the search input. */
  searchLabel?: string;
  /** Currently selected chip value. */
  activeChip?: TValue;
  /** Chip change handler. */
  onChipChange?: (value: TValue) => void;
  /** Filter chips (e.g. "Toate", "Publicate", "Draft"). */
  chips?: FilterChip<TValue>[];
  /** Optional trailing slot for selects, sort menus, etc. */
  trailing?: ReactNode;
  className?: string;
}

const searchInputStyles = {
  input: {
    backgroundColor: 'var(--color-surface)',
    borderColor: 'var(--color-outline-variant)',
    color: 'var(--color-on-surface)',
    fontSize: 13,
    fontWeight: 600,
    minHeight: 44,
  },
} as const;

/**
 * Editorial-density admin filter row. In-place composition.
 *
 * Per the EDU-134 scope note, this does NOT expose a "density" prop — admin
 * editorial density is encoded directly into the layout (compact spacing,
 * 13px input text, side-by-side chips and search). If a teacher/parent
 * surface needs the same affordance with different spacing, it should ship
 * its own composition rather than parameterising this one.
 */
export function FilterBar<TValue extends string = string>({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Caută...',
  searchLabel = 'Caută',
  activeChip,
  onChipChange,
  chips,
  trailing,
  className,
}: FilterBarProps<TValue>) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-4 lg:flex-row lg:items-center lg:justify-between',
        className,
      )}
    >
      <TextInput
        type="search"
        aria-label={searchLabel}
        value={searchValue}
        onChange={(event) => onSearchChange(event.currentTarget.value)}
        placeholder={searchPlaceholder}
        radius={8}
        leftSection={<Icon name="MagnifyingGlass" size="sm" aria-hidden />}
        leftSectionPointerEvents="none"
        className="w-full max-w-lg"
        styles={searchInputStyles}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        {chips && chips.length > 0 ? (
          <FilterChipGroup
            ariaLabel="Filtrează"
            items={chips.map((chip) => ({
              value: chip.value,
              label: chip.label,
              count: chip.count,
            }))}
            value={activeChip ?? ''}
            onChange={(value) => onChipChange?.(value as TValue)}
            size="xs"
          />
        ) : null}
        {trailing}
      </div>
    </div>
  );
}
