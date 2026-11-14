'use client'

import { useTranslation } from 'react-i18next'

type StatusKey = 'online' | 'needs_help' | 'offline'

const statusStyle: Record<StatusKey, { dotClass: string; badgeClass: string }> = {
  online: {
    dotClass: 'bg-primary animate-pulse motion-reduce:animate-none',
    badgeClass: 'bg-primary/10 text-primary',
  },
  needs_help: {
    dotClass: 'bg-coral',
    badgeClass: 'bg-coral/10 text-coral',
  },
  offline: {
    dotClass: 'bg-on-surface-variant',
    badgeClass: 'bg-on-surface-variant/10 text-on-surface-variant',
  },
}

const STATUS_I18N_KEY: Record<StatusKey, string> = {
  online: 'classes.detail.studentStatus.online',
  needs_help: 'classes.detail.studentStatus.needsHelp',
  offline: 'classes.detail.studentStatus.offline',
}

interface StudentStatusBadgeProps {
  status: StatusKey
}

export function StudentStatusBadge({ status }: StudentStatusBadgeProps) {
  const { t } = useTranslation('teacher')
  const style = statusStyle[status]

  return (
    <span
      className={`inline-flex items-center gap-1.5 py-1.5 px-3 rounded-full text-[11px] font-bold uppercase tracking-wide ${style.badgeClass}`}
    >
      <span className={`w-2 h-2 rounded-full ${style.dotClass}`} />
      {t(STATUS_I18N_KEY[status])}
    </span>
  )
}
