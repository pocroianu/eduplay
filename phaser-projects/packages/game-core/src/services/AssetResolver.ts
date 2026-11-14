/**
 * AssetResolver - Service for resolving game assets
 *
 * Resolves asset manifests to full URLs and generates Phaser-compatible
 * asset packs for dynamic per-game loading.
 */

import {
    AssetManifest,
    AssetRegistry,
    ResolvedAsset,
    PhaserAssetPack,
    PhaserAssetFile,
    AssetManifestResolution,
    SpritesheetRef
} from '../types/AssetSchema';
import { BaseQuestion } from '../types/ConfigSchema';
import {
    resolveAssetRegistryUrl,
    resolvePreviewPath,
    resolveRegistryBasePath
} from '../previewRuntime';

interface AssetManifestConfig {
    meta: {
        gameId: string;
    };
    questions?: BaseQuestion[];
    assets?: AssetManifest;
}

// Lazy getter to avoid circular dependency with GameContextProvider
function getContextProvider(): any {
    return (globalThis as any).__CONTEXT_PROVIDER__;
}

/**
 * AssetResolver manages asset resolution and pack generation
 */
export default class AssetResolver {
    /** Legacy singleton instance for backward compatibility */
    private static legacyInstance: AssetResolver | null = null;

    /** Cached asset registry */
    private registry: AssetRegistry | null = null;

    /** Promise for registry loading (prevents duplicate fetches) */
    private registryPromise: Promise<AssetRegistry> | null = null;

    /** Whether to use spritesheet mode */
    private useSpritesheets: boolean;

    constructor() {
        // Check build-time environment variable (injected by webpack DefinePlugin)
        this.useSpritesheets = (globalThis as any).USE_SPRITESHEETS === 'true' ||
            (typeof process !== 'undefined' && (process.env as Record<string, string | undefined>)?.USE_SPRITESHEETS === 'true');
    }

    /**
     * Get singleton instance
     * @deprecated Use GameContextProvider for new code
     */
    static getInstance(): AssetResolver {
        const provider = getContextProvider();
        if (provider) {
            const context = provider.getActiveContext();
            if (context?.assetResolver) {
                return context.assetResolver;
            }
        }

        if (!AssetResolver.legacyInstance) {
            AssetResolver.legacyInstance = new AssetResolver();
        }
        return AssetResolver.legacyInstance;
    }

    /**
     * Load the asset registry (cached)
     */
    async loadRegistry(baseUrl: string = resolveRegistryBasePath()): Promise<AssetRegistry> {
        if (this.registry) {
            return this.registry;
        }

        if (this.registryPromise) {
            return this.registryPromise;
        }

        this.registryPromise = fetch(resolveAssetRegistryUrl(baseUrl))
            .then(res => {
                if (!res.ok) {
                    throw new Error(`Failed to load asset registry: ${res.status}`);
                }
                return res.json();
            })
            .then((registry: AssetRegistry) => {
                const normalizedRegistry: AssetRegistry = {
                    ...registry,
                    baseUrl: resolvePreviewPath(registry.baseUrl)
                };
                this.registry = normalizedRegistry;
                return normalizedRegistry;
            });

        return this.registryPromise;
    }

    /**
     * Clear the cached registry
     */
    clearCache(): void {
        this.registry = null;
        this.registryPromise = null;
    }

    /**
     * Get asset manifest from the registry or config fallback.
     */
    async getManifest(config: AssetManifestConfig): Promise<AssetManifestResolution> {
        const registry = await this.loadRegistry();
        const registryManifest = this.getRegistryManifest(registry, config.meta.gameId);

        if (registryManifest) {
            return {
                manifest: registryManifest,
                source: 'registry'
            };
        }

        const explicitManifest = config.assets;
        if (explicitManifest) {
            return {
                manifest: this.normalizeManifest(explicitManifest),
                source: 'config'
            };
        }

        console.warn(
            `[AssetResolver] No registry manifest found for game "${config.meta.gameId}". Falling back to derived asset discovery.`
        );

        return {
            manifest: this.deriveFromQuestions(config),
            source: 'derived'
        };
    }

    /**
     * Derive asset manifest from question choices
     */
    private deriveFromQuestions(config: AssetManifestConfig): AssetManifest {
        const images = new Set<string>();
        const audio = new Set<string>();

        for (const question of config.questions ?? []) {
            // Collect audio keys
            if (question.audioKey) {
                audio.add(question.audioKey);
            }

            // Collect image choices
            for (const choice of question.choices) {
                if (choice.type === 'image') {
                    images.add(choice.value);
                }
            }
        }

        return {
            images: Array.from(images),
            audio: Array.from(audio),
            spritesheets: []
        };
    }

