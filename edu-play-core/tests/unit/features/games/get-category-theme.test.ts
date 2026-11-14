import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  getCategoryVisuals,
  useCategoryTheme,
} from '@/features/games/components/getCategoryTheme'

const ALL_CATEGORIES = ['math', 'literacy', 'phonics', 'shapes', 'colors', 'vocabulary'] as const

describe('getCategoryVisuals', () => {
  it('returns visuals for every supported category', () => {
    for (const category of ALL_CATEGORIES) {
      const visuals = getCategoryVisuals(category)
      expect(visuals.icon).toBeTruthy()
      expect(visuals.accentColor).toBeTruthy()
      expect(visuals.accentSoft).toBeTruthy()
      expect(visuals.themeKey).toBe(category)
    }
  })

  it('returns the default visuals for unknown categories', () => {
    const visuals = getCategoryVisuals('unknown-xyz')
    expect(visuals.themeKey).toBe('default')
    expect(visuals.icon).toBeTruthy()
  })

  it('returns the default visuals for null category', () => {
    const visuals = getCategoryVisuals(null)
    expect(visuals.themeKey).toBe('default')
  })

  it('uses the Duo blue token for math', () => {
    const visuals = getCategoryVisuals('math')
    expect(visuals.accentColor).toBe('var(--color-blue)')
    expect(visuals.icon).toBe('Calculator')
  })

  it('uses the Duo purple token for phonics', () => {
    const visuals = getCategoryVisuals('phonics')
    expect(visuals.accentColor).toBe('var(--color-purple)')
    expect(visuals.icon).toBe('SpeakerSimpleHigh')
  })

  it('uses the Duo gold token for vocabulary', () => {
    const visuals = getCategoryVisuals('vocabulary')
    expect(visuals.accentColor).toBe('var(--color-gold)')
    expect(visuals.icon).toBe('TextAa')
  })
})

describe('useCategoryTheme', () => {
  it('returns translated chrome copy for every supported category', () => {
    for (const category of ALL_CATEGORIES) {
      const { result } = renderHook(() => useCategoryTheme(category))
      expect(result.current.badge).toContain('Misiune')
      expect(result.current.title).toBeTruthy()
      expect(result.current.subtitle).toBeTruthy()
      expect(result.current.quote).toBeTruthy()
      expect(result.current.steps).toHaveLength(3)
      expect(result.current.coach).toBe('Sfat de la Vulpița:')
    }
  })

  it('falls back to the default theme copy for an unknown category', () => {
    const { result } = renderHook(() => useCategoryTheme('unknown-xyz'))
    expect(result.current.badge).toBe('Misiune ghidată')
    expect(result.current.title).toBe('Jocul de Astăzi')
  })
})
