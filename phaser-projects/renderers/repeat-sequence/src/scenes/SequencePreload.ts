import Phaser from 'phaser';

/**
 * SequencePreload — lightweight handoff scene for the repeat-sequence game.
 * SequenceLevel loads config/strings through game-core ConfigLoader.
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

    create(): void {
        this.scene.start('SequenceLevel');
    }
}
