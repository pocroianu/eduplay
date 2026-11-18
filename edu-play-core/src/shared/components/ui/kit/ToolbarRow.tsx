"use client";

import type { ChangeEvent, HTMLAttributes, ReactNode } from "react";
import { Input, UnstyledButton } from "@mantine/core";
import { MantineBoundary } from "./MantineBoundary";

import { Icon } from "@/shared/components/ui/Icon";

import { cn } from "@/shared/lib/utils/cn";

export interface ToolbarFilter<TKey extends string = string> {
  key: TKey;

  label: string;
}

export interface ToolbarSearch {
  "aria-label": string;

  placeholder?: string;

  value: string;

  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export interface ToolbarRowProps<TKey extends string = string>
  extends Omit<
    HTMLAttributes<HTMLDivElement>,
    "className" | "children" | "onChange"
  > {
  filters?: ReadonlyArray<ToolbarFilter<TKey>>;

  activeFilterKey?: TKey;

  onFilterChange?: (key: TKey) => void;

  search?: ToolbarSearch;

  /** Optional trailing slot — additional buttons or controls. */

  trailing?: ReactNode;

  className?: string;
}

/**

 * Filter pills + search input row, used above DataTable in the standard-mode

 * dashboards. Renders nothing if no filters and no search are provided.

 */

export function ToolbarRow<TKey extends string = string>({
  filters,

  activeFilterKey,

  onFilterChange,

  search,

  trailing,

  className,

  ...props
}: ToolbarRowProps<TKey>) {
  const hasFilters = filters && filters.length > 0;

  const hasSearch = Boolean(search);

  if (!hasFilters && !hasSearch && !trailing) return null;

  return (
    <MantineBoundary>
      <div
        className={cn(
          "flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between",

          className,
        )}
        {...props}
      >
        {hasFilters ? (
          <div
            role="group"
            aria-label="Filtre"
            className="flex flex-wrap gap-2"
          >
            {filters!.map((filter) => {
              const selected = filter.key === activeFilterKey;

              return (
                <UnstyledButton
                  key={filter.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onFilterChange?.(filter.key)}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-semibold transition-colors",

                    "focus-ring",

                    selected
                      ? "border-primary bg-primary text-on-primary"
                      : "border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-primary-wash",
                  )}
                >
                  {filter.label}
                </UnstyledButton>
              );
            })}
          </div>
        ) : null}

        {hasSearch ? (
          <label className="relative flex min-h-[44px] flex-1 items-center md:max-w-sm">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3 z-10 text-on-surface-variant"
            >
              <Icon name="MagnifyingGlass" size="md" weight="bold" />
            </span>

            <Input
              unstyled
              withAria={false}
              className="w-full"
              type="search"
              aria-label={search!["aria-label"]}
              placeholder={search!.placeholder}
              value={search!.value}
              onChange={search!.onChange}
              classNames={{
                input: cn(
                  "w-full rounded-md border border-outline-variant bg-surface-container-lowest py-2.5 pl-10 pr-4 shadow-soft-sm",

                  "text-sm font-medium text-on-surface placeholder:text-on-surface-variant",

                  "focus:border-primary focus-ring",
                ),
              }}
            />
          </label>
        ) : null}

        {trailing ? (
          <div className="flex items-center gap-2">{trailing}</div>
        ) : null}
      </div>
    </MantineBoundary>
  );
}
