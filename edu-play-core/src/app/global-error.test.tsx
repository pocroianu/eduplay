import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import GlobalError from './global-error'

it('offers recovery from a root layout failure', () => {
  const reset = vi.fn()
  render(<GlobalError error={new Error('failure')} reset={reset} />, { container: document.documentElement })
  expect(screen.getByText('Ceva nu a mers bine')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Încearcă din nou' }))
  expect(reset).toHaveBeenCalledOnce()
})
