'use client'

import type { ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'

/**
 * App-wide framer-motion config: every motion component honours the OS
 * "reduce motion" setting. Student routes layer their own preference on top via
 * `PreferencesProvider`.
 */
export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
