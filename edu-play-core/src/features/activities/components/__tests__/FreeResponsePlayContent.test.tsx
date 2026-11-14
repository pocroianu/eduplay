import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FreeResponsePlayContent } from '../FreeResponsePlayContent'
import { cleanupFreeResponseArtifacts, recordFreeResponseArtifact } from '../../actions/record-free-response-artifact'

vi.mock('../../actions/record-free-response-artifact', () => ({
  cleanupFreeResponseArtifacts: vi.fn(),
  recordFreeResponseArtifact: vi.fn(),
}))

const activityId = '33333333-3333-4333-8333-333333333333'
const versionId = '44444444-4444-4444-8444-444444444444'
const assignmentId = '11111111-1111-4111-8111-111111111111'

const config = {
  prompt: 'Desenează și povestește ce ai creat.',
  allowedTools: { text: true, drawing: true, voice: true },
  shareWithFamilyOnApproval: false,
  resources: [
    { title: 'Cântec de inspirație', url: 'https://example.test/cantec' },
    { title: 'Imagine model', url: 'https://example.test/model' },
  ],
}

class FakeMediaRecorder {
  static isTypeSupported = vi.fn(() => true)
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  state: 'inactive' | 'recording' = 'inactive'

  constructor(_stream: MediaStream, public readonly options: { mimeType?: string } = {}) {}

