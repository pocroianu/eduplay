'use client'

import { ScrollArea } from '@mantine/core'
import { FilterChipGroup, type FilterChipOption } from '@/shared/components/ui/kit'
import { CATEGORY_CONFIG, ALL_CATEGORIES, type GameCategory } from '../types'

interface CategoryFilterProps {
  selectedCategory: GameCategory | 'all'
  onCategoryChange: (category: GameCategory | 'all') => void
}

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'Toate' },
  ...ALL_CATEGORIES.map((category) => {
    const config = CATEGORY_CONFIG[category]

    return {
      value: category,
      label: config.label,
      icon: config.icon,
    }
  }),
] satisfies FilterChipOption[]

export function CategoryFilter({ selectedCategory, onCategoryChange }: CategoryFilterProps) {
  return (
    <ScrollArea type="hover" offsetScrollbars scrollbarSize={6} className="pb-2">
      <FilterChipGroup
        ariaLabel="Filtrează jocurile după categorie"
        items={CATEGORY_OPTIONS}
        value={selectedCategory}
        onChange={(value) => onCategoryChange(value as GameCategory | 'all')}
        size="kid"
        radius="lg"
        gap="sm"
        wrap={false}
        className="min-w-max px-1"
      />
    </ScrollArea>
  )
}
