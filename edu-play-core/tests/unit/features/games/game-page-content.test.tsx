import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@/../tests/test-utils'
import { GamePageContent } from '@/features/games/components/GamePageContent'

vi.mock('@/features/games/components/GameEmbed', () => ({
  GameEmbed: ({
    gameId,
    configUrl,
    onComplete,
    onRequestExit,
  }: {
    gameId: string
    configUrl?: string
    onComplete?: (r: { score: number; timeSpent: number; starRating: number; totalSets: number }) => void
    onRequestExit?: () => void
  }) => (
    <div data-testid="game-embed" data-game-id={gameId} data-config-url={configUrl ?? ''}>
      <button
        type="button"
        onClick={() => onComplete?.({ score: 85, timeSpent: 222, starRating: 3, totalSets: 10 })}
      >
        finish-game
      </button>
      <button type="button" onClick={onRequestExit}>
        request-exit
      </button>
    </div>
  ),
}))

const baseGame = {
  id: 'g1',
  title: 'Provocarea Cifrelor',
  game_url: '/games/math/index.html',
  category: 'math',
  difficulty_level: 2,
  estimated_duration: 10,
}

async function startGame(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Să începem/i }))
  await waitFor(() => {
    expect(screen.getByTestId('game-embed')).toBeInTheDocument()
  })
}

describe('GamePageContent', () => {
  it('shows the pre-game cover before the game starts', () => {
    render(
      <GamePageContent
        game={baseGame}
        progress={null}
        backUrl="/student/games"
      />
    )

    expect(screen.getAllByRole('heading', { name: 'Provocarea Cifrelor' }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('button', { name: /Să începem/i })).toBeInTheDocument()
    expect(screen.queryByTestId('game-embed')).not.toBeInTheDocument()
  })

  it('renders active play without the category banner or Următorul CTA after starting', async () => {
    const user = userEvent.setup()
    render(
      <GamePageContent
        game={baseGame}
        progress={null}
        backUrl="/student/games"
      />
    )

    await startGame(user)

    expect(screen.getByTestId('game-embed')).toBeInTheDocument()
    expect(screen.queryByText('Provocarea Cifrelor')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Următorul/i })).not.toBeInTheDocument()
  })

  it('passes preview configUrl through to the embedded game iframe', async () => {
    const user = userEvent.setup()
    render(
      <GamePageContent
        game={baseGame}
        progress={null}
        backUrl="/admin/cms/activities/g1"
        configUrl="/api/v1/activities/g1/preview/config?previewToken=token"
      />
    )

    await startGame(user)

    expect(screen.getByTestId('game-embed')).toHaveAttribute(
      'data-config-url',
      '/api/v1/activities/g1/preview/config?previewToken=token',
    )
  })

  it('renders the themed empty state when game_url is null', () => {
    render(
      <GamePageContent
        game={{ ...baseGame, game_url: null }}
        progress={null}
        backUrl="/student/games"
      />
    )

    expect(screen.getByRole('heading', { name: /Aproape gata/i })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Înapoi la jocuri/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByTestId('game-embed')).not.toBeInTheDocument()
  })

  it('shows results card and Din nou + Următorul after game completes', async () => {
    const user = userEvent.setup()
    render(
      <GamePageContent
        game={baseGame}
        progress={{ score: 0, attempts: 1 }}
        backUrl="/student/games"
      />
    )

    await startGame(user)
    await user.click(screen.getByText('finish-game'))

    await waitFor(() => {
      expect(screen.getByText('85%')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Joacă din nou/i })).toBeInTheDocument()
      expect(screen.getAllByText(/Felicitări/i).length).toBeGreaterThanOrEqual(1)
    })
  })

  it('returns to the playing state when "Din nou" is clicked', async () => {
    const user = userEvent.setup()
    render(
      <GamePageContent
        game={baseGame}
        progress={null}
        backUrl="/student/games"
      />
    )

    await startGame(user)
    await user.click(screen.getByText('finish-game'))
    await waitFor(() => {
      expect(screen.queryByTestId('game-embed')).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Joacă din nou/i }))
    await waitFor(() => {
      expect(screen.getByTestId('game-embed')).toBeInTheDocument()
    })
    expect(screen.queryByText('85%')).not.toBeInTheDocument()
  })

  it('does not render lesson chrome during active play', async () => {
    const user = userEvent.setup()
    render(
      <GamePageContent
        game={baseGame}
        progress={null}
        backUrl="/student/games"
      />
    )

    await startGame(user)

    expect(screen.queryByRole('button', { name: /Sfaturi de la Vulpița/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /Sfaturi pentru joc/i })).not.toBeInTheDocument()
  })

  it('opens the exit-confirm dialog when the back button is tapped mid-play', async () => {
    const user = userEvent.setup()
    render(
      <GamePageContent
        game={baseGame}
        progress={null}
        backUrl="/student/games"
      />
    )

    await startGame(user)

    await user.click(screen.getByRole('button', { name: /request-exit/i }))

    expect(screen.getByRole('alertdialog', { name: /Ieși din joc/i })).toBeInTheDocument()
    expect(screen.getByText(/progresul nu se va salva/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Rămân în joc/i })).toHaveClass('min-h-16')
    expect(screen.getByRole('button', { name: /Ies din joc/i })).toHaveClass('min-h-16')
  })
})
