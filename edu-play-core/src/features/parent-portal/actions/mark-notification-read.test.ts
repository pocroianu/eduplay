import { beforeEach, describe, expect, it, vi } from 'vitest'

const revalidatePathMock = vi.fn()
const getUserMock = vi.fn()
const isMock = vi.fn()
const eqMock = vi.fn()
const updateChain = { eq: eqMock, is: isMock }
eqMock.mockReturnValue(updateChain)
const updateMock = vi.fn(() => updateChain)
const fromMock = vi.fn(() => ({ update: updateMock }))

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}))

import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from './mark-notification-read'

describe('mark notification read actions', () => {
  beforeEach(() => {
    revalidatePathMock.mockReset()
    getUserMock.mockReset()
    isMock.mockReset()
    eqMock.mockReset()
    eqMock.mockReturnValue(updateChain)
    updateMock.mockClear()
    fromMock.mockClear()
    getUserMock.mockResolvedValue({
      data: { user: { id: 'parent-1' } },
      error: null,
    })
    isMock.mockResolvedValue({ error: null })
  })

  it('revalidates both parent notification surfaces after marking one row read', async () => {
    const result = await markNotificationAsRead('notification-1')

    expect(result).toEqual({ success: true })
    expect(revalidatePathMock).toHaveBeenCalledWith('/parent')
    expect(revalidatePathMock).toHaveBeenCalledWith('/parent/notifications')
  })

  it('revalidates both parent notification surfaces after marking all rows read', async () => {
    const result = await markAllNotificationsAsRead()

    expect(result).toEqual({ success: true })
    expect(revalidatePathMock).toHaveBeenCalledWith('/parent')
    expect(revalidatePathMock).toHaveBeenCalledWith('/parent/notifications')
  })
})
