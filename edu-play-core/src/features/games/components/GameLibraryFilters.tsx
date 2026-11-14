'use client';

import { useTranslation } from 'react-i18next';
import { FilterChipGroup, FilterSelect } from '@/shared/components/ui/kit';
import { ALL_CATEGORIES, type GameCategory } from '../types';

interface GameLibraryFiltersProps {
  selectedCategory: GameCategory | 'all';
  onCategoryChange: (category: GameCategory | 'all') => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
}

const SORT_OPTIONS = [
  { value: 'newest', labelKey: 'activities.sort.newest' },
  { value: 'difficulty', labelKey: 'activities.sort.difficulty' },
  { value: 'age', labelKey: 'activities.sort.age' },
] as const;

export function GameLibraryFilters({
  selectedCategory,
  onCategoryChange,
  sortBy,
  onSortChange,
}: GameLibraryFiltersProps) {
  const { t } = useTranslation('teacher');
  const categoryOptions = [
    { value: 'all', label: t('activities.filters.all') },
    ...ALL_CATEGORIES.map((category) => ({
      value: category,
      label: t(`activities.filters.categories.${category}`),
    })),
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <FilterChipGroup
        ariaLabel={t('activities.filters.categoriesLabel')}
        items={categoryOptions}
        value={selectedCategory}
        onChange={(value) => onCategoryChange(value as GameCategory | 'all')}
        size="lg"
      />

      <FilterSelect
        label={t('activities.sort.label')}
        value={sortBy}
        onChange={onSortChange}
        options={SORT_OPTIONS.map((option) => ({
          value: option.value,
          label: t(option.labelKey),
        }))}
        size="md"
        width={176}
      />
    </div>
  );
}
