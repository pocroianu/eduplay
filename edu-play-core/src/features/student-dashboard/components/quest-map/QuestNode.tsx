'use client'

import Link from 'next/link'
import { ActionIcon } from '@mantine/core'
import { motion, useReducedMotion } from 'framer-motion'
import { Icon } from '@/shared/components/ui/Icon'
import type { IconName } from '@/shared/components/ui/Icon.registry'
import type { QuestNodeState } from './types'

export interface QuestNodeProps {
  state: QuestNodeState
  color: string
  href: string
  ariaLabel: string
  locked?: boolean
  size?: number
}

const STATE_ICON: Record<QuestNodeState, IconName> = {
  done: 'Check',
  active: 'Star',
  upcoming: 'Play',
  locked: 'Lock',
}

function getQuestNodeFill(state: QuestNodeState, color: string, isLocked: boolean) {
  if (state === 'done') return 'var(--color-status-done)'
  if (state === 'active') return 'var(--color-status-active)'
  if (isLocked) return 'var(--color-status-locked)'
  return color
}

function getQuestNodeBorderColor(state: QuestNodeState) {
  if (state === 'active') return 'var(--color-gold)'
  if (state === 'done') return 'var(--color-primary)'
  return 'var(--color-outline-variant)'
}

function getQuestNodeIconColor(state: QuestNodeState, isLocked: boolean) {
  if (isLocked) return 'var(--color-on-surface-muted)'
  if (state === 'active') return 'var(--color-on-gold)'
  return 'var(--color-surface-container-lowest)'
}

export function QuestNode({
  state,
  color,
  href,
  ariaLabel,
  locked,
  size = 80,
}: QuestNodeProps) {
  const reduceMotion = useReducedMotion()
  const isLocked = locked ?? state === 'locked'
  const fill = getQuestNodeFill(state, color, isLocked)
  const borderColor = getQuestNodeBorderColor(state)
  const iconColor = getQuestNodeIconColor(state, isLocked)
  const icon = STATE_ICON[state]
  const iconSize = state === 'locked' ? 28 : 36
  const targetStyles = {
    minWidth: size,
    minHeight: size,
    width: size,
    height: size,
  }

  const inner = (
    <span className="relative inline-flex items-center justify-center">
      <span
        className="inline-flex items-center justify-center rounded-full border-[3px]"
        style={{
          width: size,
          height: size,
          backgroundColor: fill,
          borderColor,
          boxShadow: state === 'active' ? 'var(--shadow-soft)' : 'var(--shadow-soft-sm)',
        }}
      >
        <Icon
          name={icon}
          size={iconSize}
          weight={isLocked ? 'regular' : 'fill'}
          style={{ color: iconColor }}
        />
      </span>
      {state === 'active' ? (
        <motion.span
          aria-hidden="true"
          className="absolute rounded-full"
          style={{
            inset: -8,
            border: '4px dashed var(--color-gold)',
          }}
          animate={reduceMotion ? undefined : { rotate: 360 }}
          transition={{ repeat: Infinity, duration: 10, ease: 'linear' }}
        />
      ) : null}
    </span>
  )

  if (isLocked) {
    return (
      <span
        role="img"
        aria-label={ariaLabel}
        className="inline-flex"
        style={{ minWidth: size, minHeight: size }}
      >
        {inner}
      </span>
    )
  }

  return (
    <ActionIcon
      component={Link}
      href={href}
      aria-label={ariaLabel}
      radius="50%"
      size={size}
      variant="transparent"
      styles={{
        root: {
          ...targetStyles,
          overflow: 'visible',
        },
      }}
    >
      {inner}
    </ActionIcon>
  )
}
