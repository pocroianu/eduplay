'use client';

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { UnstyledButton } from '@mantine/core';
import { MantineBoundary, Pill } from '@/shared/components/ui/kit';
import { cn } from '@/shared/lib/utils/cn';

export interface ChildOption {
  id: string;
  name: string;
}

export interface ChildSelectorProps {
  childOptions: ChildOption[];
  /** Active child id, or `null` for "all children". Provided by the page. */
  selectedChildId: string | null;
  /**
   * Optional override for the click handler. Defaults to a router-based
   * implementation that mirrors the active selection into `?child=<id>`.
   * Pass an explicit handler for unit-test coverage of the click contract.
   */
  onChange?: (childId: string | null) => void;
  className?: string;
}

const QUERY_KEY = 'child';

/**
 * Pill row at the top of the parent feed. "Toți copiii" is always first,
 * followed by one pill per linked child. Active selection is reflected in
 * `?child=<id>` so the server component re-renders the feed for that child;
 * removing the filter restores the cross-child page.
 *
 * `childOptions` (not `children`) intentionally — `children` would shadow
 * React's built-in JSX children slot and confuse consumers.
 */
export function ChildSelector({
  childOptions,
  selectedChildId,
  onChange,
  className,
}: ChildSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const apply = (childId: string | null) => {
    if (onChange) {
      onChange(childId);
      return;
    }
    const next = new URLSearchParams(searchParams?.toString());
    if (childId) {
      next.set(QUERY_KEY, childId);
    } else {
      next.delete(QUERY_KEY);
    }
    const queryString = next.toString();
    const target = queryString ? `${pathname}?${queryString}` : pathname;
    startTransition(() => {
      router.replace(target, { scroll: false });
    });
  };

  return (
    <MantineBoundary>
    <div
      data-testid="family-feed-child-selector"
      role="group"
      aria-label="Filtrează după copil"
      className={cn('flex flex-wrap items-center gap-2', className)}
    >
      <SelectorPill
        active={selectedChildId === null}
        onClick={() => apply(null)}
      >
        Toți copiii
      </SelectorPill>
      {childOptions.map((child) => (
        <SelectorPill
          key={child.id}
          active={selectedChildId === child.id}
          onClick={() => apply(child.id)}
        >
          {child.name}
        </SelectorPill>
      ))}
    </div>
    </MantineBoundary>
  );
}

function SelectorPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <UnstyledButton
      type="button"
      aria-pressed={active}
      data-active={active}
      onClick={onClick}
      className="min-h-16 min-w-16 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      <Pill tone={active ? 'lime' : 'neutral'}>{children}</Pill>
    </UnstyledButton>
  );
}
