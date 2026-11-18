import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import NewStudentPage from './page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/lib/supabase/client', () => {
  const client = { from: () => ({ select: () => ({ order: async () => ({ data: [] }) }) }) }
  return { createClient: () => client }
})

describe('/teacher/students/new', () => {
  it('shows an alert when saving fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    render(<NewStudentPage />)
    fireEvent.change(screen.getByPlaceholderText('ex: Maria Popescu'), { target: { value: 'Ana Popescu' } })
    fireEvent.click(screen.getByRole('button', { name: /creează elev/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nu am putut salva. Încearcă din nou.')
    vi.unstubAllGlobals()
  })
})
