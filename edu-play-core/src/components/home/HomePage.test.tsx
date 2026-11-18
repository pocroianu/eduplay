import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { GamePreviewCarousel } from './GamePreviewCarousel'
import { HomePage } from './HomePage'

beforeAll(() => {
  class MockIntersectionObserver {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  }

  Object.defineProperty(window, 'IntersectionObserver', {
    configurable: true,
    writable: true,
    value: MockIntersectionObserver,
  })
})

describe('HomePage', () => {
  it('renders EduPlay above-fold landing structure with Romanian copy', () => {
    render(<HomePage />)

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Copiii învață jucându-se. Serios.',
      }),
    ).toHaveAttribute('aria-label', 'Copiii învață jucându-se. Serios.')
    expect(screen.getByText('Creat pentru școli primare')).toBeInTheDocument()
    expect(
      screen.getByText('Jocuri sigure, progres vizibil și limba română corectă.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Vezi platforma' })).toHaveAttribute(
      'href',
      '/login',
    )
    expect(
      screen.getAllByRole('link', {
        name: 'Începe gratuit',
      })[0],
    ).toHaveAttribute('href', '/register')
    expect(
      screen.getAllByRole('link', {
        name: 'Am deja cont',
      })[0],
    ).toHaveAttribute('href', '/login')
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Jocuri educaționale',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Începe într-un minut.',
      }),
    ).toHaveAttribute('aria-label', 'Începe într-un minut.')
    expect(screen.getByRole('link', { name: 'Autentifică-te' })).toHaveAttribute('href', '/login')
    expect(screen.getByText('Fără reclame și trackere')).toBeInTheDocument()
    expect(screen.queryByText('100%')).not.toBeInTheDocument()
    expect(screen.queryByText(/GDPR/)).not.toBeInTheDocument()
    expect(screen.queryByText(/săptămânal/)).not.toBeInTheDocument()
    expect(screen.queryByText(/testat/i)).not.toBeInTheDocument()
    expect(screen.getByText(`© ${new Date().getFullYear()} EduPlay România`)).toBeInTheDocument()
    expect(screen.getAllByText('Diacritice corecte').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Începe gratuit' })[0]).toHaveClass(
      'bg-primary',
      'text-on-primary',
    )
    expect(screen.getByTestId('landing-final-cta-card')).toHaveClass(
      'rounded-xl',
      'bg-surface-container-lowest',
      'shadow-soft',
    )
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('orders landing sections like the EduPlay homepage flow', () => {
    const { container } = render(<HomePage />)

    const text = container.textContent ?? ''
    const learningLoopIndex = text.indexOf('EduPlay îi ține pe toți conectați la învățare.')
    const evidenceIndex = text.indexOf('Sprijin pentru clasă, nu doar încă o aplicație.')
    const finalCtaIndex = text.indexOf('Începe într-un minut.')

    expect(learningLoopIndex).toBeGreaterThan(-1)
    expect(evidenceIndex).toBeGreaterThan(learningLoopIndex)
    expect(finalCtaIndex).toBeGreaterThan(evidenceIndex)
  })

  it('renders landing audience cards on the modest white-card contract', () => {
    render(<HomePage />)

    for (const role of ['teachers', 'students', 'families', 'admins']) {
      const card = screen.getByTestId(`landing-audience-card-${role}`)

      expect(card).toHaveClass('rounded-xl', 'bg-surface-container-lowest', 'shadow-soft-sm')
      expect(card).not.toHaveClass('rounded-2xl')
    }

    expect(screen.getByTestId('landing-role-card')).toHaveClass('rounded-xl', 'bg-primary-wash')
  })

  it('labels the dashboard preview card as an illustration', () => {
    render(<GamePreviewCarousel />)

    expect(screen.getByText('Exemplu')).toBeInTheDocument()
    expect(screen.queryByText('Live')).not.toBeInTheDocument()
    expect(screen.getByText(/Exemplu de tablou pentru o clasă/)).toBeInTheDocument()
  })
})
