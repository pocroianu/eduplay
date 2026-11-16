import Phaser from 'phaser';
import { preloadActivity } from '@edu-play/game-core';

export default class MemoryPreload extends Phaser.Scene {
  constructor() {
    super('Preload');
  }
  async create(): Promise<void> {
    await preloadActivity(this, {
      gameId: 'animals-memory-01',
      language: 'en',
      nextScene: 'MemoryLevel',
      label: 'MemoryPreload',
      discoverAssets(config) {
        const raw = config as { pairs?: Array<{ imageKey?: string }> };
        return { images: raw.pairs?.map((pair) => pair.imageKey) };
      },
    });
  }
}
