import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { saveFreeResponseDraft, updateFreeResponseDraft } from '../../actions'
import { CreateActivityWizard } from '../CreateActivityWizard'

vi.mock('../../actions', () => ({
  saveFreeResponseDraft: vi.fn(),
  updateFreeResponseDraft: vi.fn(),
}))

const saveFreeResponseDraftMock = vi.mocked(saveFreeResponseDraft)
const updateFreeResponseDraftMock = vi.mocked(updateFreeResponseDraft)

const interactiveTypes = [
  {
    typeId: 'listen-tap',
    displayName: 'Ascultă și apasă',
    category: 'literacy',
    rendererKey: 'listen-tap',
    rendererKind: 'iframe' as const,
    authoringMode: 'teacher-simple' as const,
  },
]

const componentSource = readFileSync(join(__dirname, '..', 'CreateActivityWizard.tsx'), 'utf8')

function renderWithProvider(element: ReactElement) {
  return render(<MantineProvider>{element}</MantineProvider>)
}

beforeEach(() => {
  saveFreeResponseDraftMock.mockReset()
  updateFreeResponseDraftMock.mockReset()
  saveFreeResponseDraftMock.mockResolvedValue({
    success: true,
    data: { id: 'activity-1' },
  })
  updateFreeResponseDraftMock.mockResolvedValue({
    success: true,
    data: { id: 'activity-1' },
  })
})

