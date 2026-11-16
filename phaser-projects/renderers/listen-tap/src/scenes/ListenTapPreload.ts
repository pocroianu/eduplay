import Phaser from 'phaser';
import { preloadActivity } from '@edu-play/game-core';

export default class ListenTapPreload extends Phaser.Scene {
  constructor() {
    super('Preload');
  }
  async create(): Promise<void> {
    await preloadActivity(this, {
      gameId: 'phonics-ro-01',
      language: 'ro',
      nextScene: 'ListenTapLevel',
      label: 'ListenTapPreload',
      discoverAssets(config) {
        const raw = config as { rounds?: Array<{ promptAudioId?: string }> };
        return { audio: raw.rounds?.map((round) => round.promptAudioId) };
      },
      describeLoadError: (file) =>
        `[ListenTapPreload] Failed to load: ${file.key} (${file.src})`,
    });
  }
}
