import { Icon } from '@/shared/components/ui/Icon';
import { ADMIN_OVERVIEW_HEADER, getAdminGreeting } from '@/features/admin/copy/overview'

export interface AdminPageHeaderProps {
  /** Display name shown in the greeting line. */
  fullName: string
  /** Defaults to `new Date()` — accept an injected value so tests stay deterministic. */
  now?: Date
}

/**
 * Editorial header for the `/admin` overview surface. Eyebrow → greeting →
 * subtitle on the left; muted maintenance CTA pinned to the right. The CTA
 * is wired but disabled until the maintenance route ships in a follow-up
 * ticket — copy comes from `ADMIN_OVERVIEW_HEADER` so the same Romanian
 * strings cover Storybook, page render, and the visual review.
 */
export function AdminPageHeader({ fullName, now }: AdminPageHeaderProps) {
  const greeting = ADMIN_OVERVIEW_HEADER.greeting(getAdminGreeting(now), fullName)
  const cta = ADMIN_OVERVIEW_HEADER.maintenanceCta

  return (
    <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">
      <div className="flex flex-col gap-2 max-w-2xl">
        <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
          {ADMIN_OVERVIEW_HEADER.eyebrow}
        </p>
        <h1 className="text-[clamp(28px,4vw,40px)] font-bold tracking-tight font-headline text-on-surface">
          {greeting}
        </h1>
        <p className="text-base text-on-surface-variant">
          {ADMIN_OVERVIEW_HEADER.subtitle}
        </p>
      </div>

      <button
        type="button"
        disabled
        aria-disabled="true"
        title={cta.disabledTooltip}
        className="self-start lg:self-auto inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-5 py-3 text-sm font-semibold text-on-surface-variant shadow-soft-sm opacity-60 cursor-not-allowed focus-visible:outline-2 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Icon name="Wrench" size={18} />
        <span>{cta.label}</span>
      </button>
    </header>
  )
}
