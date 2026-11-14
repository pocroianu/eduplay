import { describe, expect, it } from 'vitest'

import {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  normalizeLanguage,
} from './config'

describe('i18n config', () => {
  it('defaults to Romanian', () => {
    expect(DEFAULT_LANGUAGE).toBe('ro')
    expect(FALLBACK_LANGUAGE).toBe('ro')
  })

  it('lists ro and en as supported', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['ro', 'en'])
  })

  it('exposes a human label for every supported language', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(LANGUAGE_LABELS[lang]).toBeTruthy()
    }
  })

  describe('isSupportedLanguage', () => {
    it('accepts supported codes', () => {
      expect(isSupportedLanguage('ro')).toBe(true)
      expect(isSupportedLanguage('en')).toBe(true)
    })

    it('rejects unknown codes, empty strings, and non-string values', () => {
      expect(isSupportedLanguage('fr')).toBe(false)
      expect(isSupportedLanguage('')).toBe(false)
      expect(isSupportedLanguage(null)).toBe(false)
      expect(isSupportedLanguage(undefined)).toBe(false)
      expect(isSupportedLanguage(42)).toBe(false)
    })
  })

  describe('normalizeLanguage', () => {
    it('passes through supported codes', () => {
      expect(normalizeLanguage('ro')).toBe('ro')
      expect(normalizeLanguage('en')).toBe('en')
    })

    it('falls back to the default when the value is missing or unsupported', () => {
      expect(normalizeLanguage(null)).toBe('ro')
      expect(normalizeLanguage(undefined)).toBe('ro')
      expect(normalizeLanguage('fr')).toBe('ro')
      expect(normalizeLanguage('')).toBe('ro')
    })
  })
})
