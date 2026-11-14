import { z } from 'zod';

const semverRangeSchema = z.string().regex(/^[~^]?\d+\.\d+\.\d+$/, 'Expected a semver version or simple ^/~ semver range');
const semverSchema = z.string().regex(/^\d+\.\d+\.\d+$/, 'Expected semver version (e.g. 1.0.0)');

export const activityMetadataSchema = z.object({
  activityId: z.string().min(1),
  version: z.number().int().positive(),
  renderer: z.object({
    id: z.string().min(1),
    version: semverRangeSchema
  }).strict(),
  gameId: z.string().min(1)
}).strict();

export type ActivityMetadata = z.infer<typeof activityMetadataSchema>;

export const activitySpritesheetRefSchema = z.object({
  key: z.string().min(1),
  url: z.string().min(1),
  atlasUrl: z.string().min(1),
  frames: z.array(z.string().min(1)).optional()
}).strict();

export const activityAssetManifestSchema = z.object({
  images: z.array(z.string().min(1)),
  audio: z.array(z.string().min(1)),
  spritesheets: z.array(activitySpritesheetRefSchema).optional()
}).strict();

export const activityAssetCategorySchema = z.object({
  path: z.string(),
  assets: z.array(z.string().min(1))
}).strict();

const sha256AssetIdSchema = z.string().regex(/^sha256-[a-f0-9]{64}$/, 'Expected sha256-<64 lowercase hex characters>');
const sha256DigestSchema = z.string().regex(/^[a-f0-9]{64}$/, 'Expected 64 lowercase hex characters');

function assetIdMatchesDigest<T extends { assetId: string; sha256: string }>(asset: T): boolean {
  return asset.assetId === `sha256-${asset.sha256}`;
}

const semanticImageLibraryPathSchema = z.string()
  .regex(/^\/assets\/library\/images\/[A-Za-z0-9][A-Za-z0-9._-]*\.png$/, 'Expected a semantic /assets/library/images/<name>.png URL')
  .refine((path) => !/\/sha256-[a-f0-9]{64}\.png$/.test(path), 'Expected a semantic filename, not a hash-only filename');

const semanticAudioLibraryPathSchema = z.string()
  .regex(/^\/assets\/library\/audio\/[A-Za-z0-9][A-Za-z0-9._-]*\.(mp3|wav)$/, 'Expected a semantic /assets/library/audio/<name>.mp3 or .wav URL')
  .refine((path) => !/\/sha256-[a-f0-9]{64}\.(mp3|wav)$/.test(path), 'Expected a semantic filename, not a hash-only filename');

const activityPinnedImageAssetSchema = z.object({
  type: z.literal('image'),
  assetId: sha256AssetIdSchema,
  sha256: sha256DigestSchema,
  path: semanticImageLibraryPathSchema
}).strict();

const activityPinnedAudioAssetSchema = z.object({
  type: z.literal('audio'),
  assetId: sha256AssetIdSchema,
  sha256: sha256DigestSchema,
  path: semanticAudioLibraryPathSchema
}).strict();

export const activityPinnedAssetSchema = z.discriminatedUnion('type', [
  activityPinnedImageAssetSchema,
  activityPinnedAudioAssetSchema
]).refine(assetIdMatchesDigest, {
  message: 'assetId must match sha256 digest',
  path: ['assetId']
});

export const activityAssetVariationSchema = z.object({
  manifest: activityAssetManifestSchema.partial().optional(),
  sharedGroups: z.array(z.string().min(1)).optional()
}).strict();

export const activityAssetGameEntrySchema = z.object({
  manifest: activityAssetManifestSchema,
  sharedGroups: z.array(z.string().min(1)).optional(),
  variations: z.record(activityAssetVariationSchema).optional()
}).strict();

export const activityAssetRegistrySchema = z.object({
  version: semverSchema,
  baseUrl: z.string().min(1),
  categories: z.record(activityAssetCategorySchema).optional(),
  shared: z.record(activityAssetCategorySchema).optional(),
  sharedGroups: z.record(activityAssetManifestSchema).optional(),
  pinnedAssets: z.record(activityPinnedAssetSchema).optional(),
  games: z.record(activityAssetGameEntrySchema).refine((games) => Object.keys(games).length > 0, 'At least one game asset manifest is required')
}).strict();

