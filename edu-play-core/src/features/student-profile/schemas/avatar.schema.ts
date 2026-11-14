import { z } from 'zod';

/**
 * Twelve static avatar presets ship as SVG so they stay crisp at every tile
 * size (preview 96px → header 128px). Final raster sources can replace the
 * SVGs without changing this contract — keep the filenames stable.
 */
export const AVATAR_PRESETS = [
  '/avatars/preset-01.svg',
  '/avatars/preset-02.svg',
  '/avatars/preset-03.svg',
  '/avatars/preset-04.svg',
  '/avatars/preset-05.svg',
  '/avatars/preset-06.svg',
  '/avatars/preset-07.svg',
  '/avatars/preset-08.svg',
  '/avatars/preset-09.svg',
  '/avatars/preset-10.svg',
  '/avatars/preset-11.svg',
  '/avatars/preset-12.svg',
] as const;

export const avatarPresetSchema = z.enum(AVATAR_PRESETS);

export type AvatarPreset = z.infer<typeof avatarPresetSchema>;

export const updateAvatarSchema = z.object({
  avatarUrl: avatarPresetSchema,
});

export type UpdateAvatarFormData = z.infer<typeof updateAvatarSchema>;
