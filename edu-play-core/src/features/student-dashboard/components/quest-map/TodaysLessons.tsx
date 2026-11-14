'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/shared/components/ui/Icon'
import { Card, SubjectPill } from '@/shared/components/ui/kit'
import type { QuestLesson } from './types'

interface TodaysLessonsProps {
  lessons: QuestLesson[]
  emptyHref: string
}

export function TodaysLessons({ lessons, emptyHref }: TodaysLessonsProps) {
  const { t } = useTranslation('student')

  if (lessons.length === 0) {
    return (
      <section aria-labelledby="todays-lessons-empty">
        <h2
          id="todays-lessons-empty"
          className="mb-2 text-[18px] font-bold uppercase tracking-[0.08em] text-on-surface-muted"
        >
          {t('questMap.todaysLessons.empty.title')}
        </h2>
        <Card className="text-center">
          <p className="text-[18px] font-semibold text-on-surface-variant">
            {t('questMap.todaysLessons.empty.body')}
          </p>
          <Link
            href={emptyHref}
            className="mt-3 inline-flex min-h-[64px] items-center py-2 text-[18px] font-bold text-primary-deep underline"
          >
            {t('questMap.todaysLessons.viewAll')}
          </Link>
        </Card>
      </section>
    )
  }

  return (
    <section aria-labelledby="todays-lessons-heading">
      <h2
        id="todays-lessons-heading"
        className="mb-2 text-[18px] font-bold uppercase tracking-[0.08em] text-on-surface-muted"
      >
        {t('questMap.todaysLessons.title', { count: lessons.length })}
      </h2>
      <ul className="flex flex-col gap-2">
        {lessons.map((lesson) => (
          <li key={lesson.id}>
            <Link
              href={lesson.href}
              aria-label={`${lesson.title} — ${t('questMap.todaysLessons.duration', {
                minutes: lesson.durationMinutes,
              })}`}
              className="block rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
            >
              <Card
                className="flex min-h-[64px] items-center gap-3"
                style={{ opacity: lesson.done ? 0.7 : 1 }}
              >
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant shadow-soft-sm"
                  style={{
                    backgroundColor: lesson.done
                      ? 'var(--color-primary-soft)'
                      : 'var(--color-primary)',
                  }}
                >
                  <Icon
                    name={lesson.done ? 'Check' : 'Play'}
                    size={20}
                    weight="fill"
                    style={{
                      color: lesson.done
                        ? 'var(--color-primary-deep)'
                        : 'var(--color-surface-container-lowest)',
                    }}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <SubjectPill tone={lesson.subjectTone} className="px-3 py-1 text-[18px]">
                    {lesson.subjectLabel}
                  </SubjectPill>
                  <span className="mt-1 block truncate text-[18px] font-bold">
                    {lesson.title}
                  </span>
                  <span className="block text-[18px] font-semibold text-on-surface-muted">
                    {t('questMap.todaysLessons.duration', {
                      minutes: lesson.durationMinutes,
                    })}
                  </span>
                </span>
                {lesson.done ? (
                  <span className="text-[18px] font-bold uppercase tracking-[0.08em] text-primary-deep">
                    ✓ {t('questMap.todaysLessons.done')}
                  </span>
                ) : null}
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
