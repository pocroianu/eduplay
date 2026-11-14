import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createClient } from '@/lib/supabase/server'
import {
  checkLoginRateLimit,
  clearLoginAttempts,
  recordFailedLogin,
} from '@/features/auth/utils/login-rate-limit'
import { changePinAction } from '../change-pin'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/features/auth/utils/login-rate-limit', () => ({
  checkLoginRateLimit: vi.fn(),
  clearLoginAttempts: vi.fn(),
  recordFailedLogin: vi.fn(),
}))

const createClientMock = vi.mocked(createClient)
const checkLoginRateLimitMock = vi.mocked(checkLoginRateLimit)
const clearLoginAttemptsMock = vi.mocked(clearLoginAttempts)
const recordFailedLoginMock = vi.mocked(recordFailedLogin)

class Query {
  constructor(private readonly table: string) {}

  select() {
    return this
  }

  eq() {
    return this
  }

  single() {
    if (this.table === 'profiles') {
      return Promise.resolve({ data: { role: 'student' }, error: null })
    }
    return Promise.resolve({ data: null, error: { message: 'not found' } })
  }

  maybeSingle() {
    if (this.table === 'students') {
      return Promise.resolve({ data: { username: 'ana' }, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  }
}

function makeSupabase() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'student-1', email: 'ana@student.eduplay.ro' } },
      }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: 'student-1' } }, error: null }),
      updateUser: vi.fn().mockResolvedValue({ data: { user: { id: 'student-1' } }, error: null }),
    },
    from: (table: string) => new Query(table),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  checkLoginRateLimitMock.mockResolvedValue({ allowed: true, remainingAttempts: 5 })
  clearLoginAttemptsMock.mockResolvedValue(undefined)
  recordFailedLoginMock.mockResolvedValue(undefined)
})

describe('changePinAction', () => {
  it('keeps the child-facing PIN while using Supabase-compatible internal passwords', async () => {
    const supabase = makeSupabase()
    createClientMock.mockResolvedValue(supabase as never)

    const result = await changePinAction({
      currentPin: '1234',
      newPin: '5678',
      confirmPin: '5678',
    })

    expect(result).toEqual({ success: true })
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'ana@student.eduplay.ro',
      password: 'student-pin:1234',
    })
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      password: 'student-pin:5678',
    })
    expect(clearLoginAttemptsMock).toHaveBeenCalledWith('student:ana')
  })
})
