import { z } from 'zod';

const listenTapLanguages = ['ro', 'en'] as const;

const listenTapWordEntrySchema = z.object({
  word: z.string().trim().min(1).max(80),
  promptAudioId: z.string().trim().max(200).optional().default(''),
  imageAssetId: z.string().trim().max(200).optional(),
});

export const createListenTapWordListSchema = z.object({
  name: z.string().trim().min(1).max(120),
  language: z.enum(listenTapLanguages).default('ro'),
  words: z.array(listenTapWordEntrySchema).max(50).default([]),
});

export const updateListenTapWordListSchema = createListenTapWordListSchema.partial();

export const listListenTapWordListsQuerySchema = z.object({
  language: z.enum(listenTapLanguages).optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
});

export type ListenTapWordEntry = z.infer<typeof listenTapWordEntrySchema>;
export type CreateListenTapWordListInput = z.infer<typeof createListenTapWordListSchema>;
export type UpdateListenTapWordListInput = z.infer<typeof updateListenTapWordListSchema>;
