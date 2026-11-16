import Phaser from 'phaser';
import { preloadActivity } from '@edu-play/game-core';

export default class CategorizePreload extends Phaser.Scene {
  constructor() {
    super('Preload');
  }
  async create(): Promise<void> {
    await preloadActivity(this, {
      gameId: 'animals-habitat-01',
      language: 'en',
      nextScene: 'CategorizeLevel',
      label: 'CategorizePreload',
      discoverAssets(config) {
        const raw = config as {
          items?: Array<{ imageKey?: string }>;
          categories?: Array<{ imageKey?: string }>;
        };
        return {
          images: [...(raw.items ?? []), ...(raw.categories ?? [])].map(
            (item) => item.imageKey,
          ),
        };
      },
    });
  }
}
