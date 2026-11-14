import { describe, expect, it } from 'vitest'
import { getInitials } from './initials'

describe('getInitials', () => {
  it('builds Romanian-safe initials from the first two words', () => {
    expect(getInitials('Ana Ionescu')).toBe('AI')
    expect(getInitials('școala centrală')).toBe('ȘC')
  })

  it('falls back when the display name is empty', () => {
    expect(getInitials('')).toBe('?')
    expect(getInitials(null)).toBe('?')
  })
})
