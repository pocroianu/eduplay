'use client'

import type { ReactNode } from 'react'
import {
  DuoFlame,
  RewardGlyph,
  type RewardGlyphKind,
} from '@/shared/components/ui/kit'

type StatTone = 'coral' | 'gold' | 'blue'

interface ToneStyle {
  bg: string
  fg: string
}

const TONE_STYLE: Record<StatTone, ToneStyle> = {
  coral: {
    bg: 'var(--color-coral-soft)',
    fg: 'var(--color-coral-deep)',
  },
  gold: {
    bg: 'var(--color-gold-soft)',
    fg: 'var(--color-gold-deep)',
  },
  blue: {
    bg: 'var(--color-blue-soft)',
    fg: 'var(--color-blue-deep)',
  },
}

export interface StatBubbleProps {
  tone: StatTone
  glyph: RewardGlyphKind
  big: ReactNode
  small: ReactNode
  ariaLabel?: string
}

export function StatBubble({ tone, glyph, big, small, ariaLabel }: StatBubbleProps) {
  const { bg, fg } = TONE_STYLE[tone]
  const icon =
    glyph === 'flame' ? <DuoFlame size={22} /> : <RewardGlyph kind={glyph} size={22} />

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-outline-variant px-4 py-2 shadow-soft-sm"
      style={{
        backgroundColor: bg,
        color: fg,
      }}
    >
      <span aria-hidden="true" className="flex items-center">
        {icon}
      </span>
      <span className="leading-none">
        <span className="block text-lg font-bold tracking-tight">{big}</span>
        <span className="block text-[18px] font-bold uppercase tracking-[0.04em] opacity-80">
          {small}
        </span>
      </span>
    </div>
  )
}
