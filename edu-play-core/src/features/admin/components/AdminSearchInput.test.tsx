import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { MantineProvider } from '@mantine/core'
import { render, screen, cleanup } from '@testing-library/react'
import { AdminSearchInput } from './AdminSearchInput'

function renderSearchInput() {
  return render(
    <MantineProvider>
      <AdminSearchInput />
    </MantineProvider>,
  )
}

describe('AdminSearchInput', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the unavailable search state explicitly', () => {
    renderSearchInput()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    expect(screen.getByText('Căutarea va fi disponibilă în curând.')).toBeInTheDocument()
  })

  it('does not focus disabled search when "/" is pressed outside of any field', () => {
    renderSearchInput()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()

    const event = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
  })

  it('ignores "/" when focus is already inside another text field', () => {
    render(
      <MantineProvider>
        <input type="text" data-testid="other" />
        <AdminSearchInput />
      </MantineProvider>,
    )
    const other = screen.getByTestId('other') as HTMLInputElement
    other.focus()
    expect(document.activeElement).toBe(other)

    const event = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true })
    other.dispatchEvent(event)

    expect(document.activeElement).toBe(other)
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  })
})
