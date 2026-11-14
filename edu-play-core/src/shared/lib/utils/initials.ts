export function getInitials(value: string | null | undefined, locale = 'ro-RO') {
  return (
    value
      ?.split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toLocaleUpperCase(locale) ?? '')
      .join('') || '?'
  )
}
