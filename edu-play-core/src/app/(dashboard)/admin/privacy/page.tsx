import { AdminPlaceholderPage } from '@/features/admin/components/AdminPlaceholderPage'

export const dynamic = 'force-dynamic'

export default function AdminPrivacyPage() {
  return (
    <AdminPlaceholderPage
      eyebrow="PANOU ADMINISTRATIV / CONFIDENȚIALITATE"
      title="Confidențialitate"
      subtitle="Cereri GDPR, perioade de grație și controale de export."
      icon="Gavel"
      trackingTicket="EDU-72"
      sectionTitle="Flux cereri date"
      statusCards={[
        {
          label: 'Cereri active',
          value: 'În pregătire',
          icon: 'Clock',
          helper: 'Vor folosi acțiunile existente, fără controale simulate.',
        },
        {
          label: 'Export date',
          value: 'Planificat',
          icon: 'ArrowSquareOut',
          helper: 'Linkurile reale se păstrează când backendul este conectat.',
        },
        {
          label: 'Protecție',
          value: 'Admin',
          icon: 'ShieldCheck',
          helper: 'Accesul rămâne în shell-ul administrativ protejat.',
        },
      ]}
      rows={[
        {
          label: 'Cereri GDPR',
          value: 'Neconectat încă',
          helper: 'Lista finală va afișa cererile reale de export sau ștergere.',
        },
        {
          label: 'Perioadă de grație',
          value: 'Fără modificări',
          helper: 'Nu adăugăm persistare falsă înainte de server actions.',
        },
        {
          label: 'Jurnalizare',
          value: 'Audit administrativ',
          helper: 'Evenimentele sensibile rămân urmărite în jurnalul de audit.',
        },
      ]}
    />
  )
}
