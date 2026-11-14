import { render, screen, within } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { expect, it } from 'vitest'
import { TeacherLibraryDiscoveryContent } from './TeacherLibraryDiscoveryContent'

it('renders Seesaw-style library search, filters, and activity rails', () => {
  render(
    <MantineProvider>
      <TeacherLibraryDiscoveryContent />
    </MantineProvider>,
  )

  expect(screen.getByRole('heading', { name: /explorează biblioteci/i })).toBeInTheDocument()
  expect(screen.getByRole('searchbox', { name: /caută activități/i })).toBeInTheDocument()

  const filters = screen.getByRole('group', { name: /filtre bibliotecă/i })
  expect(within(filters).getByRole('button', { name: /toate/i })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByRole('tablist', { name: /filtre bibliotecă/i })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /clasa i/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /română/i })).toBeInTheDocument()

  expect(screen.getByRole('region', { name: /colecții recomandate/i })).toBeInTheDocument()
  const popular = screen.getByRole('region', { name: /activități populare/i })
  expect(within(popular).getAllByRole('link', { name: /activitate/i }).length).toBeGreaterThan(0)
})
