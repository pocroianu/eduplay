import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils/cn';

export interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ title, eyebrow, subtitle, action, className }: PageHeaderProps) {
  return (
    <header
      aria-label={eyebrow ?? title}
      className={cn(
        'flex h-[72px] items-center justify-between border-b border-outline bg-surface-container-lowest px-6',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-muted">{eyebrow}</p> : null}
        <h1 className="truncate font-headline text-xl font-bold tracking-tight text-on-surface">{title}</h1>
        {subtitle ? <p className="mt-1 truncate text-sm text-on-surface-variant">{subtitle}</p> : null}
      </div>
      {action ? <div className="ml-4 shrink-0">{action}</div> : null}
    </header>
  );
}
