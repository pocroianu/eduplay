import Phaser from 'phaser';
import { loadGoogleFont } from '@edu-play/game-core';

export default class PrototypePreload extends Phaser.Scene {
    constructor() {
        super('Preload');
    }

    preload(): void {
        this.load.on('loaderror', (file: { key?: string }) => {
            console.warn(`[PrototypePreload] Failed to load: ${file.key}`);
        });
    }

    async create(): Promise<void> {
        await loadGoogleFont('Nunito', [700, 800, 900]);
        this.scene.start('PrototypeOddOneOutLevel');
    }
}
