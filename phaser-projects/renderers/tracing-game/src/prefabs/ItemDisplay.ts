import Phaser from 'phaser';
import { ThemeConfig } from '@edu-play/game-core';

export interface ItemDisplayConfig {
    x: number;
    y: number;
    label: string;
    theme: ThemeConfig;
}

export default class ItemDisplay extends Phaser.GameObjects.Container {
    private labelText: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene, config: ItemDisplayConfig) {
        super(scene, config.x, config.y);
        scene.add.existing(this);

        this.labelText = scene.add.text(0, 0, config.label, {
            fontSize: '180px',
            color: config.theme.textColor,
            fontFamily: "'Nunito', Arial, sans-serif",
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5).setAlpha(0.12);

        this.add(this.labelText);
        this.setDepth(-1);
    }

    animateIn(delay = 0): void {
        this.setScale(0);
        this.setAlpha(0);
        this.scene.tweens.add({
            targets: this,
            scaleX: 1,
            scaleY: 1,
            alpha: 1,
            duration: 400,
            delay,
            ease: 'Back.easeOut'
        });
    }

    animateOut(): Promise<void> {
        return new Promise(resolve => {
            this.scene.tweens.add({
                targets: this,
                alpha: 0,
                scaleX: 0.8,
                scaleY: 0.8,
                duration: 300,
                ease: 'Power2',
                onComplete: () => resolve()
            });
        });
    }
}
