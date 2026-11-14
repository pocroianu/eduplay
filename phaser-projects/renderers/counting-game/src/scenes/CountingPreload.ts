import Phaser from 'phaser';

/**
 * CountingPreload — lightweight handoff scene for the counting game.
 * CountingLevel loads config/strings through game-core ConfigLoader.
 */
export default class CountingPreload extends Phaser.Scene {
    constructor() {
        super('Preload');
    }

    preload(): void {
        this.load.on('loaderror', (file: any) => {
            console.warn(`[CountingPreload] Failed to load: ${file.key}`);
        });
    }

    create(): void {
        this.scene.start('CountingLevel');
    }
}
