import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getEditableFreeResponseDraft } from '@/features/teacher-activities/server'

const notFoundError = new Error('NEXT_NOT_FOUND')
const notFoundMock = vi.fn(() => {
  throw notFoundError
})

vi.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
}))

vi.mock('@/features/teacher-activities/server', () => ({
  getEditableFreeResponseDraft: vi.fn(),
}))

const getEditableFreeResponseDraftMock = vi.mocked(getEditableFreeResponseDraft)

import EditActivityPage from './page'

beforeEach(() => {
  notFoundMock.mockClear()
  getEditableFreeResponseDraftMock.mockReset()
})

describe('/teacher/activities/[activityId]/edit page', () => {
  it('loads an owned free-response draft into the editor', async () => {
    getEditableFreeResponseDraftMock.mockResolvedValue({
      activityId: 'activity-1',
      status: 'draft',
      title: 'Povestea personajului meu',
      prompt: 'Desenează personajul și povestește.',
      allowedTools: { text: true, drawing: true, voice: false },
      shareWithFamilyOnApproval: true,
      resources: [{ title: 'Model', url: 'https://example.test/model' }],
    })

    const ui = await EditActivityPage({ params: Promise.resolve({ activityId: 'activity-1' }) })
    render(ui)

    expect(getEditableFreeResponseDraftMock).toHaveBeenCalledWith('activity-1')
    expect(screen.getByRole('heading', { level: 1, name: /creează activitate/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/titlu activitate/i)).toHaveValue('Povestea personajului meu')
    expect(screen.getByLabelText(/instrucțiuni pentru elevi/i)).toHaveValue('Desenează personajul și povestește.')
    expect(screen.getByRole('checkbox', { name: /text/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /desen/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /voce/i })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /familiei după aprobare/i })).toBeChecked()
    expect(screen.getByLabelText(/titlu resursă 1/i)).toHaveValue('Model')
    expect(screen.getByLabelText(/link resursă 1/i)).toHaveValue('https://example.test/model')
    expect(screen.getByRole('button', { name: /salvează modificările/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /joc interactiv/i })).not.toBeInTheDocument()
  })

  it('returns not found for missing or non-editable activities', async () => {
    getEditableFreeResponseDraftMock.mockResolvedValue(null)

    await expect(EditActivityPage({ params: Promise.resolve({ activityId: 'missing-1' }) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    )
  })
})
