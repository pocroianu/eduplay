import { Paper } from "@mantine/core";
import { MantineBoundary } from "./MantineBoundary";
import type { HTMLAttributes, ReactNode } from "react";

import { Icon } from "@/shared/components/ui/Icon";

import type { IconName } from "@/shared/components/ui/Icon.registry";

import { cn } from "@/shared/lib/utils/cn";

export interface InsightPanelProps
  extends Omit<
    HTMLAttributes<HTMLDivElement>,
    "className" | "children" | "title"
  > {
  /** Short uppercase eyebrow label. Optional; defaults to "INSIGHT". */

  eyebrow?: ReactNode;

  /** Material Symbol shown in the tinted tertiary icon chip. */

  icon: IconName;

  /** Primary headline. */

  title: ReactNode;

  /** Supporting explanation for why this needs attention. */

  description?: ReactNode;

  /** Optional CTA slot — typically a kit `<Button size="lg" fullWidth>`. */

  action?: ReactNode;

  className?: string;
}

export function InsightPanel({
  eyebrow = "INSIGHT",

  icon,

  title,

  description,

  action,

  className,

  ...props
}: InsightPanelProps) {
  return (
    <MantineBoundary>
      <Paper
        unstyled
        className={cn(
          "bg-surface-container-lowest border border-outline-variant/15 rounded-xl p-6",

          "flex flex-col gap-4",

          className,
        )}
        {...props}
      >
        <div className="flex items-start gap-4">
          <div
            className="h-12 w-12 shrink-0 rounded-2xl bg-primary-container/30 text-primary flex items-center justify-center"
            aria-hidden="true"
          >
            <Icon name={icon} size={24} />
          </div>

          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
              {eyebrow}
            </p>

            <h3 className="text-[18px] font-bold text-on-surface font-headline">
              {title}
            </h3>

            {description ? (
              <p className="text-[15px] leading-[1.6] text-on-surface-variant mt-1">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        {action ? <div className="mt-1">{action}</div> : null}
      </Paper>
    </MantineBoundary>
  );
}
