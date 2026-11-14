'use client'

import { useTransition } from 'react'
import { Textarea } from '@mantine/core'

import { formatDateTime } from '@/lib/i18n/formatters'
import { Button, Card, Pill, useToast } from '@/shared/components/ui/kit'
import { Icon } from '@/shared/components/ui/Icon'
import { reviewActivitySubmission } from '../actions'
import type { TeacherReviewQueueItem } from '../types'

interface TeacherReviewQueueProps {
  items: TeacherReviewQueueItem[]
}

function submittedLabel(date: string | null) {
  return date ? `Trimis pe ${formatDateTime(date)}` : 'Trimis recent'
}

function durationLabel(durationMs: number | null) {
  if (durationMs == null) return null
  const seconds = Math.max(0, Math.round(durationMs / 1000))
  return `${seconds}s`
}

const reviewTextareaStyles = {
  label: {
    color: 'var(--color-primary-deep)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.12em',
    marginBottom: 4,
    textTransform: 'uppercase' as const,
  },
  input: {
    backgroundColor: 'var(--color-surface-container-lowest)',
    borderColor: 'var(--color-outline-variant)',
    color: 'var(--color-on-surface)',
    fontSize: 14,
    fontWeight: 600,
    minHeight: 56,
    padding: '8px 12px',
    resize: 'vertical' as const,
  },
} as const

function ReviewActions({ submissionId, shareWithFamilyOnApproval }: { submissionId: string; shareWithFamilyOnApproval: boolean }) {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function handleApprove(formData: FormData) {
    startTransition(async () => {
      const familyComment = String(formData.get('familyComment') ?? '').trim()
      const result = await reviewActivitySubmission({
        submissionId,
        decision: 'approved',
        familyComment: familyComment || undefined,
      })
      if (result.success) {
        toast({ message: 'Răspunsul a fost aprobat.', variant: 'success' })
      } else {
        toast({ message: result.error ?? 'Nu am putut aproba răspunsul.', variant: 'error' })
      }
    })
  }

  function handleRequestRevision(formData: FormData) {
    const feedback = String(formData.get('feedback') ?? '').trim()
    if (!feedback) {
      toast({ message: 'Scrie un feedback înainte să ceri revizuire.', variant: 'error' })
      return
    }
    startTransition(async () => {
      const result = await reviewActivitySubmission({
        submissionId,
        decision: 'needs_revision',
        feedback,
      })
      if (result.success) {
        toast({ message: 'Cererea de revizuire a fost trimisă.', variant: 'success' })
      } else {
        toast({ message: result.error ?? 'Nu am putut trimite cererea.', variant: 'error' })
      }
    })
  }

  return (
    <div className="grid gap-3 border-t border-outline-variant bg-surface px-4 py-4 md:px-5 lg:grid-cols-[minmax(240px,auto)_1fr]">
      <form action={handleApprove} className="flex flex-col gap-3 rounded-md border border-primary-soft bg-primary-wash p-3">
        {shareWithFamilyOnApproval ? (
          <Textarea
            name="familyComment"
            rows={2}
            label="Comentariu pentru familie"
            placeholder="Opțional: ce să vadă familia la aprobare."
            styles={reviewTextareaStyles}
          />
        ) : null}
        <Button
          type="submit"
          disabled={isPending}
          variant="primary"
          size="md"
          fullWidth
        >
          <Icon name="CheckCircle" size={18} weight="bold" />
          {isPending ? 'Se procesează…' : 'Aprobă'}
        </Button>
      </form>

      <form action={handleRequestRevision} className="flex flex-col gap-3 rounded-md border border-outline-variant bg-surface-container-lowest p-3 sm:flex-row">
        <Textarea
          name="feedback"
          required
          rows={2}
          aria-label="Feedback pentru elev"
          placeholder="Scrie ce să îmbunătățească elevul."
          className="min-w-0 flex-1"
          styles={reviewTextareaStyles}
        />
        <Button
          type="submit"
          disabled={isPending}
          variant="secondary"
          size="md"
          className="self-stretch"
        >
          <Icon name="ArrowCounterClockwise" size={18} weight="bold" />
          {isPending ? 'Se trimite…' : 'Cere revizuire'}
        </Button>
      </form>
    </div>
  )
}

