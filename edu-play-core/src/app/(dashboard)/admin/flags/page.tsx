import { AdminPlaceholderPage } from '@/features/admin/components/AdminPlaceholderPage'

export const dynamic = 'force-dynamic'

export default function AdminFlagsPage() {
  return (
    <AdminPlaceholderPage
      eyebrow="PANOU ADMINISTRATIV / FUNCȚIONALITĂȚI"
      title="Funcționalități"
      subtitle="Activează, dezactivează sau țintește lansările graduale."
      icon="ToggleRight"
      trackingTicket="EDU-70"
      sectionTitle="Configurație lansări"
      statusCards={[
        {
          label: 'Flaguri',
          value: 'În pregătire',
          icon: 'Flag',
          helper: 'Tabelul real va păstra acțiunile și payloadurile existente.',
        },
        {
          label: 'Țintire',
          value: 'Planificat',
          icon: 'SlidersHorizontal',
          helper: 'Segmentele vor fi doar cele suportate de backend.',
        },
        {
          label: 'Audit',
          value: 'Păstrat',
          icon: 'ListChecks',
          helper: 'Schimbările de flag rămân vizibile în jurnal.',
        },
      ]}
      rows={[
        {
          label: 'Stare lansări',
          value: 'Fără controale active',
          helper: 'Pagina nu simulează activări până la conectarea datelor reale.',
        },
        {
          label: 'Mediu',
          value: 'Consolă administrativă',
          helper: 'Aceeași rută și aceeași protecție de acces sunt păstrate.',
        },
        {
          label: 'Responsabilitate',
          value: 'Administratori',
          helper: 'Acțiunile finale trebuie să rămână trasabile în audit.',
        },
      ]}
    />
  )
}
