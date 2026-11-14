export function isNavHrefActive(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false
  if (pathname === href) return true

  const hrefDepth = href.split('/').filter(Boolean).length
  if (href === '/' || hrefDepth <= 1) return false

  return pathname.startsWith(`${href}/`)
}
