import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect } from 'vitest'

export function expectMantineSkeletonLoading(filePath: string) {
  const content = readFileSync(join(process.cwd(), filePath), 'utf8')

  expect(content).toContain('@mantine/core')
  expect(content).toContain('Skeleton')
  expect(content).not.toContain('animate-pulse')
}
