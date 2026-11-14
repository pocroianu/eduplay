/**
 * Adds `?configUrl=…` to same-origin iframe URLs when a same-origin Activity
 * config endpoint is provided. Config overrides are boot-critical and only
 * supported for proxied/same-origin games: the value must be a relative
 * `/api/v1/...` document URL, and the iframe URL must also be relative.
 *
 * SSR-safe: never reads `window`. For relative paths we use a stable
 * placeholder origin and strip it back off, so server- and client-rendered
 * output is byte-identical and the iframe doesn't double-load on hydration.
 */
const PLACEHOLDER_ORIGIN = 'http://internal.placeholder'

export function withConfigUrl(resolvedUrl: string, configUrl?: string): string {
  if (!configUrl) return resolvedUrl
  if (!resolvedUrl.startsWith('/') || !configUrl.startsWith('/api/v1/')) {
    return resolvedUrl
  }

  try {
    const url = new URL(resolvedUrl, PLACEHOLDER_ORIGIN)
    url.searchParams.set('configUrl', configUrl)
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return resolvedUrl
  }
}
