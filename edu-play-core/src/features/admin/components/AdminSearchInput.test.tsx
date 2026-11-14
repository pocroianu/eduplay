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
    const input = screen.getByRole('searchbox', {
      name: 'Căutarea în panoul administrativ nu este disponibilă momentan',
    }) as HTMLInputElement
    expect(input).toBeDefined()
    expect(input.disabled).toBe(true)
    expect(input.placeholder).toBe('Căutarea va fi disponibilă în curând')
    expect(screen.getByText('Indisponibil')).toBeDefined()
  })

  it('does not focus disabled search when "/" is pressed outside of any field', () => {
    renderSearchInput()
    const input = screen.getByRole('searchbox') as HTMLInputElement

    expect(document.activeElement).not.toBe(input)

    const event = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true })
    window.dispatchEvent(event)

    expect(document.activeElement).not.toBe(input)
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
    const search = screen.getByRole('searchbox') as HTMLInputElement
    other.focus()
    expect(document.activeElement).toBe(other)

    const event = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true })
    other.dispatchEvent(event)

    expect(document.activeElement).toBe(other)
    expect(document.activeElement).not.toBe(search)
  })
})
