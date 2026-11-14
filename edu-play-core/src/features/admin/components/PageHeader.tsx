import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils/cn';

export interface PageHeaderProps {
  /** Short uppercase label rendered above the title (e.g. "Administrare"). */
  eyebrow?: ReactNode;
  /** Page title — kept short and direct. */
  title: ReactNode;
  /** Supporting subtitle copy explaining what the page does. */
  description?: ReactNode;
  /** Optional action slot — typically a compact button or icon button group. */
  actions?: ReactNode;
  /** Optional meta slot rendered under the title (e.g. last-updated stamp). */
  meta?: ReactNode;
  className?: string;
}

/**
 * Per-route admin shell header. In-place admin composition (not a kit
 * primitive); promote only when a second consumer needs the same layout.
 *
 * Editorial density rules: tighter top spacing than student/teacher pages,
 * supports an inline meta row for timestamps or counts.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'border-b border-outline-variant bg-surface-container-lowest px-5 py-5 lg:flex lg:items-end lg:justify-between lg:gap-6',
        className,
      )}
    >
      <div className="space-y-2">
        {eyebrow ? (
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
            {eyebrow}
          </span>
        ) : null}
        <h1 className="text-[28px] font-bold leading-tight text-on-surface">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-[15px] leading-[1.55] text-on-surface-variant">
            {description}
          </p>
        ) : null}
        {meta ? (
          <div className="flex flex-wrap items-center gap-3 text-[13px] text-on-surface-variant">
            {meta}
          </div>
        ) : null}
      </div>
      {actions ? <div className="mt-4 flex flex-wrap items-center gap-2 lg:mt-0">{actions}</div> : null}
    </header>
  );
}