    private normalizeManifest(manifest?: Partial<AssetManifest>): AssetManifest {
        return {
            images: Array.from(new Set(manifest?.images ?? [])),
            audio: Array.from(new Set(manifest?.audio ?? [])),
            spritesheets: this.uniqueSpritesheets(manifest?.spritesheets ?? [])
        };
    }

    private mergeManifests(base: AssetManifest, extension?: Partial<AssetManifest>): AssetManifest {
        return {
            images: Array.from(new Set([...base.images, ...(extension?.images ?? [])])),
            audio: Array.from(new Set([...base.audio, ...(extension?.audio ?? [])])),
            spritesheets: this.uniqueSpritesheets([...(base.spritesheets ?? []), ...(extension?.spritesheets ?? [])])
        };
    }

    private uniqueSpritesheets(spritesheets: SpritesheetRef[]): SpritesheetRef[] {
        const seen = new Set<string>();
        return spritesheets.filter((sheet) => {
            if (seen.has(sheet.key)) {
                return false;
            }
            seen.add(sheet.key);
            return true;
        });
    }

    private getRegistryManifest(registry: AssetRegistry, gameId: string, variationId?: string): AssetManifest | null {
        const gameEntry = registry.games?.[gameId];
        if (!gameEntry) {
            return null;
        }

        let manifest = this.normalizeManifest(gameEntry.manifest);

        for (const groupName of gameEntry.sharedGroups ?? []) {
            const groupManifest = registry.sharedGroups?.[groupName];
            if (!groupManifest) {
                console.warn(`[AssetResolver] Shared asset group "${groupName}" is missing for game "${gameId}".`);
                continue;
            }
            manifest = this.mergeManifests(manifest, groupManifest);
        }

        if (variationId) {
            const variation = gameEntry.variations?.[variationId];
            if (variation) {
                for (const groupName of variation.sharedGroups ?? []) {
                    const groupManifest = registry.sharedGroups?.[groupName];
                    if (!groupManifest) {
                        console.warn(
                            `[AssetResolver] Shared asset group "${groupName}" is missing for game "${gameId}" variation "${variationId}".`
                        );
                        continue;
                    }
                    manifest = this.mergeManifests(manifest, groupManifest);
                }
                manifest = this.mergeManifests(manifest, variation.manifest);
            }
        }

        return manifest;
    }

    /**
     * Resolve asset keys to full URLs
     */
    async resolveAssets(manifest: AssetManifest): Promise<ResolvedAsset[]> {
        const registry = await this.loadRegistry();

        if (this.useSpritesheets) {
            return this.resolveWithSpritesheets(manifest, registry);
        }

        return this.resolveIndividualAssets(manifest, registry);
    }

    /**
     * Resolve assets as individual files
     */
    private resolveIndividualAssets(
        manifest: AssetManifest,
        registry: AssetRegistry
    ): ResolvedAsset[] {
        const resolved: ResolvedAsset[] = [];

        // Resolve images
        for (const key of manifest.images) {
            const url = this.findAssetUrl(registry, key, 'image', 'png');
            resolved.push({
                key,
                type: 'image',
                url: url || this.legacyFallbackUrlOrThrow(registry, key, 'image', 'png')
            });
        }

        // Resolve audio
        for (const key of manifest.audio) {
            const url = this.findAssetUrl(registry, key, 'audio', 'mp3');
            resolved.push({
                key,
                type: 'audio',
                url: url || this.legacyFallbackUrlOrThrow(registry, key, 'audio', 'mp3')
            });
        }

        return resolved;
    }

    /**
     * Resolve assets using spritesheets where available
     */
    private resolveWithSpritesheets(
        manifest: AssetManifest,
        registry: AssetRegistry
    ): ResolvedAsset[] {
        const resolved: ResolvedAsset[] = [];
        const neededSheets = new Map<string, Set<string>>();

        // Group images by category (spritesheet)
        for (const key of manifest.images) {
            const pinnedUrl = this.findPinnedAssetUrl(registry, key, 'image');
            if (pinnedUrl) {
                resolved.push({
                    key,
                    type: 'image',
                    url: pinnedUrl
                });
                continue;
            }

            const category = this.findAssetCategory(registry, key);
            if (category) {
                if (!neededSheets.has(category)) {
                    neededSheets.set(category, new Set());
                }
                neededSheets.get(category)!.add(key);
            } else {
                // Fallback to individual image only for legacy registries with category/shared maps.
                resolved.push({
                    key,
                    type: 'image',
                    url: this.legacyFallbackUrlOrThrow(registry, key, 'image', 'png')
                });
            }
        }

        // Add spritesheet references
        for (const [category, frames] of neededSheets) {
            resolved.push({
                key: `${category}-atlas`,
                type: 'spritesheet',
                url: resolvePreviewPath(`assets/spritesheets/${category}.png`),
                atlasUrl: resolvePreviewPath(`assets/spritesheets/${category}.json`)
            });
        }

        // Audio is always individual files
        for (const key of manifest.audio) {
            const url = this.findAssetUrl(registry, key, 'audio', 'mp3');
            resolved.push({
                key,
                type: 'audio',
                url: url || this.legacyFallbackUrlOrThrow(registry, key, 'audio', 'mp3')
            });
        }

        return resolved;
    }

