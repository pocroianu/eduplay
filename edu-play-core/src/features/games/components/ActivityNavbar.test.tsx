import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ActivityNavbar } from './ActivityNavbar'

describe('ActivityNavbar', () => {
  it('renders the player name, progress, repeat, and pause controls', () => {
    const onRepeat = vi.fn()
    const onPause = vi.fn()

    render(
      <ActivityNavbar
        playerName="Ana"
        currentSet={2}
        totalSets={5}
        repeatEnabled
        isPaused={false}
        onRepeat={onRepeat}
        onPause={onPause}
      />,
    )

    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Ana' })).toBeInTheDocument()
    const progress = screen.getByRole('progressbar', { name: 'Progres 2 din 5' })
    expect(progress).toHaveAttribute('aria-valuenow', '40')
    expect(progress).toHaveAttribute('aria-valuemin', '0')
    expect(progress).toHaveAttribute('aria-valuemax', '100')

    fireEvent.click(screen.getByRole('button', { name: 'Repetă instrucțiunea' }))
    expect(onRepeat).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Pune pe pauză' }))
    expect(onPause).toHaveBeenCalledTimes(1)
  })

  it('keeps Romanian action labels visible for narrow kid-mode layouts', () => {
    render(
      <ActivityNavbar
        playerName="Ana"
        currentSet={1}
        totalSets={5}
        repeatEnabled
        isPaused={false}
        onRepeat={vi.fn()}
        onPause={vi.fn()}
      />,
    )

    expect(screen.getByText('Repetă')).not.toHaveClass('hidden')
    expect(screen.getByText('Pauză')).not.toHaveClass('hidden')
  })

  it('keeps the repeat slot visible but disabled when unsupported', () => {
    const onRepeat = vi.fn()

    render(
      <ActivityNavbar
        playerName="Jucător"
        currentSet={0}
        totalSets={0}
        repeatEnabled={false}
        isPaused={false}
        onRepeat={onRepeat}
        onPause={vi.fn()}
      />,
    )

    const repeat = screen.getByRole('button', { name: 'Repetarea nu este disponibilă' })
    expect(repeat).toBeDisabled()
    fireEvent.click(repeat)
    expect(onRepeat).not.toHaveBeenCalled()
  })
})
