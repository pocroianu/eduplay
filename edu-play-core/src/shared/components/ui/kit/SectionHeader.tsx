import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/shared/lib/utils/cn';
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';

type Mode = 'kid' | 'standard';
type Align = 'left' | 'center';
type IconTone = 'primary' | 'secondary' | 'tertiary' | 'neutral';

const ICON_TONE_CLASS: Record<IconTone, string> = {
  primary: 'bg-primary-soft text-primary-deep',
  secondary: 'bg-gold-soft text-gold-deep',
  tertiary: 'bg-primary-soft text-primary-deep',
  neutral: 'bg-surface-container text-on-surface',
};

export interface SectionHeaderProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'title' | 'children'> {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  mode?: Mode;
  align?: Align;
  /** Optional Phosphor icon rendered as a chip to the left of the title. */
  icon?: IconName;
  iconTone?: IconTone;
  /**
   * Optional action slot rendered opposite the title — typically a
   * "Vezi tot" link. Right-aligned on desktop; wraps below the title on
   * narrow screens. Only used when `align="left"`.
   */
  action?: ReactNode;
  /** Appended below the subtitle — typically a secondary CTA row. */
  children?: ReactNode;
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  mode = 'standard',
  align = 'left',
  icon,
  iconTone = 'primary',
  action,
  children,
  className,
  ...props
}: SectionHeaderProps) {
  const isCenter = align === 'center';
  const isKid = mode === 'kid';
  const showSideAction = Boolean(action) && !isCenter;

  const titleBlock = (
    <div
      className={cn(
        'flex flex-col gap-3',
        isCenter ? 'items-center text-center' : 'items-start text-left',
      )}
    >
      {eyebrow ? (
        <div
          className={cn(
            isKid
              ? 'font-body text-sm font-bold uppercase tracking-[0.18em]'
              : 'font-body text-xs font-semibold uppercase tracking-wide text-on-surface-variant',
          )}
          style={isKid ? { color: 'var(--color-on-surface-variant)' } : undefined}
        >
          {eyebrow}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        {icon ? (
          <span
            aria-hidden="true"
            className={cn(
              'inline-flex items-center justify-center rounded-lg p-2.5 shadow-soft-sm',
              ICON_TONE_CLASS[iconTone],
            )}
          >
            <Icon name={icon} weight="fill" size={24} />
          </span>
        ) : null}
        <h2
          className={cn(
            'font-headline leading-tight tracking-tight',
            isKid
              ? 'text-4xl font-bold md:text-5xl lg:text-6xl'
              : 'text-[22px] font-bold text-on-surface md:text-[28px]',
          )}
          style={isKid ? { color: 'var(--color-on-surface)' } : undefined}
        >
          {title}
        </h2>
      </div>

      {subtitle ? (
        <p
          className={cn(
            'font-body text-base md:text-lg leading-relaxed max-w-2xl',
            isKid ? '' : 'text-on-surface-variant',
          )}
          style={isKid ? { color: 'var(--color-on-surface-variant)' } : undefined}
        >
          {subtitle}
        </p>
      ) : null}

      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  );

  if (showSideAction) {
    return (
      <div
        className={cn(
          'flex flex-col gap-4 md:flex-row md:items-center md:justify-between',
          className,
        )}
        {...props}
      >
        {titleBlock}
        <div className="shrink-0">{action}</div>
      </div>
    );
  }

  return (
    <div className={cn(className)} {...props}>
      {titleBlock}
    </div>
  );
}
