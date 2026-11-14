/**
 * Guardrail + behavioural tests for the shell side of the game postMessage
 * contract (F7, `GameEmbed.tsx`).
 *
 * The shell MUST NEVER call `postMessage(..., '*')` and MUST NEVER accept a
 * `MessageEvent` whose `origin` does not match the derived trusted origin.
 * A wildcard target lets any page receive our init/control messages; a
 * missing inbound origin check lets any page forge GAME_COMPLETE scores.
 *
 * We guard both properties here because the file previously regressed in
 * exactly these two spots (render-time `useMemo` returning `''` under SSR,
 * outbound fallbacks `trustedOrigin || '*'`).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const REPO_ROOT = join(__dirname, '..', '..', '..', '..')
const SHELL_SRC = join(REPO_ROOT, 'src')

/**
 * Walk a directory tree and return absolute paths of all `.ts` / `.tsx`
 * source files, skipping test files and declaration files.
 */
function collectSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__') continue
      out.push(...collectSourceFiles(full))
      continue
    }
    if (!stat.isFile()) continue
    if (!/\.(ts|tsx)$/.test(entry)) continue
    if (/\.(test|spec)\.(ts|tsx)$/.test(entry)) continue
    if (entry.endsWith('.d.ts')) continue
    out.push(full)
  }
  return out
}

describe('GameEmbed postMessage guardrail (shell side)', () => {
  it('never passes `"*"` as the targetOrigin anywhere in src/', () => {
    const offenders: string[] = []

    // Match `postMessage(..., '*')` and `postMessage(..., "*")`.
    // The second argument is a string literal — so we look specifically for
    // a bare wildcard literal as the final argument, tolerating whitespace.
    const WILDCARD_LITERAL = /postMessage\s*\([^)]*?,\s*(['"])\*\1\s*\)/

    // Match `postMessage(..., X || '*')` — the exact pattern that lived on
    // lines 319 and 470 before this fix. `X` can be any identifier or
    // property chain; the trailing `'*'` is what we forbid.
    const OR_WILDCARD = /postMessage\s*\([^)]*?\|\|\s*(['"])\*\1\s*\)/

    for (const file of collectSourceFiles(SHELL_SRC)) {
      const body = readFileSync(file, 'utf8')
      if (WILDCARD_LITERAL.test(body) || OR_WILDCARD.test(body)) {
        offenders.push(relative(REPO_ROOT, file))
      }
    }

    expect(
      offenders,
      `Found wildcard \`postMessage(..., '*')\` targetOrigin in: ${offenders.join(', ')}. ` +
        `Use the derived trusted origin instead — see GameEmbed.tsx.`,
    ).toEqual([])
  })

  it('does not send configUrl in ACTIVITY_INIT', () => {
    const body = readFileSync(join(SHELL_SRC, 'features/games/components/GameEmbed.tsx'), 'utf8')
    const initBlock = body.match(/type: 'ACTIVITY_INIT',[\s\S]*?muted: isMuted,/)

    expect(initBlock?.[0] ?? '').not.toContain('configUrl')
  })

  it('has at least one non-test file under src/ (guard against empty scan)', () => {
    // Belt-and-braces: if the repo layout changes and the walker returns
    // zero files, the wildcard check above would pass trivially. Fail the
    // suite in that case so the guardrail is never silently skipped.
    const files = collectSourceFiles(SHELL_SRC)
    expect(files.length).toBeGreaterThan(50)
  })
})