    /**
     * Find the URL for an asset key
     */
    private findAssetUrl(
        registry: AssetRegistry,
        key: string,
        type: 'image' | 'audio',
        ext: string
    ): string | null {
        const pinnedAssetUrl = this.findPinnedAssetUrl(registry, key, type);
        if (pinnedAssetUrl) {
            return pinnedAssetUrl;
        }

        // Search in categories
        for (const category of Object.values(registry.categories ?? {})) {
            if (category.assets.includes(key)) {
                const path = category.path ? `${category.path}/` : '';
                return `${registry.baseUrl}/${path}${key}.${ext}`;
            }
        }

        // Search in shared
        for (const group of Object.values(registry.shared ?? {})) {
            if (group.assets.includes(key)) {
                const path = group.path ? `${group.path}/` : '';
                return `${registry.baseUrl}/${path}${key}.${ext}`;
            }
        }

        return null;
    }

    private findPinnedAssetUrl(
        registry: AssetRegistry,
        key: string,
        type: 'image' | 'audio'
    ): string | null {
        const pinnedAsset = registry.pinnedAssets?.[key];
        return pinnedAsset?.type === type ? resolvePreviewPath(pinnedAsset.path) : null;
    }

    private legacyFallbackUrlOrThrow(
        registry: AssetRegistry,
        key: string,
        type: 'image' | 'audio',
        ext: string
    ): string {
        if (this.hasLegacyAssetMaps(registry)) {
            return resolvePreviewPath(`assets/${key}.${ext}`);
        }

        throw new Error(`Unable to resolve ${type} asset "${key}" from Activity asset manifest pins`);
    }

    private hasLegacyAssetMaps(registry: AssetRegistry): boolean {
        return registry.categories !== undefined || registry.shared !== undefined;
    }

    /**
     * Find which category an asset belongs to
     */
    private findAssetCategory(registry: AssetRegistry, key: string): string | null {
        for (const [catName, category] of Object.entries(registry.categories ?? {})) {
            if (category.assets.includes(key)) {
                return catName;
            }
        }
        return null;
    }

    /**
     * Generate a Phaser-compatible asset pack
     */
    async generateAssetPack(manifest: AssetManifest): Promise<PhaserAssetPack> {
        const resolved = await this.resolveAssets(manifest);

        const files: PhaserAssetFile[] = resolved.map(asset => {
            if (asset.type === 'spritesheet') {
                return {
                    type: 'atlas' as const,
                    key: asset.key,
                    textureURL: asset.url,
                    atlasURL: asset.atlasUrl!,
                    url: asset.url
                };
            } else if (asset.type === 'audio') {
                return {
                    type: 'audio' as const,
                    key: asset.key,
                    url: [asset.url]
                };
            } else {
                return {
                    type: 'image' as const,
                    key: asset.key,
                    url: asset.url
                };
            }
        });

        return {
            game: { files },
            meta: {
                app: 'Dynamic Asset Pack Generator',
                version: 1,
                generated: new Date().toISOString()
            }
        };
    }

    /**
     * Get the list of all available asset keys
     */
    async getAllAssetKeys(): Promise<string[]> {
        const registry = await this.loadRegistry();
        const keys: string[] = [];

        keys.push(...Object.keys(registry.pinnedAssets ?? {}));

        for (const category of Object.values(registry.categories ?? {})) {
            keys.push(...category.assets);
        }

        for (const group of Object.values(registry.shared ?? {})) {
            keys.push(...group.assets);
        }

        return Array.from(new Set(keys));
    }

    /**
     * Check if spritesheet mode is enabled
     */
    isSpritesheetMode(): boolean {
        return this.useSpritesheets;
    }

    /**
     * Set spritesheet mode (for testing)
     */
    setSpritesheetMode(enabled: boolean): void {
        this.useSpritesheets = enabled;
    }
}
