import Phaser from 'phaser';
import { ThemeConfig, GAME_FONT } from '@edu-play/game-core';

export interface SlotIndicatorConfig {
    x: number;
    y: number;
    totalSlots: number;
    slotWidth: number;
    slotGap: number;
    theme: ThemeConfig;
}

export default class SlotIndicator extends Phaser.GameObjects.Container {
    private dots: Phaser.GameObjects.Graphics[] = [];
    private labels: Phaser.GameObjects.Text[] = [];
    private slotXPositions: number[] = [];

    constructor(scene: Phaser.Scene, config: SlotIndicatorConfig) {
        super(scene, config.x, config.y);

        const totalWidth = config.totalSlots * config.slotWidth + (config.totalSlots - 1) * config.slotGap;
        const startX = -totalWidth / 2 + config.slotWidth / 2;

        for (let i = 0; i < config.totalSlots; i++) {
            const slotX = startX + i * (config.slotWidth + config.slotGap);
            this.slotXPositions.push(slotX);

            const dot = scene.add.graphics();
            dot.fillStyle(config.theme.primary, 0.3);
            dot.fillCircle(slotX, 0, 18);
            dot.lineStyle(2, config.theme.primary, 0.5);
            dot.strokeCircle(slotX, 0, 18);
            this.add(dot);
            this.dots.push(dot);

            const label = scene.add.text(slotX, 0, `${i + 1}`, {
                fontSize: '20px',
                color: '#ffffff',
                fontFamily: GAME_FONT,
                fontStyle: 'bold',
                align: 'center'
            }).setOrigin(0.5).setAlpha(0.8);
            this.add(label);
            this.labels.push(label);
        }

        scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    }

    getSlotX(index: number): number {
        return this.slotXPositions[index] ?? 0;
    }

    getSlotWorldX(index: number): number {
        return this.x + this.getSlotX(index);
    }
}