export type ActivityAssetRegistry = z.infer<typeof activityAssetRegistrySchema>;

export type ActivityAssetPinValidationResult =
  | { success: true }
  | { success: false; errors: string[] };

export function validateActivityAssetPins(
  registry: ActivityAssetRegistry,
  gameId: string
): ActivityAssetPinValidationResult {
  const errors: string[] = [];
  const gameEntry = registry.games[gameId];

  if (!gameEntry) {
    return {
      success: false,
      errors: [`games.${gameId} is missing from Activity asset manifest`]
    };
  }

  validatePinnedAssetSemanticFilenames(registry, errors);

  const sharedGroupManifests: Array<{ path: string; manifest: ActivityAssetManifest }> = [];
  collectSharedGroups(registry, gameEntry.sharedGroups ?? [], `games.${gameId}.sharedGroups`, errors, sharedGroupManifests);

  validateManifestPins(registry, gameEntry.manifest, `games.${gameId}.manifest`, errors);
  for (const group of sharedGroupManifests) {
    validateManifestPins(registry, group.manifest, group.path, errors);
  }

  for (const [variationId, variation] of Object.entries(gameEntry.variations ?? {})) {
    const variationPath = `games.${gameId}.variations.${variationId}`;
    if (variation.manifest) {
      validateManifestPins(registry, normalizePartialManifest(variation.manifest), `${variationPath}.manifest`, errors);
    }

    const variationGroups: Array<{ path: string; manifest: ActivityAssetManifest }> = [];
    collectSharedGroups(registry, variation.sharedGroups ?? [], `${variationPath}.sharedGroups`, errors, variationGroups);
    for (const group of variationGroups) {
      validateManifestPins(registry, group.manifest, group.path, errors);
    }
  }

  return errors.length === 0 ? { success: true } : { success: false, errors };
}

type ActivityAssetManifest = z.infer<typeof activityAssetManifestSchema>;

function collectSharedGroups(
  registry: ActivityAssetRegistry,
  groupNames: string[],
  path: string,
  errors: string[],
  manifests: Array<{ path: string; manifest: ActivityAssetManifest }>
): void {
  for (const groupName of groupNames) {
    const groupManifest = registry.sharedGroups?.[groupName];
    if (!groupManifest) {
      errors.push(`${path}.${groupName} is not defined in sharedGroups`);
      continue;
    }
    manifests.push({ path: `sharedGroups.${groupName}`, manifest: groupManifest });
  }
}

function validateManifestPins(
  registry: ActivityAssetRegistry,
  manifest: ActivityAssetManifest,
  path: string,
  errors: string[]
): void {
  validatePinsForKeys(registry, manifest.images, 'image', `${path}.images`, errors);
  validatePinsForKeys(registry, manifest.audio, 'audio', `${path}.audio`, errors);
}

function validatePinsForKeys(
  registry: ActivityAssetRegistry,
  keys: string[],
  type: 'image' | 'audio',
  path: string,
  errors: string[]
): void {
  for (const key of keys) {
    const pin = registry.pinnedAssets?.[key];
    if (!pin) {
      errors.push(`${path}.${key} is missing an ${type} pin in pinnedAssets`);
    } else if (pin.type !== type) {
      errors.push(`${path}.${key} has a ${pin.type} pin, expected ${type}`);
    }
  }
}

function validatePinnedAssetSemanticFilenames(
  registry: ActivityAssetRegistry,
  errors: string[]
): void {
  for (const [key, pin] of Object.entries(registry.pinnedAssets ?? {})) {
    if (libraryPathStem(pin.path) !== key) {
      errors.push(`pinnedAssets.${key} points at ${pin.path}, expected semantic filename ${key}`);
    }
  }
}

function libraryPathStem(path: string): string {
  const fileName = path.slice(path.lastIndexOf('/') + 1);
  return fileName.replace(/\.(png|mp3|wav)$/, '');
}

function normalizePartialManifest(manifest: Partial<ActivityAssetManifest>): ActivityAssetManifest {
  return {
    images: manifest.images ?? [],
    audio: manifest.audio ?? [],
    spritesheets: manifest.spritesheets ?? []
  };
}
