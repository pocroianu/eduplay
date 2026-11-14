'use client'

import { useTranslation } from 'react-i18next'
import { DuoCard, Vulpita, type VulpitaMood } from '@/shared/components/ui/kit'

export interface VulpitaPanelProps {
  mood: VulpitaMood
  remainingLessons: number
}

export function VulpitaPanel({ mood, remainingLessons }: VulpitaPanelProps) {
  const { t } = useTranslation('student')

  let line: string

  switch (mood) {
    case 'happy':
      line = t('questMap.vulpita.happy')
      break
    case 'think':
      line = t('questMap.vulpita.thinking')
      break
    case 'sleep':
      line = t('questMap.vulpita.sleep')
      break
    case 'cheer':
    default:
      line = t('questMap.vulpita.cheer', { count: remainingLessons })
      break
  }

  return (
    <DuoCard
      className="text-center"
      style={{
        background: 'var(--color-primary-wash)',
        borderColor: 'var(--color-primary)',
        borderWidth: 2,
      }}
    >
      <div className="flex flex-col items-center gap-2">
        <Vulpita size={160} mood={mood} />
        <p className="text-[18px] font-bold text-primary-deep">
          {t('questMap.vulpita.title')}
        </p>
        <p className="text-[18px] font-semibold leading-snug text-on-surface-variant">
          {line}
        </p>
      </div>
    </DuoCard>
  )
}
