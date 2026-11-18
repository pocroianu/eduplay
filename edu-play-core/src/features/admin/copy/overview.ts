/**
 * Romanian UI copy for the future `/admin` overview surface.
 *
 * Visual shell, layout, and component code for the overview waits on Duo
 * (EDU-103) + DashboardShell `variant="admin"` (EDU-51). This module is
 * imported by the eventual page once those land — it exists today so the
 * copy is reviewed, diacritics-complete, and stable across the re-skin.
 *
 * Diacritics: every Romanian glyph below uses the canonical `ș` / `ț` /
 * `ă` / `â` / `î` characters. Keep it that way — the legacy comma-below
 * `s` / `t` variants will not pass review.
 */

export type Greeting =
  | 'Bună dimineața'
  | 'Bună ziua'
  | 'Bună seara'
  | 'Bună noaptea';

/**
 * Returns the time-of-day-appropriate Romanian greeting for the eyebrow
 * row. Mirrors the slots used elsewhere in the product (parent dashboard,
 * teacher home) so the admin shell does not invent its own buckets.
 */
export function getAdminGreeting(now: Date = new Date()): Greeting {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return 'Bună dimineața';
  if (hour >= 12 && hour < 18) return 'Bună ziua';
  if (hour >= 18 && hour < 23) return 'Bună seara';
  return 'Bună noaptea';
}

export const ADMIN_OVERVIEW_HEADER = {
  eyebrow: 'PANOU ADMINISTRATIV',
  /** Full sentence with the actor's name interpolated, e.g. `Bună ziua, Andrei`. */
  greeting: (greeting: Greeting, name: string): string => `${greeting}, ${name}`,
  subtitle: 'Iată starea platformei astăzi.',
  maintenanceCta: {
    label: 'Deschide modul întreținere',
    /** Shown while the maintenance route is gated behind a future ticket. */
    disabledTooltip: 'Disponibil curând',
  },
} as const;

export const ADMIN_OVERVIEW_STATS = {
  activeUsers: {
    label: 'Utilizatori activi (7 zile)',
    helper: 'Profesori, părinți și administratori care au generat activitate.',
  },
  publishedGames: {
    label: 'Jocuri publicate / totale',
    helper: 'Catalogul vizibil pentru elevi și profesori.',
  },
  gdprOpen: {
    label: 'Cereri GDPR deschise',
    helper: 'Solicitări de ștergere în perioada de grație de 30 de zile.',
    badgeWhen: 'gt_zero' as const,
  },
  auditIncidents: {
    label: 'Incidente audit (24 ore)',
    helper: 'Acțiuni administrative înregistrate în jurnalul de audit.',
    errorWhen: 'gt_zero' as const,
  },
} as const;

export const ADMIN_OVERVIEW_PANELS = {
  activityFeed: {
    title: 'Activitate recentă',
    seeAll: 'Vezi tot',
    emptyState: 'Nicio activitate înregistrată momentan.',
  },
  quickShortcuts: {
    title: 'Rapid spre',
    items: [
      { label: 'Utilizatori', helper: 'Caută, suspendă, resetează acces.' },
      { label: 'Funcționalități', helper: 'Activează sau testează lansări gradual.' },
      { label: 'Confidențialitate', helper: 'Cereri GDPR și jurnal de audit.' },
    ],
  },
  recentReleases: {
    title: 'Lansări recente',
    emptyState: 'Nicio modificare de funcționalitate în ultima perioadă.',
    /** Translates a `feature_flag_events.action` value into a Romanian label. */
    actionLabels: {
      created: 'creată',
      enabled: 'activată',
      disabled: 'dezactivată',
      targeting_changed: 'țintire modificată',
      description_changed: 'descriere actualizată',
      deleted: 'ștearsă',
    },
  },
} as const;

export const ADMIN_OVERVIEW_LOADING = {
  statSkeletonLabel: 'Se încarcă statistica…',
  feedSkeletonLabel: 'Se încarcă activitatea…',
  panelSkeletonLabel: 'Se încarcă panoul…',
} as const;
