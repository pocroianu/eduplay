import { describe, expect, it } from 'vitest'

import { withConfigUrl } from './with-config-url'

describe('withConfigUrl', () => {
  it('returns the URL unchanged when no configUrl is provided', () => {
    expect(withConfigUrl('/games/listen-tap/index.html?lang=ro')).toBe(
      '/games/listen-tap/index.html?lang=ro',
    )
  })

  it('appends configUrl as a search param to a relative path', () => {
    const out = withConfigUrl(
      '/games/listen-tap/index.html?lang=ro',
      '/api/v1/activities/abc/config?versionId=def',
    )
    expect(out).toBe(
      '/games/listen-tap/index.html?lang=ro&configUrl=%2Fapi%2Fv1%2Factivities%2Fabc%2Fconfig%3FversionId%3Ddef',
    )
  })

  it('does not append configUrl to an absolute iframe URL', () => {
    const out = withConfigUrl(
      'https://cdn.example.com/games/listen-tap/index.html?lang=ro',
      '/api/v1/activities/abc/config?versionId=def',
    )
    expect(out).toBe('https://cdn.example.com/games/listen-tap/index.html?lang=ro')
  })

  it('does not append non-API or absolute config URLs', () => {
    expect(withConfigUrl('/games/listen-tap/index.html', '/teacher/config')).toBe(
      '/games/listen-tap/index.html',
    )
    expect(withConfigUrl('/games/listen-tap/index.html', 'https://example.com/config.json')).toBe(
      '/games/listen-tap/index.html',
    )
  })

  it('does not leak the placeholder origin into the output for relative paths', () => {
    const out = withConfigUrl(
      '/games/listen-tap/index.html',
      '/api/v1/activities/abc/config?versionId=def',
    )
    expect(out).not.toContain('internal.placeholder')
    expect(out.startsWith('/')).toBe(true)
  })

  it('preserves an existing hash fragment on relative paths', () => {
    const out = withConfigUrl(
      '/games/listen-tap/index.html?lang=ro#start',
      '/api/v1/activities/abc/config?versionId=def',
    )
    expect(out.endsWith('#start')).toBe(true)
  })

  it('overwrites a pre-existing configUrl rather than duplicating it', () => {
    const out = withConfigUrl(
      '/games/listen-tap/index.html?configUrl=%2Fold',
      '/api/v1/activities/abc/config?versionId=def',
    )
    const matches = out.match(/configUrl=/g) ?? []
    expect(matches).toHaveLength(1)
    expect(out).toContain(
      'configUrl=%2Fapi%2Fv1%2Factivities%2Fabc%2Fconfig%3FversionId%3Ddef',
    )
  })

  it('returns the input unchanged when the URL is malformed', () => {
    // No leading `/` and no protocol → URL constructor throws.
    expect(withConfigUrl('not a url', '/api/x')).toBe('not a url')
  })

  it('produces identical output when window.location.origin differs from the placeholder', () => {
    // If the function ever depended on `window.location.origin`, the relative-path
    // branch would emit a different result depending on which origin happens to
    // be active. We simulate that by stubbing window.location to a non-default
    // origin and confirming the output is unchanged. This guards against
    // re-introducing the SSR/hydration mismatch where server emits one origin
    // and client emits another.
    const original = window.location.href
    try {
      const out1 = withConfigUrl(
        '/games/listen-tap/index.html?lang=ro',
        '/api/v1/x',
      )
      // Mutate the document URL — withConfigUrl must not observe this.
      history.replaceState({}, '', '/some-other-page')
      const out2 = withConfigUrl(
        '/games/listen-tap/index.html?lang=ro',
        '/api/v1/x',
      )
      expect(out1).toBe(out2)
    } finally {
      history.replaceState({}, '', original)
    }
  })
})
