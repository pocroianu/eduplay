"use client";

import { UnstyledButton } from "@mantine/core";
import { MantineBoundary } from "./MantineBoundary";
import { cn } from "@/shared/lib/utils/cn";

import { Icon } from "@/shared/components/ui/Icon";

import type { IconName } from "@/shared/components/ui/Icon.registry";

type Mode = "standard" | "kid";

export interface SegmentedTab {
  /** Stable id returned by `onChange` — use this, not the index. */

  value: string;

  label: string;

  /** Optional Phosphor icon rendered before the label. */

  icon?: IconName;
}

export interface SegmentedTabsProps {
  tabs: SegmentedTab[];

  value: string;

  onChange: (value: string) => void;

  /** Accessible label for the segmented button group. */

  ariaLabel: string;

  /** Visual register. standard = pill; kid = larger classroom card. */

  mode?: Mode;

  className?: string;
}

/**

 * Segmented button group shared by login + register. This is not a true tabset:

 * callers swap forms directly, so buttons expose `aria-pressed` instead of

 * dangling tab/panel relationships.

 */

export function SegmentedTabs(props: SegmentedTabsProps) {
  return (
    <MantineBoundary>
      <SegmentedTabsContent {...props} />
    </MantineBoundary>
  );
}

function SegmentedTabsContent({
  tabs,

  value,

  onChange,

  ariaLabel,

  mode = "standard",

  className,
}: SegmentedTabsProps) {
  if (mode === "kid") {
    return (
      <div
        role="group"
        aria-label={ariaLabel}
        className={cn(
          "flex gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest p-1 shadow-soft-sm",

          className,
        )}
      >
        {tabs.map((tab) => {
          const selected = tab.value === value;

          return (
            <UnstyledButton
              key={tab.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(tab.value)}
              className={cn(
                "flex-1 flex min-h-16 items-center justify-center gap-2 rounded-xl py-3 font-headline font-bold uppercase text-sm tracking-wide transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40",

                selected
                  ? "bg-primary text-on-primary shadow-soft-sm"
                  : "text-on-surface hover:bg-surface-container",
              )}
            >
              {tab.icon && (
                <Icon name={tab.icon} className="text-lg" aria-hidden />
              )}

              <span>{tab.label}</span>
            </UnstyledButton>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex gap-1 p-1 rounded-full bg-surface-container",
        className,
      )}
    >
      {tabs.map((tab) => {
        const selected = tab.value === value;

        return (
          <UnstyledButton
            key={tab.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(tab.value)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-full font-label font-bold text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",

              selected
                ? "bg-surface-container-lowest shadow-soft text-primary"
                : "text-on-surface-variant hover:bg-surface-container-high",
            )}
          >
            {tab.icon && (
              <Icon name={tab.icon} className="text-lg" aria-hidden />
            )}

            <span>{tab.label}</span>
          </UnstyledButton>
        );
      })}
    </div>
  );
}
