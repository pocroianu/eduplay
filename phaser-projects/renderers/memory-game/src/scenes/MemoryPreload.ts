import Phaser from 'phaser';
import { ConfigLoader, getPreviewRuntimeSettings, resolveTemplateImageAssets } from '@edu-play/game-core';

/**
 * MemoryPreload -- lightweight Preload scene for the memory game.
 * Loads validated template config through ConfigLoader so configUrl/static
 * fallback/cache behavior stays centralized in game-core.
 */
export default class MemoryPreload extends Phaser.Scene {
    constructor() {
        super('Preload');
    }

    preload(): void {
        this.load.on('loaderror', (file: any) => {
            console.warn(`[MemoryPreload] Failed to load: ${file.key}`);
        });
    }

    async create(): Promise<void> {
        try {
            const preview = getPreviewRuntimeSettings();
            const bundle = await ConfigLoader.getInstance().loadTemplateConfig({
                gameId: preview.gameId || ConfigLoader.getGameIdFromUrl() || 'animals-memory-01',
                language: preview.language || ConfigLoader.getLanguageFromUrl() || 'en'
            });
            const raw = bundle.config as unknown as { pairs?: Array<{ imageKey?: string }> };
            await this.queueImagesAndStart(raw.pairs?.map(p => p.imageKey).filter(Boolean) as string[] ?? []);
        } catch (err) {
            console.error('[MemoryPreload] Failed to load config:', err);
            this.showError(String(err));
        }
    }

    private async queueImagesAndStart(imageKeys: string[]): Promise<void> {
        const assets = await resolveTemplateImageAssets(imageKeys);
        const { width, height } = this.cameras.main;

        if (assets.length > 0) {
            const loadingText = this.add.text(width / 2, height / 2, 'Loading...', {
                fontSize: '24px',
                color: '#e0e0e0',
                fontFamily: "'Nunito', Arial, sans-serif",
                fontStyle: 'bold',
            }).setOrigin(0.5);

            for (const asset of assets) {
                if (!this.textures.exists(asset.key)) {
                    this.load.image(asset.key, asset.url);
                }
            }

            this.load.once('complete', () => {
                loadingText.destroy();
                this.scene.start('MemoryLevel');
            });
            this.load.start();
        } else {
            this.scene.start('MemoryLevel');
        }
    }

    private showError(message: string): void {
        const { width, height } = this.cameras.main;
        this.add.text(width / 2, height / 2, `Error: ${message}`, {
            fontSize: '24px',
            color: '#E87D7D',
            align: 'center',
            wordWrap: { width: width - 100 }
        }).setOrigin(0.5);
    }
}
