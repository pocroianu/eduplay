'use client'

import { TextInput } from '@mantine/core'
import { Icon } from '@/shared/components/ui/Icon';

const SEARCH_PLACEHOLDER = 'Căutarea va fi disponibilă în curând'

const searchInputStyles = {
  input: {
    backgroundColor: 'var(--color-surface-container-low)',
    borderColor: 'var(--color-outline-variant)',
    color: 'var(--color-on-surface-variant)',
    cursor: 'not-allowed',
    fontSize: 14,
    fontWeight: 600,
    minHeight: 44,
  },
} as const

/**
 * Admin top-bar search placeholder for the EduPlay standard shell. Search is
 * not wired yet, so keep the control disabled instead of presenting a strong
 * false affordance.
 */
export function AdminSearchInput() {
  return (
    <div className="hidden items-center gap-2 text-on-surface-variant md:flex">
      <TextInput
        type="search"
        aria-label="Căutarea în panoul administrativ nu este disponibilă momentan"
        placeholder={SEARCH_PLACEHOLDER}
        disabled
        radius="xl"
        leftSection={<Icon name="MagnifyingGlass" size="md" aria-hidden />}
        leftSectionPointerEvents="none"
        className="w-72 lg:w-96"
        styles={searchInputStyles}
      />
      <span
        className="hidden lg:inline-flex items-center rounded-full border border-outline-variant px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant"
      >
        Indisponibil
      </span>
    </div>
  )
}
