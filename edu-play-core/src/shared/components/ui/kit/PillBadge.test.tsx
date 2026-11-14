import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PillBadge } from './PillBadge'

describe('PillBadge', () => {
  it('renders children', () => {
    render(<PillBadge>3 zile streak</PillBadge>)
    expect(screen.getByText('3 zile streak')).toBeInTheDocument()
  })

  it('renders the leading slot when provided', () => {
    render(
      <PillBadge leading={<span data-testid="ico">*</span>}>Nou</PillBadge>,
    )
    expect(screen.getByTestId('ico')).toBeInTheDocument()
  })

  it('applies the right Duo token pair for each tone', () => {
    const { container, rerender } = render(
      <PillBadge tone="primary">x</PillBadge>,
    )
    expect(container.firstElementChild).toHaveClass('bg-primary-soft')
    expect(container.firstElementChild).toHaveClass('text-primary-deep')

    rerender(<PillBadge tone="tertiary">x</PillBadge>)
    expect(container.firstElementChild).toHaveClass('bg-primary-soft')
    expect(container.firstElementChild).toHaveClass('text-primary-deep')

    rerender(<PillBadge tone="secondary">x</PillBadge>)
    expect(container.firstElementChild).toHaveClass('bg-gold-soft')
    expect(container.firstElementChild).toHaveClass('text-gold-deep')

    rerender(<PillBadge tone="error">x</PillBadge>)
    expect(container.firstElementChild).toHaveClass('bg-error-soft')
    expect(container.firstElementChild).toHaveClass('text-coral-deep')
  })

  it('defaults to a neutral tone when none is given', () => {
    const { container } = render(<PillBadge>x</PillBadge>)
    expect(container.firstElementChild).toHaveClass('bg-surface-container')
  })

  it('meets the 18px minimum body font rule', () => {
    const { container } = render(<PillBadge>x</PillBadge>)
    expect(container.firstElementChild).toHaveClass('text-[18px]')
  })
})
