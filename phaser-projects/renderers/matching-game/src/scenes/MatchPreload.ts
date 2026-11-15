import Phaser from 'phaser';
import { preloadActivity } from '@edu-play/game-core';

export default class MatchPreload extends Phaser.Scene {
  constructor() {
    super('Preload');
  }
  async create(): Promise<void> {
    await preloadActivity(this, {
      gameId: 'animals-match-01',
      language: 'en',
      nextScene: 'MatchLevel',
      label: 'MatchPreload',
      discoverAssets(config) {
        const raw = config as { pairs?: Array<{ imageKey?: string }> };
        return { images: raw.pairs?.map((pair) => pair.imageKey) };
      },
    });
  }
}
