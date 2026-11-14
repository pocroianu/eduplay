export type ListenTapLanguage = 'ro' | 'en'

export interface ListenTapWordEntry {
  word: string
  promptAudioId?: string
  imageAssetId?: string
}

export interface ListenTapWordList {
  id: string
  ownerTeacherId: string
  name: string
  language: ListenTapLanguage
  words: ListenTapWordEntry[]
  createdAt: string
  updatedAt: string
}
