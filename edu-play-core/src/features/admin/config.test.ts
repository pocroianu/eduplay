import { describe, expect, it } from 'vitest'
import { ADMIN_NAV_ITEMS } from './config'
import { ROUTES } from '@/shared/lib/constants'

describe('ADMIN_NAV_ITEMS', () => {
  it('keeps a single clear CMS activities entry', () => {
    const activityItems = ADMIN_NAV_ITEMS.filter(
      (item) => item.href === ROUTES.ADMIN.CMS_ACTIVITIES,
    )

    expect(activityItems).toEqual([
      expect.objectContaining({
        label: 'Activități',
        href: ROUTES.ADMIN.CMS_ACTIVITIES,
      }),
    ])
  })
})
