import type { ReactNode } from 'react'
import { Icon } from '@/shared/components/ui/Icon'
import type { IconName } from '@/shared/components/ui/Icon.registry'
import { Card } from '@/shared/components/ui/kit'

export interface AdminPlaceholderRow {
  label: string
  value: ReactNode
  helper?: ReactNode
}

export interface AdminPlaceholderStatusCard {
  label: string
  value: ReactNode
  icon: IconName
  helper?: ReactNode
}

export interface AdminPlaceholderPageProps {
  /** Section eyebrow, e.g. `PANOU ADMINISTRATIV / UTILIZATORI`. */
  eyebrow: string
  title: string
  subtitle: string
  /** Canonical icon shown in the unavailable-state callout. */
  icon: IconName
  /** Identifier of the follow-up ticket this surface ships under. */
  trackingTicket: string
  /** Read-only rows modelled after the EduPlay account settings list. */
  rows?: AdminPlaceholderRow[]
  /** Compact status cards for unavailable operational controls. */
  statusCards?: AdminPlaceholderStatusCard[]
  /** Optional section label above read-only rows. */
  sectionTitle?: string
}

/**
 * Server-component placeholder for admin sub-routes whose data-backed UI is
 * owned by sibling tickets. Provides reference-aligned read-only sections plus
 * an "în pregătire" callout so navigation never returns 404 while the surface
 * is under construction.
 */
export function AdminPlaceholderPage({
  eyebrow,
  title,
  subtitle,
  icon,
  trackingTicket,
  rows = [],
  statusCards = [],
  sectionTitle = 'Setări',
}: AdminPlaceholderPageProps) {
  return (
    <div className="max-w-4xl space-y-6" data-testid="admin-placeholder-page" data-tracking-ticket={trackingTicket}>
      <header className="border-b border-outline-variant bg-surface-container-lowest px-5 py-5">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
          {eyebrow}
        </p>
        <h1 className="font-headline text-[clamp(28px,4vw,36px)] font-bold tracking-tight text-on-surface">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-on-surface-variant">{subtitle}</p>
      </header>

      {statusCards.length > 0 ? (
        <section aria-label="Stare" className="grid gap-3 sm:grid-cols-3">
          {statusCards.map((card) => (
            <Card key={card.label} padding="md" shadow={false} className="border border-outline-variant bg-surface-container-lowest">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                    {card.label}
                  </p>
                  <p className="mt-2 text-xl font-bold text-on-surface">{card.value}</p>
                </div>
                <span
                  aria-hidden="true"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-outline-variant bg-surface-container text-on-surface"
                >
                  <Icon name={card.icon} size="md" />
                </span>
              </div>
              {card.helper ? (
                <p className="mt-3 text-[13px] leading-relaxed text-on-surface-variant">{card.helper}</p>
              ) : null}
            </Card>
          ))}
        </section>
      ) : null}

      {rows.length > 0 ? (
        <section aria-labelledby="admin-placeholder-settings-title" className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
          <div className="border-b border-outline-variant px-5 py-3">
            <h2 id="admin-placeholder-settings-title" className="text-[13px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
              {sectionTitle}
            </h2>
          </div>
          <dl className="divide-y divide-outline-variant">
            {rows.map((row) => (
              <div key={row.label} className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(10rem,14rem)_1fr] sm:items-center">
                <dt className="text-[14px] font-semibold text-on-surface">{row.label}</dt>
                <dd className="text-[14px] text-on-surface-variant">
                  <span className="font-semibold text-on-surface">{row.value}</span>
                  {row.helper ? (
                    <span className="mt-1 block text-[13px] leading-relaxed text-on-surface-variant">
                      {row.helper}
                    </span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <Card padding="lg" shadow={false} className="flex flex-col gap-3 border border-outline-variant bg-surface-container-lowest text-left">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-surface-container text-primary"
          >
            <Icon name={icon} size={24} />
          </span>
          <div>
            <h2 className="font-headline text-lg font-bold text-on-surface">
              În pregătire
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
              Această pagină va fi finalizată într-un ticket dedicat
              ({trackingTicket}). Navigarea funcționează deja pentru a păstra
              continuitatea consolei.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