function ReviewQueueItemCard({ item }: { item: TeacherReviewQueueItem }) {
  const voiceDuration = durationLabel(item.voiceDurationMs)

  return (
    <Card padding="none" shadow={false} className="overflow-hidden border border-outline-variant bg-surface-container-lowest">
      <div className="flex flex-col gap-4 p-4 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-gold-soft text-gold-deep">
              <Icon name="ClipboardText" size={20} weight="bold" />
            </span>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap gap-2">
                <Pill tone="sun">În așteptare</Pill>
                <Pill tone="neutral">Încercarea {item.attemptNumber}</Pill>
                {item.className ? <Pill tone="lime">{item.className}</Pill> : null}
              </div>
              <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface md:text-2xl">{item.activityTitle}</h2>
              <p className="text-sm font-semibold text-on-surface-variant">
                {item.studentName} <span className="text-on-surface-muted">(@{item.studentUsername})</span>
              </p>
            </div>
          </div>
          <p className="text-sm font-bold text-on-surface-variant">{submittedLabel(item.submittedAt)}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="rounded-md border border-outline-variant bg-surface p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary-deep">Răspuns</p>
            {item.text ? (
              <p className="mt-3 whitespace-pre-wrap text-base font-semibold leading-7 text-on-surface">{item.text}</p>
            ) : (
              <p className="mt-3 text-sm font-semibold text-on-surface-variant">Elevul a trimis media fără text.</p>
            )}
          </div>

          <div className="space-y-3">
            {item.drawingUrl ? (
              <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.drawingUrl} alt="Desen trimis" className="h-40 w-full rounded-md object-contain" />
              </div>
            ) : null}

            {item.voiceUrl ? (
              <div className="rounded-md border border-outline-variant bg-gold-soft p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-gold-deep">
                  <Icon name="SpeakerSimpleHigh" size={18} aria-hidden />
                  Înregistrare audio{voiceDuration ? ` · ${voiceDuration}` : ''}
                </div>
                <audio aria-label="Înregistrare audio trimisă" controls src={item.voiceUrl} className="w-full" />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ReviewActions submissionId={item.submissionId} shareWithFamilyOnApproval={item.shareWithFamilyOnApproval} />
    </Card>
  )
}

export function TeacherReviewQueue({ items }: TeacherReviewQueueProps) {
  if (items.length === 0) {
    return (
      <Card padding="lg" shadow={false} className="flex flex-col items-center justify-center gap-3 border border-outline-variant bg-surface-container-lowest py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-md bg-primary-soft text-primary-deep">
          <Icon name="CheckCircle" size={32} aria-hidden />
        </span>
        <h2 className="text-2xl font-bold text-on-surface">Nimic de verificat</h2>
        <p className="max-w-xl text-sm font-semibold leading-6 text-on-surface-variant">
          Răspunsurile trimise vor apărea aici imediat ce elevii finalizează o activitate cu răspuns liber.
        </p>
      </Card>
    )
  }

  return (
    <section className="space-y-4" aria-label="Răspunsuri de verificat">
      <Card padding="none" shadow={false} className="border border-outline-variant bg-surface-container-lowest">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-sm bg-primary text-on-primary">
              <Icon name="BookOpen" size={18} weight="bold" />
            </span>
            <p className="text-sm font-bold text-on-surface">
              {items.length === 1
                ? '1 răspuns de verificat'
                : `${items.length} răspunsuri de verificat`}
            </p>
          </div>
          <Pill tone="sun">{items.length}</Pill>
        </div>
      </Card>
      {items.map((item) => (
        <ReviewQueueItemCard key={item.submissionId} item={item} />
      ))}
    </section>
  )
}
