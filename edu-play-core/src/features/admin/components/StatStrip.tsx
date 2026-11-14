import type { ReactNode } from 'react';
import { DuoCard, Pill } from '@/shared/components/ui/kit';
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';
import { cn } from '@/shared/lib/utils/cn';

export type StatDeltaTone = 'positive' | 'negative' | 'neutral';

export interface StatStripItem {
  /** Stable key used as React key. */
  key: string;
  /** Short label rendered above the value. */
  label: ReactNode;
  /** Primary value — kept as a string so callers control formatting. */
  value: ReactNode;
  /** Optional Phosphor icon name displayed in a soft badge. */
  icon?: IconName;
  /** Optional supporting copy under the value. */
  hint?: ReactNode;
  /** Optional delta pill (e.g. "+12 săptămâna asta"). */
  delta?: {
    label: ReactNode;
    tone?: StatDeltaTone;
  };
}

export interface StatStripProps {
  items: StatStripItem[];
  className?: string;
}

const DELTA_TONE: Record<StatDeltaTone, 'lime' | 'cream' | 'neutral'> = {
  positive: 'lime',
  negative: 'cream',
  neutral: 'neutral',
};

/**
 * Editorial density stat row. Composes Duo `DuoCard` + `Pill` from the kit;
 * lives in-place under `/admin` until a second consumer surface needs the
 * same layout.
 *
 * Auto-grids 1 / 2 / 4 columns at sm/md/lg so admins see the full strip on a
 * desk and a stacked column on tablets.
 */
export function StatStrip({ items, className }: StatStripProps) {
  return (
    <section
      aria-label="Statistici"
      className={cn(
        'grid gap-4 sm:grid-cols-2 lg:grid-cols-4',
        className,
      )}
    >
      {items.map((item) => (
        <DuoCard key={item.key} className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
              {item.label}
            </span>
            {item.icon ? (
              <span
                aria-hidden="true"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-outline-variant/40 bg-surface-container text-on-surface"
              >
                <Icon name={item.icon} size="md" />
              </span>
            ) : null}
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-[30px] font-bold leading-none text-on-surface">
              {item.value}
            </span>
            {item.delta ? (
              <Pill tone={DELTA_TONE[item.delta.tone ?? 'neutral']}>
                {item.delta.label}
              </Pill>
            ) : null}
          </div>
          {item.hint ? (
            <p className="text-[13px] leading-[1.5] text-on-surface-variant">{item.hint}</p>
          ) : null}
        </DuoCard>
      ))}
    </section>
  );
}
