import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HeroBanner } from './HeroBanner'

describe('HeroBanner', () => {
  it('renders title as h1', () => {
    render(<HeroBanner title="Buna, Maria!" />)
    expect(
      screen.getByRole('heading', { level: 1, name: /buna, maria/i }),
    ).toBeInTheDocument()
  })

  it('renders subtitle when provided', () => {
    render(
      <HeroBanner title="T" subtitle="Esti gata pentru noi aventuri?" />,
    )
    expect(screen.getByText(/esti gata pentru noi aventuri/i)).toBeInTheDocument()
  })

  it('renders action children below the subtitle', () => {
    render(
      <HeroBanner title="T" subtitle="S">
        <button type="button">Porneste</button>
      </HeroBanner>,
    )
    expect(screen.getByRole('button', { name: /porneste/i })).toBeInTheDocument()
  })

  it('applies tone-specific EduPlay surface classes', () => {
    const { container, rerender } = render(
      <HeroBanner title="T" tone="secondary" />,
    )
    expect(container.querySelector("section")).toHaveClass('bg-gold')

    rerender(<HeroBanner title="T" tone="tertiary" />)
    expect(container.querySelector("section")).toHaveClass('bg-success-journal')
  })

  it('defaults to primary tone when none is given', () => {
    const { container } = render(<HeroBanner title="T" />)
    expect(container.querySelector("section")).toHaveClass('bg-primary')
  })

  it('renders decorative icon when specified', () => {
    const { container } = render(
      <HeroBanner title="T" decorativeIcon="RocketLaunch" />,
    )
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
  })
})
