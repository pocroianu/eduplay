import { NextResponse } from 'next/server'

import { ApiError, handleRoute, requireRole } from '@/lib/api'
import {
  getTeacherListenTapWordList,
  wordListToGameConfig,
} from '@/features/teacher-dashboard/listen-tap/server'

// This route serves config-as-asset, not config-as-data: the consumer is
// Phaser's `this.load.json('listen-tap-config', configUrl)` inside
// `templates/listen-tap/src/scenes/ListenTapPreload.ts`, which hands the
// parsed body straight to `ListenTapLevel` expecting `{ meta, rounds }` at
// the top level. Wrapping in the standard `{ data, error }` envelope causes
// the loader to silently no-op and the level never starts. Keep the body
// raw so the bundled-static and API-served paths share one shape.
export const GET = handleRoute(async (_req, context) => {
  const { id } = await context!.params
  const ctx = await requireRole('teacher')

  const wordList = await getTeacherListenTapWordList(ctx.supabase, ctx.user.id, id)
  if (!wordList) {
    throw ApiError.notFound('Word list')
  }

  return NextResponse.json(wordListToGameConfig(wordList), {
    headers: { 'Cache-Control': 'no-store' },
  })
})
