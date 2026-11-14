import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookieStoreSet = vi.fn()
const revalidatePathMock = vi.fn()
const getUserMock = vi.fn()
const fromUpdateEqMock = vi.fn()
const fromUpdateMock = vi.fn(() => ({ eq: fromUpdateEqMock }))
const fromMock = vi.fn(() => ({ update: fromUpdateMock }))

vi.mock('next/headers', () => ({
  cookies: async () => ({ set: cookieStoreSet }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}))

import { switchLanguage } from './switch-language'

describe('switchLanguage server action', () => {
  beforeEach(() => {
    cookieStoreSet.mockReset()
    revalidatePathMock.mockReset()
    getUserMock.mockReset()
    fromUpdateEqMock.mockReset()
    fromUpdateMock.mockClear()
    fromMock.mockClear()
    fromUpdateEqMock.mockResolvedValue({ data: null, error: null })
  })

  it('rejects unsupported languages without touching cookies or DB', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })

    const result = await switchLanguage('fr')

    expect(result).toEqual({ ok: false, error: 'unsupported-language' })
    expect(cookieStoreSet).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled()
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('sets the locale cookie and revalidates for anonymous visitors', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })

    const result = await switchLanguage('en')

    expect(result).toEqual({ ok: true, lang: 'en' })
    expect(cookieStoreSet).toHaveBeenCalledWith(
      'NEXT_LOCALE',
      'en',
      expect.objectContaining({ path: '/', sameSite: 'lax', httpOnly: false }),
    )
    expect(fromMock).not.toHaveBeenCalled()
    expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout')
  })

  it('persists the preference to profiles when authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const result = await switchLanguage('ro')

    expect(result).toEqual({ ok: true, lang: 'ro' })
    expect(cookieStoreSet).toHaveBeenCalledWith('NEXT_LOCALE', 'ro', expect.any(Object))
    expect(fromMock).toHaveBeenCalledWith('profiles')
    expect(fromUpdateMock).toHaveBeenCalledWith({ preferred_language: 'ro' })
    expect(fromUpdateEqMock).toHaveBeenCalledWith('id', 'user-1')
    expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout')
  })

  it('still succeeds with just the cookie when Supabase throws', async () => {
    getUserMock.mockRejectedValue(new Error('network down'))

    const result = await switchLanguage('en')

    expect(result).toEqual({ ok: true, lang: 'en' })
    expect(cookieStoreSet).toHaveBeenCalled()
    expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout')
  })
})
