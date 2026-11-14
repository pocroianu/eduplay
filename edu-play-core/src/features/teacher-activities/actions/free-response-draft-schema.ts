import { z } from 'zod'

import type { FreeResponseDraftFieldErrors } from '../types'

function isWebUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

const linkResourceSchema = z.object({
  title: z.string().trim().min(1, 'Scrie un titlu pentru fiecare resursă.').max(160, 'Titlul resursei este prea lung.'),
  url: z
    .string()
    .trim()
    .url('Folosește un link valid pentru resursă.')
    .refine(isWebUrl, 'Folosește un link web http sau https.'),
})

export const freeResponseDraftSchema = z
  .object({
    title: z.string().trim().min(1, 'Scrie un titlu pentru activitate.').max(200, 'Titlul este prea lung.'),
    prompt: z.string().trim().min(1, 'Scrie instrucțiunile pentru elevi.'),
    allowedTools: z.object({
      text: z.boolean(),
      drawing: z.boolean(),
      voice: z.boolean(),
    }),
    shareWithFamilyOnApproval: z.boolean(),
    resources: z.array(linkResourceSchema).max(6, 'Poți adăuga cel mult 6 resurse.').optional().default([]),
  })
  .refine(
    (value) => value.allowedTools.text || value.allowedTools.drawing || value.allowedTools.voice,
    {
      message: 'Alege cel puțin un mod de răspuns.',
      path: ['allowedTools'],
    },
  )

export function fieldErrorsFromDraftIssues(error: z.ZodError): FreeResponseDraftFieldErrors {
  const fieldErrors: FreeResponseDraftFieldErrors = {}
  for (const issue of error.issues) {
    const field = issue.path[0] as keyof FreeResponseDraftFieldErrors
    const normalizedField = typeof issue.path[0] === 'number' ? 'resources' : field
    if (!fieldErrors[normalizedField]) fieldErrors[normalizedField] = issue.message
  }
  return fieldErrors
}
