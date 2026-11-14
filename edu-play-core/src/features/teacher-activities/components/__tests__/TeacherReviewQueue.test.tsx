import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MantineProvider } from '@mantine/core'

import { ToastProvider } from '@/shared/components/ui/kit'
import { TeacherReviewQueue } from '../TeacherReviewQueue'
import type { TeacherReviewQueueItem } from '../../types'

vi.mock('../../actions', () => ({
  reviewActivitySubmission: vi.fn().mockResolvedValue({ success: true }),
}))

function renderQueue(items: TeacherReviewQueueItem[]) {
  return render(
    <MantineProvider>
      <ToastProvider>
        <TeacherReviewQueue items={items} />
      </ToastProvider>
    </MantineProvider>,
  )
}

const item: TeacherReviewQueueItem = {
  submissionId: '11111111-1111-4111-8111-111111111111',
  assignmentId: 'assignment-1',
  activityId: 'activity-1',
  activityTitle: 'Povestea mea',
  studentId: 'student-1',
  studentName: 'Ana Ionescu',
  studentUsername: 'ana',
  className: 'Clasa Fluturilor',
  attemptNumber: 2,
  submittedAt: '2026-05-20T10:00:00.000Z',
  text: 'Am desenat o casă.',
  drawingArtifactId: 'artifact-drawing',
  drawingUrl: 'https://signed.test/drawing.png',
  voiceArtifactId: 'artifact-voice',
  voiceUrl: 'https://signed.test/voice.webm',
  voiceDurationMs: 1200,
  shareWithFamilyOnApproval: true,
}

describe('<TeacherReviewQueue />', () => {
  it('shows a focused empty state when there is nothing to review', () => {
    renderQueue([])

    expect(screen.getByRole('heading', { name: /nimic de verificat/i })).toBeInTheDocument()
    expect(screen.getByText(/răspunsurile trimise vor apărea aici/i)).toBeInTheDocument()
  })

  it('renders submitted text, media previews, and approve/revision controls', () => {
    renderQueue([item])

    expect(screen.getByRole('heading', { name: /povestea mea/i })).toBeInTheDocument()
    expect(screen.getByText(/ana ionescu/i)).toBeInTheDocument()
    expect(screen.getByText(/clasa fluturilor/i)).toBeInTheDocument()
    expect(screen.getByText('Am desenat o casă.')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /desen trimis/i })).toHaveAttribute('src', 'https://signed.test/drawing.png')
    expect(screen.getByLabelText(/înregistrare audio trimisă/i)).toHaveAttribute('src', 'https://signed.test/voice.webm')
    expect(screen.getByRole('button', { name: /aprobă/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/comentariu pentru familie/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cere revizuire/i })).toBeInTheDocument()
  })

  it('renders review comment controls as Mantine textareas with form field names', () => {
    renderQueue([item])

    const familyComment = screen.getByLabelText(/comentariu pentru familie/i)
    const feedback = screen.getByLabelText(/feedback pentru elev/i)

    expect(familyComment).toHaveClass('mantine-Textarea-input')
    expect(familyComment).toHaveAttribute('name', 'familyComment')
    expect(feedback).toHaveClass('mantine-Textarea-input')
    expect(feedback).toHaveAttribute('name', 'feedback')
    expect(feedback).toBeRequired()
  })
})