describe('CreateActivityWizard', () => {
  it('renders the Seesaw workspace, source controls, response template group, and student preview', async () => {
    const user = userEvent.setup()
    renderWithProvider(<CreateActivityWizard interactiveTypes={interactiveTypes} />)

    expect(screen.getByRole('heading', { name: /creează activitate/i })).toBeInTheDocument()
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getAllByRole('link', { name: /înapoi la activități/i })[0]).toHaveAttribute('href', '/teacher/activities')
    const sourceGroup = screen.getByRole('group', { name: /sursa activității/i })
    expect(within(sourceGroup).getByRole('button', { name: /încarcă/i })).toHaveAttribute('aria-pressed', 'true')
    expect(within(sourceGroup).getByRole('button', { name: /încarcă/i })).toBeInTheDocument()
    expect(within(sourceGroup).getByRole('button', { name: /link/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /următorul pas/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /salvează ciorna/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /creează de la zero/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /creează de la zero/i })).toHaveClass('mantine-UnstyledButton-root')
    expect(screen.getByRole('button', { name: /atașează materiale web/i })).toHaveClass(
      'mantine-UnstyledButton-root',
    )
    expect(screen.getByRole('button', { name: /joc interactiv/i })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /șablon răspuns elev/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /generează cu ai/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /previzualizare elev/i })).toBeInTheDocument()

    await user.type(screen.getByLabelText(/titlu activitate/i), 'Misiune de lectură')
    expect(screen.getByRole('heading', { name: /misiune de lectură/i })).toBeInTheDocument()

    await user.click(within(sourceGroup).getByRole('button', { name: /link/i }))
    expect(within(sourceGroup).getByRole('button', { name: /link/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText(/titlu resursă 1/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/link resursă 1/i)).toBeInTheDocument()
  })

  it('validates required free-response fields before saving', async () => {
    const user = userEvent.setup()
    renderWithProvider(<CreateActivityWizard interactiveTypes={interactiveTypes} />)

    await user.click(screen.getByRole('button', { name: /salvează ciorna/i }))

    expect(screen.getAllByRole('alert')).toHaveLength(2)
    expect(screen.getByText(/scrie un titlu/i)).toBeInTheDocument()
    expect(screen.getByText(/scrie instrucțiunile/i)).toBeInTheDocument()
    expect(saveFreeResponseDraftMock).not.toHaveBeenCalled()
  })

  it('requires at least one selected response tool', async () => {
    const user = userEvent.setup()
    renderWithProvider(<CreateActivityWizard interactiveTypes={interactiveTypes} />)

    await user.type(screen.getByLabelText(/titlu activitate/i), 'Personajul meu')
    await user.type(screen.getByLabelText(/instrucțiuni pentru elevi/i), 'Scrie și desenează personajul.')
    await user.click(screen.getByRole('checkbox', { name: /text/i }))
    await user.click(screen.getByRole('checkbox', { name: /desen/i }))
    await user.click(screen.getByRole('checkbox', { name: /voce/i }))
    await user.click(screen.getByRole('button', { name: /salvează ciorna/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/alege cel puțin un mod de răspuns/i)
    expect(saveFreeResponseDraftMock).not.toHaveBeenCalled()
  })
  it('validates attached resource links before saving', async () => {
    const user = userEvent.setup()
    renderWithProvider(<CreateActivityWizard interactiveTypes={interactiveTypes} />)

    await user.type(screen.getByLabelText(/titlu activitate/i), 'Personajul meu')
    await user.type(screen.getByLabelText(/instrucțiuni pentru elevi/i), 'Scrie și desenează personajul.')
    await user.click(screen.getByRole('button', { name: /adaugă resursă/i }))
    await user.type(screen.getByLabelText(/titlu resursă 1/i), 'Cântec')
    await user.type(screen.getByLabelText(/link resursă 1/i), 'nu-este-link')
    await user.click(screen.getByRole('button', { name: /salvează ciorna/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/link web valid/i)
    expect(saveFreeResponseDraftMock).not.toHaveBeenCalled()
  })

  it('saves a reusable free-response draft with the agreed config shape', async () => {
    const user = userEvent.setup()
    renderWithProvider(<CreateActivityWizard interactiveTypes={interactiveTypes} />)

    await user.type(screen.getByLabelText(/titlu activitate/i), 'Povestea personajului meu')
    await user.type(
      screen.getByLabelText(/instrucțiuni pentru elevi/i),
      'Desenează un personaj și spune ce puteri are.',
    )
    await user.click(screen.getByRole('checkbox', { name: /familiei după aprobare/i }))
    await user.click(screen.getByRole('button', { name: /adaugă resursă/i }))
    await user.type(screen.getByLabelText(/titlu resursă 1/i), 'Cântec de inspirație')
    await user.type(screen.getByLabelText(/link resursă 1/i), 'https://example.test/cantec')
    await user.click(screen.getByRole('button', { name: /salvează ciorna/i }))

    await waitFor(() => {
      expect(saveFreeResponseDraftMock).toHaveBeenCalledWith({
        title: 'Povestea personajului meu',
        prompt: 'Desenează un personaj și spune ce puteri are.',
        allowedTools: { text: true, drawing: true, voice: true },
        shareWithFamilyOnApproval: true,
        resources: [{ title: 'Cântec de inspirație', url: 'https://example.test/cantec' }],
      })
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/ciorna a fost salvată/i)
    expect(screen.getByRole('link', { name: /vezi ciornele/i })).toHaveAttribute(
      'href',
      '/teacher/activities?tab=my&status=draft',
    )
  })

  it('edits an existing free-response draft without showing the mode chooser', async () => {
    const user = userEvent.setup()
    renderWithProvider(
      <CreateActivityWizard
        interactiveTypes={interactiveTypes}
        initialDraft={{
          activityId: 'activity-1',
          status: 'draft',
          title: 'Povestea veche',
          prompt: 'Instrucțiuni vechi.',
          allowedTools: { text: true, drawing: false, voice: true },
          shareWithFamilyOnApproval: false,
          resources: [{ title: 'Resursă veche', url: 'https://example.test/veche' }],
        }}
      />,
    )

    expect(screen.queryByRole('button', { name: /joc interactiv/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/titlu activitate/i)).toHaveValue('Povestea veche')
    expect(screen.getByLabelText(/link resursă 1/i)).toHaveValue('https://example.test/veche')

    await user.clear(screen.getByLabelText(/titlu activitate/i))
    await user.type(screen.getByLabelText(/titlu activitate/i), 'Povestea actualizată')
    await user.click(screen.getByRole('checkbox', { name: /desen/i }))
    await user.click(screen.getByRole('button', { name: /salvează modificările/i }))

    await waitFor(() => {
      expect(updateFreeResponseDraftMock).toHaveBeenCalledWith('activity-1', {
        title: 'Povestea actualizată',
        prompt: 'Instrucțiuni vechi.',
        allowedTools: { text: true, drawing: true, voice: true },
        shareWithFamilyOnApproval: false,
        resources: [{ title: 'Resursă veche', url: 'https://example.test/veche' }],
      })
    })
    expect(saveFreeResponseDraftMock).not.toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent(/activitatea a fost actualizată/i)
  })

  it('shows interactive authoring placeholders from available metadata', async () => {
    const user = userEvent.setup()
    renderWithProvider(<CreateActivityWizard interactiveTypes={interactiveTypes} />)

    await user.click(screen.getByRole('button', { name: /joc interactiv/i }))

    expect(screen.getByRole('button', { name: /joc interactiv/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: /jocuri interactive/i })).toBeInTheDocument()
    expect(screen.getByText('Ascultă și apasă')).toBeInTheDocument()
    expect(screen.getAllByText(/constructor în pregătire/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /salvează ciorna/i })).toBeDisabled()
  })

  it('keeps source and template card controls on Mantine-backed kit primitives', () => {
    expect(componentSource).not.toContain('<button')
  })
})
