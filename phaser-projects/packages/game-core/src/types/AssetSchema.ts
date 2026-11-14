/**
 * Asset Schema Types
 *
 * Type definitions for the scalable asset management system.
 * Supports per-game asset loading and optional spritesheet mode.
 */

/**
 * Asset manifest declaring which assets a game needs
 */
export interface AssetManifest {
    /** Image asset keys required by this game */
    images: string[];
    /** Audio asset keys required by this game */
    audio: string[];
    /** Optional spritesheet references */
    spritesheets?: SpritesheetRef[];
}

/**
 * Reference to a spritesheet atlas
 */
export interface SpritesheetRef {
    /** Unique key for this spritesheet */
    key: string;
    /** URL to the spritesheet image */
    url: string;
    /** URL to the atlas JSON */
    atlasUrl: string;
    /** Frame names within this spritesheet (optional) */
    frames?: string[];
}

/**
 * A resolved asset with full URL path
 */
export interface ResolvedAsset {
    /** Asset key (used in Phaser) */
    key: string;
    /** Asset type */
    type: 'image' | 'audio' | 'spritesheet';
    /** Full URL to the asset */
    url: string;
    /** Atlas URL for spritesheets */
    atlasUrl?: string;
}

/**
 * Category definition in the asset registry
 */
export interface AssetCategory {
    /** Relative path from baseUrl */
    path: string;
    /** List of asset keys in this category */
    assets: string[];
}

/**
 * Activity-local pin to a semantic shared asset-library path with hash integrity.
 */
export interface PinnedAssetRef {
    /** Runtime asset type */
    type: 'image' | 'audio';
    /** Immutable library id, usually sha256-<digest> */
    assetId: string;
    /** Hex SHA-256 digest of the blob */
    sha256: string;
    /** Runtime URL path to the library blob */
    path: string;
}

/**
 * Reusable asset manifest groups that can be included by games/variations.
 */
export interface AssetManifestGroup extends AssetManifest {}

/**
 * Per-variation registry entry.
 */
export interface AssetVariationRegistryEntry {
    /** Optional manifest override for this variation */
    manifest?: Partial<AssetManifest>;
    /** Shared groups to include for this variation */
    sharedGroups?: string[];
}

/**
 * Per-game registry entry.
 */
export interface AssetGameRegistryEntry {
    /** Required assets for this game */
    manifest: AssetManifest;
    /** Shared manifest groups to merge in */
    sharedGroups?: string[];
    /** Optional future variation-level overrides */
    variations?: Record<string, AssetVariationRegistryEntry>;
}

/**
 * Asset registry structure
 */
export interface AssetRegistry {
    /** Registry version */
    version: string;
    /** Base URL for all assets */
    baseUrl: string;
    /** Legacy game asset categories (older registries only; pruned Activity manifests use pinnedAssets) */
    categories?: Record<string, AssetCategory>;
    /** Legacy shared assets (older registries only; pruned Activity manifests use pinnedAssets) */
    shared?: Record<string, AssetCategory>;
    /** Reusable manifest groups */
    sharedGroups?: Record<string, AssetManifestGroup>;
    /** Activity-local semantic pins into the shared asset library */
    pinnedAssets?: Record<string, PinnedAssetRef>;
    /** Per-game required assets */
    games?: Record<string, AssetGameRegistryEntry>;
}

export type AssetManifestSource = 'registry' | 'config' | 'derived';

export interface AssetManifestResolution {
    manifest: AssetManifest;
    source: AssetManifestSource;
}

/**
 * Phaser asset pack file structure
 */
export interface PhaserAssetPack {
    [sectionName: string]: {
        files: PhaserAssetFile[];
    } | PhaserPackMeta;
}

/**
 * Single file entry in a Phaser asset pack
 */
export interface PhaserAssetFile {
    type: 'image' | 'audio' | 'atlas' | 'spritesheet';
    key: string;
    url: string | string[];
    atlasURL?: string;
    textureURL?: string;
}

/**
 * Phaser asset pack metadata
 */
export interface PhaserPackMeta {
    app: string;
    version: number;
    generated?: string;
}

/**
 * Result of loading a game with its assets
 */
export interface GameWithAssets {
    /** Hydrated game configuration */
    config: import('./ConfigSchema').HydratedGameConfig;
    /** Selected manifest used to resolve assets */
    manifest: AssetManifest;
    /** How the manifest was selected */
    manifestSource: AssetManifestSource;
    /** Resolved asset list */
    assets: ResolvedAsset[];
    /** Generated Phaser asset pack */
    assetPack: PhaserAssetPack;
}
