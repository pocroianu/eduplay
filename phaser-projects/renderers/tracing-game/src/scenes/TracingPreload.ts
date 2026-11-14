import Phaser from 'phaser';

/**
 * TracingPreload -- lightweight handoff scene for the tracing game.
 * TracingLevel loads config/strings through game-core ConfigLoader.
 */
export default class TracingPreload extends Phaser.Scene {
    constructor() {
        super('Preload');
    }

    preload(): void {
        this.load.on('loaderror', (file: any) => {
            console.warn(`[TracingPreload] Failed to load: ${file.key}`);
        });
    }

    create(): void {
        this.scene.start('TracingLevel');
    }
}
