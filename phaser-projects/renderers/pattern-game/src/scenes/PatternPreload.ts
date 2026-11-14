import Phaser from 'phaser';

/**
 * PatternPreload — lightweight handoff scene for the pattern game.
 * PatternLevel loads config/strings through game-core ConfigLoader.
 */
export default class PatternPreload extends Phaser.Scene {
    constructor() {
        super('Preload');
    }

    preload(): void {
        this.load.on('loaderror', (file: any) => {
            console.warn(`[PatternPreload] Failed to load: ${file.key}`);
        });
    }

    create(): void {
        this.scene.start('PatternLevel');
    }
}
