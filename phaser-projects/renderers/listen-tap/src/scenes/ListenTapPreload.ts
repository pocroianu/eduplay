import Phaser from 'phaser';
import { ConfigLoader, getPreviewRuntimeSettings, resolveTemplateAudioAssets } from '@edu-play/game-core';

interface PreloadChoice {
    id?: string;
    imageAssetId?: string;
    letter?: string;
    correct?: boolean;
}

interface PreloadRound {
    id?: string;
    promptAudioId?: string;
    choices?: PreloadChoice[];
}

interface PreloadConfig {
    meta?: { gameId?: string };
    rounds?: PreloadRound[];
}

const DEFAULT_GAME_ID = 'phonics-ro-01';

/**
 * ListenTapPreload â€” template-owned Preload scene.
 *
 * Listen-tap configs use a `rounds` array rather than the shared
 * `questions` schema, so we load validated template config through
 * ConfigLoader and then queue only the referenced MP3s before handoff.
 */
export default class ListenTapPreload extends Phaser.Scene {
    constructor() {
        super('Preload');
    }

    preload(): void {
        this.load.on('loaderror', (file: any) => {
            // Non-fatal: placeholder audio may be absent while Phase 2 TTS is pending.
            console.warn(`[ListenTapPreload] Failed to load: ${file.key} (${file.src})`);
        });
    }

    async create(): Promise<void> {
        try {
            const preview = getPreviewRuntimeSettings();
            const bundle = await ConfigLoader.getInstance().loadTemplateConfig({
                gameId: preview.gameId || ConfigLoader.getGameIdFromUrl() || DEFAULT_GAME_ID,
                language: preview.language || ConfigLoader.getLanguageFromUrl() || 'ro'
            });
            await this.queueAudioLoadsAndStart(bundle.config as unknown as PreloadConfig);
        } catch (err) {
            console.error('[ListenTapPreload] Failed to load config:', err);
            this.showError(String(err));
        }
    }

    private async queueAudioLoadsAndStart(raw: PreloadConfig | undefined): Promise<void> {
        const audioIds: string[] = [];
        for (const round of raw?.rounds ?? []) {
            if (round.promptAudioId) {
                audioIds.push(round.promptAudioId);
            }
        }

        const assets = await resolveTemplateAudioAssets(audioIds);
        const queuedAssets = assets.filter((asset) => !this.cache.audio.exists(asset.key));

        if (queuedAssets.length === 0) {
            this.scene.start('ListenTapLevel');
            return;
        }

        for (const asset of queuedAssets) {
            this.load.audio(asset.key, asset.url);
        }

        const { width, height } = this.cameras.main;
        const loadingText = this.add.text(width / 2, height / 2, 'Loading...', {
            fontSize: '24px',
            color: '#e0e0e0',
            fontFamily: "'Nunito', Arial, sans-serif",
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.load.once('complete', () => {
            loadingText.destroy();
            this.scene.start('ListenTapLevel');
        });
        this.load.start();
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
