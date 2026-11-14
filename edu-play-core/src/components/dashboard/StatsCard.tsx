'use client'

import { motion } from 'framer-motion'
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';

interface StatsCardProps {
  title: string
  value: string | number
  icon: IconName
  color?: string
  trend?: {
    value: number
    isPositive: boolean
  }
}

export function StatsCard({
  title,
  value,
  icon,
  color = 'brand.500',
  trend,
}: StatsCardProps) {
  const toneMap: Record<string, { bg: string; iconBg: string; iconColor: string }> = {
    'brand.500': { bg: 'linear-gradient(180deg, var(--color-surface-container-lowest) 0%, color-mix(in srgb, var(--color-primary-container) 8%, var(--color-surface-container-lowest)) 100%)', iconBg: 'color-mix(in srgb, var(--color-primary-container) 18%, transparent)', iconColor: 'var(--color-primary-container)' },
    'blue.500': { bg: 'linear-gradient(180deg, var(--color-surface-container-lowest) 0%, color-mix(in srgb, var(--color-primary-container) 8%, var(--color-surface-container-lowest)) 100%)', iconBg: 'color-mix(in srgb, var(--color-primary-container) 18%, transparent)', iconColor: 'var(--color-primary)' },
    'green.500': { bg: 'linear-gradient(180deg, var(--color-surface-container-lowest) 0%, color-mix(in srgb, var(--color-tertiary-container) 8%, var(--color-surface-container-lowest)) 100%)', iconBg: 'color-mix(in srgb, var(--color-tertiary-container) 20%, transparent)', iconColor: 'var(--color-tertiary)' },
    'yellow.500': { bg: 'linear-gradient(180deg, var(--color-surface-container-lowest) 0%, color-mix(in srgb, var(--color-secondary-container) 10%, var(--color-surface-container-lowest)) 100%)', iconBg: 'color-mix(in srgb, var(--color-secondary-container) 20%, transparent)', iconColor: 'var(--color-secondary)' },
    'orange.500': { bg: 'linear-gradient(180deg, var(--color-surface-container-lowest) 0%, color-mix(in srgb, var(--color-fun-orange) 8%, var(--color-surface-container-lowest)) 100%)', iconBg: 'color-mix(in srgb, var(--color-fun-orange) 20%, transparent)', iconColor: 'var(--color-fun-orange)' },
    'purple.500': { bg: 'linear-gradient(180deg, var(--color-surface-container-lowest) 0%, color-mix(in srgb, var(--color-fun-purple) 8%, var(--color-surface-container-lowest)) 100%)', iconBg: 'color-mix(in srgb, var(--color-fun-purple) 18%, transparent)', iconColor: 'var(--color-fun-purple)' },
  }
  const tone = toneMap[color] ?? toneMap['brand.500']

  return (
    <motion.div
      style={{
        background: tone.bg,
        borderRadius: '28px',
        padding: '24px',
        boxShadow: '0 18px 40px rgba(42, 47, 50, 0.06)',
        border: '1px solid color-mix(in srgb, var(--color-outline-variant) 15%, transparent)',
      }}
      transition={{ duration: 0.18 }}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium mb-1 text-on-surface-variant">
            {title}
          </p>
          <p className="text-3xl font-bold text-on-surface">
            {value}
          </p>
          {trend && (
            <p
              className={`text-sm font-medium mt-1 ${trend.isPositive ? 'text-tertiary' : 'text-error'}`}
            >
              {trend.isPositive ? '+' : ''}{trend.value}% față de luna trecută
            </p>
          )}
        </div>
        <motion.div
          className="flex items-center justify-center w-14 h-14"
          style={{
            borderRadius: '18px',
            backgroundColor: tone.iconBg,
          }}
          transition={{ duration: 0.18 }}
        >
          <span style={{ color: tone.iconColor }}>
            <Icon name={icon} size={28} />
          </span>
        </motion.div>
      </div>
    </motion.div>
  )
}
