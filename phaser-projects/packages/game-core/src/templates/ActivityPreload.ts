import type Phaser from 'phaser';
import type { Language } from '../i18n';
import ConfigLoader from '../services/ConfigLoader';
import { getPreviewRuntimeSettings } from '../previewRuntime';
import {
  resolveTemplateAudioAssets,
  resolveTemplateImageAssets,
} from './TemplateAssetPreload';

export interface ActivityPreloadOptions {
  gameId: string;
  language: Language;
  nextScene: string;
  label: string;
  discoverAssets: (config: unknown) => {
    images?: Array<string | undefined>;
    audio?: Array<string | undefined>;
  };
  describeLoadError?: (file: { key: string; src: string }) => string;
}

/** Owns one scene's preload lifecycle; renderers supply only content discovery. */
export async function preloadActivity(
  scene: Phaser.Scene,
  options: ActivityPreloadOptions,
): Promise<void> {
  let active = true;
  let loadingText: Phaser.GameObjects.Text | undefined;
  function cleanup(): void {
    scene.events.off('shutdown', shutdown);
    scene.load.off('complete', finish);
    scene.load.off('loaderror', loadError);
    loadingText?.destroy();
    loadingText = undefined;
  }
  function shutdown(): void {
    active = false;
    cleanup();
  }
  function finish(): void {
    if (!active) return;
    active = false;
    cleanup();
    scene.scene.start(options.nextScene);
  }
  function loadError(file: { key: string; src: string }): void {
    console.warn(
      options.describeLoadError?.(file) ??
        `[${options.label}] Failed to load: ${file.key}`,
    );
  }
  scene.events.once('shutdown', shutdown);
  scene.load.on('loaderror', loadError);
  try {
    const preview = getPreviewRuntimeSettings();
    const bundle = await ConfigLoader.getInstance().loadTemplateConfig({
      gameId:
        preview.gameId || ConfigLoader.getGameIdFromUrl() || options.gameId,
      language:
        preview.language ||
        ConfigLoader.getLanguageFromUrl() ||
        options.language,
    });
    if (!active) return;
    const keys = options.discoverAssets(bundle.config);
    const [images, audio] = await Promise.all([
      resolveTemplateImageAssets(keys.images ?? []),
      resolveTemplateAudioAssets(keys.audio ?? []),
    ]);
    if (!active) return;
    const missingImages = images.filter(
      (asset) => !scene.textures.exists(asset.key),
    );
    const missingAudio = audio.filter(
      (asset) => !scene.cache.audio.exists(asset.key),
    );
    if (!missingImages.length && !missingAudio.length) {
      finish();
      return;
    }
    for (const asset of missingImages) scene.load.image(asset.key, asset.url);
    for (const asset of missingAudio) scene.load.audio(asset.key, asset.url);
    const { width, height } = scene.cameras.main;
    loadingText = scene.add
      .text(width / 2, height / 2, 'Loading...', {
        fontSize: '24px',
        color: '#e0e0e0',
        fontFamily: "'Nunito', Arial, sans-serif",
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    scene.load.once('complete', finish);
    scene.load.start();
  } catch (error) {
    if (!active) return;
    active = false;
    cleanup();
    console.error(`[${options.label}] Failed to load config:`, error);
    const { width, height } = scene.cameras.main;
    scene.add
      .text(width / 2, height / 2, `Error: ${String(error)}`, {
        fontSize: '24px',
        color: '#E87D7D',
        align: 'center',
        wordWrap: { width: width - 100 },
      })
      .setOrigin(0.5);
  }
}
