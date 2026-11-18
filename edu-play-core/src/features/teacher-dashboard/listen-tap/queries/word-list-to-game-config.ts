import type { ListenTapWordEntry, ListenTapWordList } from '../types'

export interface ListenTapChoiceConfig {
  id: string
  imageAssetId: string
  correct: boolean
}

export interface ListenTapRoundConfig {
  id: string
  promptAudioId: string
  choices: ListenTapChoiceConfig[]
}

export interface ListenTapGameConfig {
  meta: {
    gameId: string
    version: string
    totalSteps: number
    gameType: 'listen-tap'
    themeName: string
    pointsPerRound: number
    roundDelay: number
    supportedLanguages: ('ro' | 'en')[]
  }
  rounds: ListenTapRoundConfig[]
  questions: never[]
}

const DEFAULT_DISTRACTORS = 2
const DIACRITIC_MAP: Record<string, string> = {
  ă: 'a', â: 'a', î: 'i', ș: 's', '\u015F': 's', ț: 't', '\u0163': 't',
  Ă: 'A', Â: 'A', Î: 'I', Ș: 'S', '\u015E': 'S', Ț: 'T', '\u0162': 'T',
}

function slugify(value: string): string {
  return value
    .replace(/[ăâîș\u015Fț\u0163ĂÂÎȘ\u015EȚ\u0162]/g, (ch) => DIACRITIC_MAP[ch] ?? ch)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// The word schema only enforces `min(1)` after trim, so punctuation-only,
// emoji-only, or non-Latin entries pass validation but slugify to ''. Asset
// lookups would silently break, so we emit a deterministic per-index fallback.
function entryAudioId(entry: ListenTapWordEntry, index: number): string {
  const explicit = entry.promptAudioId?.trim()
  if (explicit && explicit.length > 0) return explicit
  return slugify(entry.word) || `word-${index}`
}

function entryImageId(entry: ListenTapWordEntry, index: number): string {
  const explicit = entry.imageAssetId?.trim()
  if (explicit && explicit.length > 0) return explicit
  return slugify(entry.word) || `word-${index}`
}

export function wordListToGameConfig(wordList: ListenTapWordList): ListenTapGameConfig {
  const words = wordList.words
  const total = words.length
  const distractorTarget = Math.min(DEFAULT_DISTRACTORS, Math.max(0, total - 1))

  const rounds: ListenTapRoundConfig[] = words.map((word, wordIndex) => {
    const correctChoice: ListenTapChoiceConfig = {
      id: 'c1',
      imageAssetId: entryImageId(word, wordIndex),
      correct: true,
    }

    const distractors: ListenTapChoiceConfig[] = []
    for (let offset = 1; offset <= distractorTarget; offset += 1) {
      const sourceIndex = (wordIndex + offset) % total
      const source = words[sourceIndex]!
      distractors.push({
        id: `c${distractors.length + 2}`,
        imageAssetId: entryImageId(source, sourceIndex),
        correct: false,
      })
    }

    return {
      id: `r${wordIndex + 1}`,
      promptAudioId: entryAudioId(word, wordIndex),
      choices: [correctChoice, ...distractors],
    }
  })

  return {
    meta: {
      gameId: `teacher-${wordList.id}`,
      version: '1.0.0',
      totalSteps: rounds.length,
      gameType: 'listen-tap',
      themeName: 'nature',
      pointsPerRound: 10,
      roundDelay: 900,
      supportedLanguages: [wordList.language],
    },
    rounds,
    questions: [],
  }
}
