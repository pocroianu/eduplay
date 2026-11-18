'use client'

import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'

import { GameEmbed } from '@/features/games'
import { ROUTES } from '@/shared/lib/constants'

interface WordListPreviewContentProps {
  wordListId: string
  wordListName: string
  wordListLanguage: 'ro' | 'en'
}

export function WordListPreviewContent({
  wordListId,
  wordListName,
  wordListLanguage,
}: WordListPreviewContentProps) {
  const router = useRouter()
  const { t } = useTranslation('teacher')

  const configUrl = `/api/v1/teacher/listen-tap/word-lists/${wordListId}/game-config`
  const gameUrl = `/api/v1/renderer-proxy/activity-renderers/listen-tap/index.html?lang=${wordListLanguage}`

  const handleExit = () => {
    router.push(ROUTES.TEACHER.LISTEN_TAP_LIST(wordListId))
  }

  return (
    <div
      className="flex h-screen w-screen flex-col bg-surface text-on-surface"
      aria-label={t('listenTap.preview.pageLabel', { name: wordListName })}
    >
      <header className="flex shrink-0 items-center justify-between border-b-2 border-outline-variant bg-surface-container-lowest px-6 py-3">
        <h1 className="font-headline text-lg font-bold leading-tight">
          {t('listenTap.preview.title', { name: wordListName })}
        </h1>
        <span className="text-sm text-on-surface-variant">
          {t('listenTap.preview.subtitle')}
        </span>
      </header>
      <div className="relative flex-1">
        <GameEmbed
          gameUrl={gameUrl}
          configUrl={configUrl}
          playerName={wordListName}
          onRequestExit={handleExit}
        />
      </div>
    </div>
  )
}
