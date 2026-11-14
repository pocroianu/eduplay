import { ROUTES } from '@/shared/lib/constants'
import type { IconName } from '@/shared/components/ui/Icon.registry'

export const ADMIN_NAV_ITEMS: ReadonlyArray<{ icon: IconName; label: string; href: string }> = [
  { icon: 'SquaresFour', label: 'Panou', href: ROUTES.ADMIN.DASHBOARD },
  { icon: 'PuzzlePiece', label: 'Activități', href: ROUTES.ADMIN.CMS_ACTIVITIES },
  { icon: 'Users', label: 'Utilizatori', href: ROUTES.ADMIN.USERS },
  { icon: 'ToggleRight', label: 'Funcționalități', href: ROUTES.ADMIN.FLAGS },
  { icon: 'ListChecks', label: 'Jurnal audit', href: ROUTES.ADMIN.AUDIT },
  { icon: 'Gavel', label: 'Confidențialitate', href: ROUTES.ADMIN.PRIVACY },
]
