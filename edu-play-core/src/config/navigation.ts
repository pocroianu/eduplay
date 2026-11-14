import { ROUTES } from '@/shared/lib/constants'
import type { NavVariant } from '@/shared/components/layout/SideNavBar'
import type { IconName } from '@/shared/components/ui/Icon.registry'

interface NavItem {
  icon: IconName
  label: string
  labelKey?: string
  href: string
  filled?: boolean
  badge?: string
}

interface RoleNavConfig {
  variant: NavVariant
  items: NavItem[]
  bottomNavItems?: NavItem[]
}

export const ROLE_NAV_CONFIG: Record<string, RoleNavConfig> = {
  teacher: {
    variant: 'teacher',
    items: [
      { icon: 'SquaresFour', label: 'Panou', labelKey: 'nav.teacher.dashboard', href: ROUTES.TEACHER.DASHBOARD },
      { icon: 'Storefront', label: 'Biblioteci', labelKey: 'nav.teacher.librariesExplore', href: ROUTES.TEACHER.LIBRARIES_EXPLORE },
      { icon: 'Star', label: 'Biblioteca mea', labelKey: 'nav.teacher.library', href: ROUTES.TEACHER.LIBRARY },
    ],
    bottomNavItems: [
      { icon: 'SquaresFour', label: 'Panou', labelKey: 'nav.teacher.dashboard', href: ROUTES.TEACHER.DASHBOARD },
      { icon: 'Users', label: 'Clasele', labelKey: 'nav.teacher.classes', href: ROUTES.TEACHER.CLASSES },
      { icon: 'BookOpen', label: 'Activități', labelKey: 'nav.teacher.activities', href: ROUTES.TEACHER.ACTIVITIES },
      { icon: 'Storefront', label: 'Explorează', labelKey: 'nav.teacher.librariesExplore', href: ROUTES.TEACHER.LIBRARIES_EXPLORE },
    ],
  },
  parent: {
    variant: 'parent',
    items: [
      { icon: 'SquaresFour', label: 'Panou principal', href: ROUTES.PARENT.DASHBOARD },
      { icon: 'GameController', label: 'Jocuri', href: ROUTES.PARENT.ACTIVITIES },
      { icon: 'Link', label: 'Conectare Copil', href: ROUTES.PARENT.LINK_CHILD },
    ],
  },
  admin: {
    variant: 'admin',
    items: [
      { icon: 'SquaresFour', label: 'Panou', href: ROUTES.ADMIN.DASHBOARD },
      { icon: 'PuzzlePiece', label: 'Activități', href: ROUTES.ADMIN.CMS_ACTIVITIES },
      { icon: 'Users', label: 'Utilizatori', href: ROUTES.ADMIN.USERS },
      { icon: 'ClockCounterClockwise', label: 'Jurnal de audit', href: ROUTES.ADMIN.AUDIT },
    ],
  },
  student: {
    variant: 'student',
    items: [
      { icon: 'House', label: 'Acasă', href: ROUTES.STUDENT.DASHBOARD },
      { icon: 'GameController', label: 'Jocuri', href: ROUTES.STUDENT.ACTIVITIES },
      { icon: 'ChartLineUp', label: 'Progres', href: ROUTES.STUDENT.PROGRESS },
      { icon: 'Medal', label: 'Premii', href: ROUTES.STUDENT.REWARDS },
      { icon: 'SlidersHorizontal', label: 'Setări', href: ROUTES.STUDENT.PROFILE },
    ],
    bottomNavItems: [
      { icon: 'House', label: 'Acasă', href: ROUTES.STUDENT.DASHBOARD },
      { icon: 'GameController', label: 'Jocuri', href: ROUTES.STUDENT.ACTIVITIES },
      { icon: 'ChartLineUp', label: 'Progres', href: ROUTES.STUDENT.PROGRESS },
      { icon: 'Medal', label: 'Premii', href: ROUTES.STUDENT.REWARDS },
    ],
  },
}
