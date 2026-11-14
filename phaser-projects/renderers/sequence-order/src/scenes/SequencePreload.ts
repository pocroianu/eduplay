import Phaser from 'phaser';
import { ConfigLoader, getPreviewRuntimeSettings, resolveTemplateImageAssets } from '@edu-play/game-core';

/**
 * SequencePreload -- lightweight Preload scene for the sequence-order game.
 * Loads validated template config through ConfigLoader so configUrl/static
 * fallback/cache behavior stays centralized in game-core.
 *
 * Items may use text-rendered mode (e.g. numbers) and therefore may not have an
 * imageKey — only items that declare an imageKey will have their image loaded.
 */
export default class SequencePreload extends Phaser.Scene {
    constructor() {
        super('Preload');
    }

    preload(): void {
        this.load.on('loaderror', (file: any) => {
            console.warn(`[SequencePreload] Failed to load: ${file.key}`);
        });
    }

    async create(): Promise<void> {
        try {
            const preview = getPreviewRuntimeSettings();
            const bundle = await ConfigLoader.getInstance().loadTemplateConfig({
                gameId: preview.gameId || ConfigLoader.getGameIdFromUrl() || 'numbers-1-to-6',
                language: preview.language || ConfigLoader.getLanguageFromUrl() || 'en'
            });
            const raw = bundle.config as unknown as { items?: Array<{ imageKey?: string }> };
            await this.queueImagesAndStart(raw.items?.map(i => i.imageKey).filter(Boolean) as string[] ?? []);
        } catch (err) {
            console.error('[SequencePreload] Failed to load config:', err);
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
                this.scene.start('SequenceLevel');
            });
            this.load.start();
        } else {
            this.scene.start('SequenceLevel');
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
