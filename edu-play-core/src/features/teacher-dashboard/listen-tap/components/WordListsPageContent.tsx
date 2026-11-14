'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useTranslation } from 'react-i18next'

import { Icon } from '@/shared/components/ui/Icon'
import { LanguageSwitcher } from '@/shared/components/i18n/LanguageSwitcher'
import {
  Button,
  DataTable,
  Pill,
  SectionHeader,
  type DataTableColumn,
} from '@/shared/components/ui/kit'
import { ROUTES } from '@/shared/lib/constants'
import { formatDateTime } from '@/lib/i18n/formatters'

import type { ListenTapWordList } from '../types'

interface WordListsPageContentProps {
  profile: {
    id: string
    full_name: string
    email: string
    role: string
  }
  initialWordLists: ListenTapWordList[]
}

export function WordListsPageContent({
  profile,
  initialWordLists,
}: WordListsPageContentProps) {
  const { t } = useTranslation('teacher')
  const router = useRouter()
  const [isCreating, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [wordLists] = useState<ListenTapWordList[]>(initialWordLists)

  const handleCreate = () => {
    setError(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/v1/teacher/listen-tap/word-lists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: t('listenTap.untitledList'), language: 'ro' }),
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error?.message ?? 'Failed to create word list')
        }

        const json = (await response.json()) as { data: ListenTapWordList }
        router.push(ROUTES.TEACHER.LISTEN_TAP_LIST(json.data.id))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create word list')
      }
    })
  }

  const columns: DataTableColumn<ListenTapWordList>[] = [
    {
      key: 'name',
      header: t('listenTap.table.name'),
      cell: (row) => (
        <span className="font-bold text-on-surface">{row.name}</span>
      ),
    },
    {
      key: 'wordCount',
      header: t('listenTap.table.wordCount'),
      align: 'right',
      cell: (row) => (
        <Pill tone="neutral">
          {t('listenTap.table.wordCountValue', { count: row.words.length })}
        </Pill>
      ),
    },
    {
      key: 'language',
      header: t('listenTap.table.language'),
      align: 'center',
      cell: (row) => (
        <span className="text-sm uppercase tracking-wide text-on-surface-variant">
          {row.language}
        </span>
      ),
    },
    {
      key: 'updatedAt',
      header: t('listenTap.table.updatedAt'),
      align: 'right',
      hideOnMobile: true,
      cell: (row) => (
        <span className="text-sm text-on-surface-variant">
          {formatDateTime(row.updatedAt)}
        </span>
      ),
    },
  ]

  return (
    <div className="flex h-full min-h-screen flex-col bg-surface text-on-surface">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b-2 border-outline-variant bg-surface-container-lowest px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="font-headline text-lg font-bold leading-tight tracking-tight">
            <span className="text-on-surface">edu</span>
            <span className="text-primary">Play</span>
            <span className="ml-2 font-medium text-on-surface-variant">
              · {t('listenTap.topBarTitle')}
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher tone="onSurface" />
          <span className="text-sm font-bold text-on-surface">{profile.full_name}</span>
        </div>
      </header>

      <div className="p-6 lg:p-10">
        <div className="mx-auto max-w-[1440px] space-y-8">
          <SectionHeader
            eyebrow={t('listenTap.header.eyebrow')}
            title={t('listenTap.header.title')}
            subtitle={t('listenTap.header.subtitle')}
            action={
              <Button
                variant="primary"
                size="md"
                onClick={handleCreate}
                disabled={isCreating}
                data-testid="listen-tap-create-list"
              >
                <Icon name="Plus" size="md" weight="bold" />
                {isCreating
                  ? t('listenTap.header.creatingCta')
                  : t('listenTap.header.newListCta')}
              </Button>
            }
          />

          {error ? (
            <p
              role="alert"
              className="rounded-2xl border-2 border-error bg-error-container px-4 py-3 text-sm text-on-error-container"
            >
              {error}
            </p>
          ) : null}

          <DataTable<ListenTapWordList>
            columns={columns}
            rows={wordLists}
            getRowKey={(row) => row.id}
            onRowClick={(row) => router.push(ROUTES.TEACHER.LISTEN_TAP_LIST(row.id))}
            caption={t('listenTap.table.caption')}
            empty={{
              icon: 'BookOpen',
              title: t('listenTap.empty.title'),
              description: t('listenTap.empty.description'),
              action: (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleCreate}
                  disabled={isCreating}
                >
                  <Icon name="Plus" size="md" weight="bold" />
                  {t('listenTap.header.newListCta')}
                </Button>
              ),
            }}
          />
        </div>
      </div>
    </div>
  )
}
