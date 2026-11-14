'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useTranslation } from 'react-i18next'

import { Icon } from '@/shared/components/ui/Icon'
import { LanguageSwitcher } from '@/shared/components/i18n/LanguageSwitcher'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  SectionHeader,
  TextField,
} from '@/shared/components/ui/kit'
import { ROUTES } from '@/shared/lib/constants'
import { formatDateTime } from '@/lib/i18n/formatters'

import type { ListenTapWordEntry, ListenTapWordList } from '../types'

interface WordListEditorContentProps {
  profile: {
    id: string
    full_name: string
    email: string
    role: string
  }
  wordList: ListenTapWordList
}

const MAX_WORDS = 50

function emptyWord(): ListenTapWordEntry {
  return { word: '', promptAudioId: '', imageAssetId: '' }
}

export function WordListEditorContent({ profile, wordList }: WordListEditorContentProps) {
  const { t } = useTranslation('teacher')
  const router = useRouter()

  const [name, setName] = useState(wordList.name)
  const [words, setWords] = useState<ListenTapWordEntry[]>(
    wordList.words.length > 0 ? wordList.words : [emptyWord()],
  )
  const [savedAt, setSavedAt] = useState<string>(wordList.updatedAt)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isSaving, startSaving] = useTransition()
  const [isDeleting, startDeleting] = useTransition()

  const updateWord = (index: number, patch: Partial<ListenTapWordEntry>) => {
    setWords((current) =>
      current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    )
  }

  const removeWord = (index: number) => {
    setWords((current) => {
      if (current.length <= 1) return [emptyWord()]
      return current.filter((_, i) => i !== index)
    })
  }

  const moveWord = (index: number, direction: -1 | 1) => {
    setWords((current) => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      const copy = [...current]
      const [item] = copy.splice(index, 1)
      if (item) copy.splice(target, 0, item)
      return copy
    })
  }

  const addWord = () => {
    setWords((current) => {
      if (current.length >= MAX_WORDS) return current
      return [...current, emptyWord()]
    })
  }

  const handleSave = () => {
    setError(null)

    const trimmedName = name.trim()
    if (trimmedName.length === 0) {
      setError(t('listenTap.editor.errors.nameRequired'))
      return
    }

    const cleanedWords: ListenTapWordEntry[] = words
      .map((entry) => ({
        word: entry.word.trim(),
        promptAudioId: (entry.promptAudioId ?? '').trim(),
        imageAssetId: (entry.imageAssetId ?? '').trim() || undefined,
      }))
      .filter((entry) => entry.word.length > 0)

    startSaving(async () => {
      try {
        const response = await fetch(
          `/api/v1/teacher/listen-tap/word-lists/${wordList.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: trimmedName, words: cleanedWords }),
          },
        )

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error?.message ?? 'Failed to save word list')
        }

        const json = (await response.json()) as { data: ListenTapWordList }
        setName(json.data.name)
        setWords(json.data.words.length > 0 ? json.data.words : [emptyWord()])
        setSavedAt(json.data.updatedAt)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save word list')
      }
    })
  }

  const handleDelete = () => {
    setConfirmDelete(false)
    setError(null)
    startDeleting(async () => {
      try {
        const response = await fetch(
          `/api/v1/teacher/listen-tap/word-lists/${wordList.id}`,
          { method: 'DELETE' },
        )

        if (response.status !== 204 && !response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error?.message ?? 'Failed to delete word list')
        }

        router.push(ROUTES.TEACHER.LISTEN_TAP)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete word list')
      }
    })
  }

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
        <div className="mx-auto max-w-[960px] space-y-8">
          <div className="flex items-center gap-2 text-sm">
            <Button
              href={ROUTES.TEACHER.LISTEN_TAP}
              variant="ghost"
              size="sm"
              data-testid="listen-tap-back"
            >
              <Icon name="ArrowLeft" size="sm" weight="bold" />
              {t('listenTap.editor.backCta')}
            </Button>
          </div>

          <SectionHeader
            eyebrow={t('listenTap.editor.eyebrow')}
            title={t('listenTap.editor.title')}
            subtitle={t('listenTap.editor.subtitle', {
              updatedAt: formatDateTime(savedAt),
            })}
          />

          {error ? (
            <p
              role="alert"
              className="rounded-2xl border-2 border-error bg-error-container px-4 py-3 text-sm text-on-error-container"
            >
              {error}
            </p>
          ) : null}

          <Card>
            <CardHeader>
              <h2 className="font-headline text-xl font-bold text-on-surface">
                {t('listenTap.editor.detailsTitle')}
              </h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <TextField
                label={t('listenTap.editor.nameLabel')}
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                required
                data-testid="listen-tap-name-input"
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-headline text-xl font-bold text-on-surface">
                {t('listenTap.editor.wordsTitle')}
              </h2>
              <p className="text-sm text-on-surface-variant">
                {t('listenTap.editor.wordsSubtitle', {
                  count: words.length,
                  max: MAX_WORDS,
                })}
              </p>
            </CardHeader>
            <CardBody className="space-y-4">
              <ul className="m-0 list-none p-0 space-y-3" data-testid="listen-tap-words">
                {words.map((entry, index) => (
                  <li
                    key={`${index}`}
                    className="grid grid-cols-1 gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,2fr)_auto]"
                    data-testid="listen-tap-word-row"
                  >
                    <TextField
                      label={t('listenTap.editor.wordLabel', { index: index + 1 })}
                      value={entry.word}
                      onChange={(event) => updateWord(index, { word: event.target.value })}
                      maxLength={80}
                      data-testid={`listen-tap-word-${index}`}
                    />
                    <TextField
                      label={t('listenTap.editor.promptAudioLabel')}
                      value={entry.promptAudioId ?? ''}
                      onChange={(event) =>
                        updateWord(index, { promptAudioId: event.target.value })
                      }
                      maxLength={200}
                      helper={t('listenTap.editor.promptAudioHelper')}
                    />
                    <TextField
                      label={t('listenTap.editor.imageAssetLabel')}
                      value={entry.imageAssetId ?? ''}
                      onChange={(event) =>
                        updateWord(index, { imageAssetId: event.target.value })
                      }
                      maxLength={200}
                      helper={t('listenTap.editor.imageAssetHelper')}
                    />
                    <div className="flex items-end justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveWord(index, -1)}
                        disabled={index === 0}
                        aria-label={t('listenTap.editor.moveUpAriaLabel')}
                      >
                        <Icon name="CaretUp" size="sm" weight="bold" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveWord(index, 1)}
                        disabled={index === words.length - 1}
                        aria-label={t('listenTap.editor.moveDownAriaLabel')}
                      >
                        <Icon name="CaretDown" size="sm" weight="bold" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeWord(index)}
                        aria-label={t('listenTap.editor.removeWordAriaLabel')}
                        data-testid={`listen-tap-remove-word-${index}`}
                      >
                        <Icon name="Trash" size="sm" weight="bold" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>

              <Button
                variant="secondary"
                size="md"
                onClick={addWord}
                disabled={words.length >= MAX_WORDS}
                data-testid="listen-tap-add-word"
              >
                <Icon name="Plus" size="md" weight="bold" />
                {t('listenTap.editor.addWordCta')}
              </Button>
            </CardBody>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="md"
              onClick={() => setConfirmDelete(true)}
              disabled={isDeleting}
              data-testid="listen-tap-delete-list"
            >
              <Icon name="Trash" size="md" weight="bold" />
              {t('listenTap.editor.deleteListCta')}
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                href={ROUTES.TEACHER.LISTEN_TAP_PREVIEW(wordList.id)}
                variant="secondary"
                size="md"
                disabled={isSaving || isDeleting}
                data-testid="listen-tap-preview-list"
              >
                <Icon name="Play" size="md" weight="bold" />
                {t('listenTap.editor.previewCta')}
              </Button>

              <Button
                variant="primary"
                size="md"
                onClick={handleSave}
                disabled={isSaving || isDeleting}
                data-testid="listen-tap-save-list"
              >
                <Icon name="Check" size="md" weight="bold" />
                {isSaving
                  ? t('listenTap.editor.savingCta')
                  : t('listenTap.editor.saveCta')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={t('listenTap.editor.deleteConfirm.title')}
        body={t('listenTap.editor.deleteConfirm.body', { name: wordList.name })}
        confirmLabel={t('listenTap.editor.deleteConfirm.confirm')}
        cancelLabel={t('listenTap.editor.deleteConfirm.cancel')}
        destructive
        icon="Trash"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
