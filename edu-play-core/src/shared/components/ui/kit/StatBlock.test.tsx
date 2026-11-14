import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatBlock } from './StatBlock'

describe('StatBlock', () => {
  it('renders label and value', () => {
    render(<StatBlock label="Jocuri" value={12} icon="GameController" />)
    expect(screen.getByText('Jocuri')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('switches soft icon chip class per variant', () => {
    const { container, rerender } = render(
      <StatBlock label="L" value={0} icon="X" variant="secondary" />,
    )
    const chip = container.querySelector('[aria-hidden="true"]')
    expect(chip?.className).toContain('bg-gold-soft')
    expect(chip?.className).not.toContain('bg-gradient')

    rerender(<StatBlock label="L" value={0} icon="X" variant="tertiary" />)
    expect(container.querySelector('[aria-hidden="true"]')?.className).toContain(
      'bg-primary-soft',
    )

    rerender(<StatBlock label="L" value={0} icon="X" variant="error" />)
    expect(container.querySelector('[aria-hidden="true"]')?.className).toContain(
      'bg-error-soft',
    )
  })

  it('defaults to the primary variant', () => {
    const { container } = render(
      <StatBlock label="L" value={1} icon="X" />,
    )
    expect(container.querySelector('[aria-hidden="true"]')?.className).toContain(
      'bg-primary-soft',
    )
  })

  it('exposes the focus-within ring so keyboard users see focus state', () => {
    const { container } = render(
      <StatBlock label="L" value={1} icon="X" />,
    )
    expect(container.firstElementChild).toHaveClass('focus-within:ring-2')
  })
})
