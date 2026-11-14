export type StudentRow = {
  id: string
  username: string
  class_id: string | null
}

export type ProfileRow = {
  id: string
  full_name: string | null
  avatar_url: string | null
}

export type ProgressRow = {
  id: string
  student_id: string
  status: string
  score: number | null
  attempts: number | null
  last_played_at: string | null
  game_id: string
}

export type GameRow = {
  id: string
  title: string | null
  category: string | null
  difficulty_level: number | null
}

export const EMPTY_CLASS_ID = '00000000-0000-0000-0000-000000000000'

export const CATEGORY_LABELS: Record<string, string> = {
  literacy: 'Limbă română',
  math: 'Matematică',
  phonics: 'Fonetică',
  shapes: 'Forme',
  colors: 'Culori',
  vocabulary: 'Vocabular',
}

export const CATEGORY_COLORS = [
  'var(--color-primary)',
  'var(--color-fun-purple)',
  'var(--color-secondary)',
  'var(--color-fun-orange)',
]
