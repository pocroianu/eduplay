import type { HTMLAttributes, ReactNode } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';
import { Vulpita, type VulpitaMood } from './Vulpita';
import { cn } from '@/shared/lib/utils/cn';

export interface EmptyStateProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'children' | 'title'> {
  /** Phosphor icon name from the canonical kit registry. */
  icon: IconName;
  /** Primary headline. Use Romanian copy that reads warm and action-oriented. */
  title: ReactNode;
  /** Supporting body copy explaining what is empty and what the user can do. */
  description?: ReactNode;
  /** Optional action slot — typically a kit `<Button>` or `<ChunkyButton>`. */
  action?: ReactNode;
  /** When true, renders Vulpița above the icon for brand warmth at frustration moments. */
  mascot?: boolean;
  /** Vulpița mood when mascot is shown. Defaults to 'think'. */
  mascotMood?: VulpitaMood;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  mascot = false,
  mascotMood = 'think',
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        'py-16 px-6 gap-4',
        className,
      )}
      {...props}
    >
      {mascot && <Vulpita size={120} mood={mascotMood} />}
      <span
        aria-hidden="true"
        className="inline-flex h-14 w-14 items-center justify-center rounded-lg bg-primary-soft text-primary-deep shadow-soft-sm"
      >
        <Icon name={icon} size="xl" weight="bold" />
      </span>
      <h3 className="text-[22px] font-bold text-on-surface leading-tight">{title}</h3>
      {description ? (
        <p className="max-w-md text-[15px] leading-[1.6] text-on-surface-variant">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