  start() {
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' }) })
    this.onstop?.()
  }
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    clearRect: vi.fn(),
  } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,drawn')
  Object.defineProperty(global.navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
  })
  Object.defineProperty(globalThis, 'MediaRecorder', {
    configurable: true,
    value: FakeMediaRecorder,
  })
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:recording')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.mocked(cleanupFreeResponseArtifacts).mockReset()
  vi.mocked(cleanupFreeResponseArtifacts).mockResolvedValue({ success: true })
  vi.mocked(recordFreeResponseArtifact).mockReset()
  vi.mocked(recordFreeResponseArtifact)
    .mockResolvedValueOnce({ success: true, data: { artifactId: '77777777-7777-4777-8777-777777777777' } })
    .mockResolvedValueOnce({ success: true, data: { artifactId: '88888888-8888-4888-8888-888888888888' } })
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('<FreeResponsePlayContent />', () => {
  it('lets teachers try the enabled response tools in preview while keeping submit disabled', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    render(
      <FreeResponsePlayContent
        title="Povestea mea"
        backUrl="/teacher/activities"
        mode="preview"
        config={config}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Povestea mea' })).toBeInTheDocument()
    expect(screen.getByText('Desenează și povestește ce ai creat.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /cântec de inspirație/i })).toHaveAttribute('href', 'https://example.test/cantec')
    expect(screen.getByRole('link', { name: /imagine model/i })).toHaveAttribute('href', 'https://example.test/model')
    expect(screen.getByText(/mod elev/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /adaugă text/i }))
    const textbox = screen.getByRole('textbox', { name: /răspuns text/i })
    expect(textbox).toBeEnabled()
    await userEvent.type(textbox, 'Probă în previzualizare')

    await userEvent.click(screen.getByRole('button', { name: /desenează/i }))
    const canvas = screen.getByLabelText(/spațiu de desen/i)
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 30, clientY: 30 })
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 30, clientY: 30 })
    expect(screen.getByRole('img', { name: /previzualizare desen/i })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /înregistrează/i }))
    await userEvent.click(screen.getByRole('button', { name: /pornește înregistrarea/i }))
    await userEvent.click(screen.getByRole('button', { name: /oprește înregistrarea/i }))
    expect(await screen.findByText(/înregistrare pregătită/i)).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /trimite/i })).toBeDisabled()
    expect(screen.getByText(/trimiterea este dezactivată în previzualizare/i)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('creates a lazy draft on first edit and submits the latest text response', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => ({ data: { id: 'submission-id' } }) } as Response)

    render(
      <FreeResponsePlayContent
        title="Povestea mea"
        backUrl="/student"
        mode="play"
        config={{ ...config, allowedTools: { text: true, drawing: false, voice: false } }}
        activityId={activityId}
        versionId={versionId}
        assignmentId={assignmentId}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /adaugă text/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      intent: 'start',
      assignmentId,
      activityId,
      versionId,
      response: {},
    })

    await userEvent.type(screen.getByRole('textbox', { name: /răspuns text/i }), 'Răspunsul meu')
    await userEvent.click(screen.getByRole('button', { name: /trimite/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      intent: 'submit',
      assignmentId,
      activityId,
      versionId,
      response: { text: 'Răspunsul meu' },
    })
    expect(await screen.findByText(/răspuns trimis/i)).toBeInTheDocument()
  })

  it('keeps drawing pointer moves off React state until the stroke finishes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ data: { id: 'submission-id' } }) } as Response)

    render(
      <FreeResponsePlayContent
        title="Povestea mea"
        backUrl="/student"
        mode="play"
        config={{ ...config, allowedTools: { text: false, drawing: true, voice: false } }}
        activityId={activityId}
        versionId={versionId}
        assignmentId={assignmentId}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /desenează/i }))
    const canvas = screen.getByLabelText(/spațiu de desen/i)
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 10 })
    for (let index = 0; index < 50; index += 1) {
      fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 10 + index, clientY: 20 + index })
    }

    expect(HTMLCanvasElement.prototype.toDataURL).not.toHaveBeenCalled()
    expect(screen.queryByRole('img', { name: /previzualizare desen/i })).not.toBeInTheDocument()

    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 60, clientY: 70 })

    expect(await screen.findByRole('img', { name: /previzualizare desen/i })).toBeInTheDocument()
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledTimes(1)
  })

  it('submits combined text, drawing state, drawing artifact, and one final voice artifact', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => ({ data: { id: 'submission-id' } }) } as Response)

    render(
      <FreeResponsePlayContent
        title="Povestea mea"
        backUrl="/student"
        mode="play"
        config={config}
        activityId={activityId}
        versionId={versionId}
        assignmentId={assignmentId}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /adaugă text/i }))
    await userEvent.type(screen.getByRole('textbox', { name: /răspuns text/i }), 'Am desenat o casă')

    await userEvent.click(screen.getByRole('button', { name: /desenează/i }))
    const canvas = screen.getByLabelText(/spațiu de desen/i)
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 30, clientY: 30 })
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 30, clientY: 30 })
    expect(screen.getByRole('img', { name: /previzualizare desen/i })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /înregistrează/i }))
    await userEvent.click(screen.getByRole('button', { name: /pornește înregistrarea/i }))
    await userEvent.click(screen.getByRole('button', { name: /oprește înregistrarea/i }))
    await screen.findByText(/înregistrare pregătită/i)
    await userEvent.click(screen.getByRole('button', { name: /reînregistrează/i }))
    await userEvent.click(screen.getByRole('button', { name: /pornește înregistrarea/i }))
    await userEvent.click(screen.getByRole('button', { name: /oprește înregistrarea/i }))

    await userEvent.click(screen.getByRole('button', { name: /trimite/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(recordFreeResponseArtifact).toHaveBeenCalledTimes(2)
    expect(recordFreeResponseArtifact).toHaveBeenNthCalledWith(1, expect.objectContaining({ kind: 'drawing', assignmentId, activityId, versionId }))
    expect(recordFreeResponseArtifact).toHaveBeenNthCalledWith(2, expect.objectContaining({ kind: 'audio', assignmentId, activityId, versionId }))

    const submissionBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))
    expect(submissionBody.response).toMatchObject({
      text: 'Am desenat o casă',
      drawing: {
        artifactId: '77777777-7777-4777-8777-777777777777',
      },
      voice: {
        artifactId: '88888888-8888-4888-8888-888888888888',
        mime: 'audio/webm',
      },
      artifacts: [
        '77777777-7777-4777-8777-777777777777',
        '88888888-8888-4888-8888-888888888888',
      ],
    })
    expect(submissionBody.response.drawing.state.strokes).toHaveLength(1)
  })

  it('cleans up uploaded artifacts when final submission fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: 'submission-id' } }) } as Response)
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: { message: 'failed' } }) } as Response)

    render(
      <FreeResponsePlayContent
        title="Povestea mea"
        backUrl="/student"
        mode="play"
        config={{ ...config, allowedTools: { text: false, drawing: true, voice: false } }}
        activityId={activityId}
        versionId={versionId}
        assignmentId={assignmentId}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /desenează/i }))
    const canvas = screen.getByLabelText(/spațiu de desen/i)
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 10 })
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 20, clientY: 20 })
    await userEvent.click(screen.getByRole('button', { name: /trimite/i }))

    await waitFor(() => expect(cleanupFreeResponseArtifacts).toHaveBeenCalledWith({
      assignmentId,
      artifactIds: ['77777777-7777-4777-8777-777777777777'],
    }))
    expect(await screen.findByText(/nu am putut salva răspunsul/i)).toBeInTheDocument()
  })

  it('restores local text and drawing drafts and locks editing after submitted work exists', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ data: { id: 'submission-id' } }) } as Response)
    const { unmount } = render(
      <FreeResponsePlayContent
        title="Povestea mea"
        backUrl="/student"
        mode="play"
        config={config}
        activityId={activityId}
        versionId={versionId}
        assignmentId={assignmentId}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /adaugă text/i }))
    await userEvent.type(screen.getByRole('textbox', { name: /răspuns text/i }), 'Ciornă salvată')
    await userEvent.click(screen.getByRole('button', { name: /desenează/i }))
    fireEvent.pointerDown(screen.getByLabelText(/spațiu de desen/i), { pointerId: 1, clientX: 10, clientY: 10 })
    fireEvent.pointerUp(screen.getByLabelText(/spațiu de desen/i), { pointerId: 1, clientX: 20, clientY: 20 })
    unmount()

    const restored = render(
      <FreeResponsePlayContent
        title="Povestea mea"
        backUrl="/student"
        mode="play"
        config={config}
        activityId={activityId}
        versionId={versionId}
        assignmentId={assignmentId}
      />,
    )

    expect(screen.getByRole('textbox', { name: /răspuns text/i })).toHaveValue('Ciornă salvată')
    expect(screen.getByRole('img', { name: /previzualizare desen/i })).toBeInTheDocument()
    restored.unmount()

    render(
      <FreeResponsePlayContent
        title="Povestea trimisă"
        backUrl="/student"
        mode="play"
        config={config}
        activityId={activityId}
        versionId={versionId}
        assignmentId={assignmentId}
        initialSubmission={{
          status: 'submitted',
          latestResponse: { text: 'Trimis deja', drawing: { state: { strokes: [] } } },
        }}
      />,
    )

    expect(screen.getByRole('textbox', { name: /răspuns text/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /trimite/i })).toBeDisabled()
    expect(screen.getByText(/răspuns trimis/i)).toBeInTheDocument()
  })
})
