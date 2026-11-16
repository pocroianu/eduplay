import Phaser from 'phaser';
import { preloadActivity } from '@edu-play/game-core';

export default class SequencePreload extends Phaser.Scene {
  constructor() {
    super('Preload');
  }
  async create(): Promise<void> {
    await preloadActivity(this, {
      gameId: 'numbers-1-to-6',
      language: 'en',
      nextScene: 'SequenceLevel',
      label: 'SequencePreload',
      discoverAssets(config) {
        const raw = config as { items?: Array<{ imageKey?: string }> };
        return { images: raw.items?.map((item) => item.imageKey) };
      },
    });
  }
}
