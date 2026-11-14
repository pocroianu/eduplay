export type AgeBand = '3-6' | '7-12'

export function getAgeBand(dateOfBirth?: string | null): AgeBand {
  if (!dateOfBirth) return '7-12'
  const birth = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDelta = today.getMonth() - birth.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) age -= 1
  return age <= 6 ? '3-6' : '7-12'
}

export function formatAgeBand(ageBand?: AgeBand): string {
  if (ageBand === '3-6') return '3-6 ani'
  if (ageBand === '7-12') return '7-12 ani'
  return 'Exploratori'
}
