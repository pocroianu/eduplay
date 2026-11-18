import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { GameCard } from './GameCard'

it('provides one stretched game link with a visible card focus indicator', () => {
  render(<GameCard game={{ id: 'joc', title: 'Numărăm', description: null, thumbnail_url: null, game_url: '', category: 'math', difficulty_level: 1, target_age_min: null, target_age_max: null, estimated_duration: null, learning_objectives: null, is_published: true, created_at: '', updated_at: '', progress: null }} />)
  const link = screen.getByRole('link', { name: 'Numărăm' })
  expect(screen.getAllByRole('link')).toHaveLength(1)
  expect(link).toHaveAttribute('href', '/play/joc')
  expect(link).toHaveClass('after:absolute', 'after:inset-0')
  expect(link.closest('.focus-within\\:outline')).toBeInTheDocument()
})
