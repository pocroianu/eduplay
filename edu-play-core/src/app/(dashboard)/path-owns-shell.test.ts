import { describe, it, expect } from 'vitest'
import { pathOwnsShell } from './path-owns-shell'
import { ROUTES } from '@/shared/lib/constants'

describe('pathOwnsShell', () => {
  describe('exact matches (DashboardShell-rendering student routes)', () => {
    it.each([
      ROUTES.STUDENT.DASHBOARD,
      ROUTES.STUDENT.ACTIVITIES,
      ROUTES.STUDENT.PROGRESS,
      ROUTES.STUDENT.REWARDS,
      ROUTES.STUDENT.PROFILE,
      ROUTES.STUDENT.MAP,
    ])('returns true for %s', (path) => {
      expect(pathOwnsShell(path)).toBe(true)
    })
  })

  describe('pattern matches (immersive student surfaces)', () => {
    it('returns true for activity player routes so layout chrome does not duplicate', () => {
      expect(pathOwnsShell(ROUTES.STUDENT.ACTIVITY_PLAY('instance-123'))).toBe(true)
    })

    it('returns true for the teacher class workspace routes that own their EduPlay chrome', () => {
      expect(pathOwnsShell(ROUTES.TEACHER.CLASS('class-1'))).toBe(true)
      expect(pathOwnsShell(ROUTES.TEACHER.CLASS_JOURNAL('class-1'))).toBe(true)
      expect(pathOwnsShell(ROUTES.TEACHER.CLASS_ACTIVITIES('class-1'))).toBe(true)
      expect(pathOwnsShell(ROUTES.TEACHER.CLASS_GRADEBOOK('class-1'))).toBe(true)
      expect(pathOwnsShell(ROUTES.TEACHER.CLASS_NOTIFICATIONS('class-1'))).toBe(true)
    })
  })

  describe('prefix matches (admin subtree)', () => {
    it('returns true for the admin root', () => {
      expect(pathOwnsShell(ROUTES.ADMIN.DASHBOARD)).toBe(true)
    })

    it('returns true for nested admin routes', () => {
      expect(pathOwnsShell(ROUTES.ADMIN.USERS)).toBe(true)
      expect(pathOwnsShell(ROUTES.ADMIN.FLAGS)).toBe(true)
      expect(pathOwnsShell(ROUTES.ADMIN.AUDIT)).toBe(true)
      expect(pathOwnsShell('/admin/anything-else')).toBe(true)
    })
  })

  describe('non-matches (layout keeps chrome)', () => {
    it('returns false for student routes that still need layout-owned chrome', () => {
      expect(pathOwnsShell(ROUTES.STUDENT.LESSON('abc'))).toBe(false)
      expect(pathOwnsShell(`${ROUTES.STUDENT.ACTIVITIES}/instance-123`)).toBe(false)
      expect(pathOwnsShell(`${ROUTES.STUDENT.ACTIVITIES}/instance-123/results`)).toBe(false)
    })

    it('returns false for non-shell-owning roles', () => {
      expect(pathOwnsShell(ROUTES.TEACHER.DASHBOARD)).toBe(false)
      expect(pathOwnsShell(ROUTES.TEACHER.CLASSES)).toBe(false)
      expect(pathOwnsShell(ROUTES.PARENT.DASHBOARD)).toBe(false)
    })

    it('keeps normal dashboard chrome for nested class management flows', () => {
      expect(pathOwnsShell(ROUTES.TEACHER.CLASS_SETTINGS('class-1'))).toBe(false)
      expect(pathOwnsShell(ROUTES.TEACHER.CLASS_FAMILIES('class-1'))).toBe(false)
      expect(pathOwnsShell(ROUTES.TEACHER.CLASS_STUDENT_NEW('class-1'))).toBe(false)
      expect(pathOwnsShell(ROUTES.TEACHER.CLASS_JOURNAL_NEW('class-1'))).toBe(false)
      expect(pathOwnsShell(ROUTES.TEACHER.CLASS_JOURNAL_NOTE_NEW('class-1'))).toBe(false)
    })

    it('does not partial-match a string that merely starts with a shell-owning prefix', () => {
      // `/admin` prefix-matches paths under it (`/admin/x`), but a sibling like
      // `/administrator` should NOT match — the helper must require a `/`
      // boundary to consider a path part of the subtree.
      expect(pathOwnsShell('/administrator')).toBe(false)
    })
  })

  describe('safe defaults', () => {
    it('returns false for null', () => {
      expect(pathOwnsShell(null)).toBe(false)
    })

    it('returns false for undefined', () => {
      expect(pathOwnsShell(undefined)).toBe(false)
    })

    it('returns false for an empty string', () => {
      expect(pathOwnsShell('')).toBe(false)
    })
  })
})
