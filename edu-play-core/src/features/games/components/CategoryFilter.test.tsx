import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CategoryFilter } from './CategoryFilter'

describe('CategoryFilter', () => {
  it('renders categories through the Mantine-backed pressed chip group', async () => {
    const user = userEvent.setup()
    const onCategoryChange = vi.fn()

    render(
      <MantineProvider>
        <CategoryFilter selectedCategory="all" onCategoryChange={onCategoryChange} />
      </MantineProvider>,
    )

    const group = screen.getByRole('group', { name: /filtrează jocurile după categorie/i })
    expect(group).toHaveAttribute('data-wrap', 'false')
    expect(within(group).getByRole('button', { name: /toate/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.click(within(group).getByRole('button', { name: /numere/i }))

    expect(onCategoryChange).toHaveBeenCalledWith('math')
  })

  it('does not reintroduce hand-built motion category buttons', () => {
    const content = readFileSync(join(process.cwd(), 'src/features/games/components/CategoryFilter.tsx'), 'utf8')

    expect(content).toContain('FilterChipGroup')
    expect(content).not.toMatch(/motion\.button|whileTap|buttonTap|buttonHover/)
  })
})
