import Phaser from 'phaser';
import { ThemeConfig, GAME_FONT } from '@edu-play/game-core';
import DraggableItem from './DraggableItem';

export interface DropZoneConfig {
    x: number;
    y: number;
    width: number;
    height: number;
    categoryId: string;
    label: string;
    color: string;
    theme: ThemeConfig;
}

export default class DropZone extends Phaser.GameObjects.Container {
    readonly categoryId: string;
    readonly zoneLabel: string;

    private bg: Phaser.GameObjects.Graphics;
    private labelText: Phaser.GameObjects.Text;
    private focusRing: Phaser.GameObjects.Graphics;
    private hitZone: Phaser.GameObjects.Zone;
    private zoneWidth: number;
    private zoneHeight: number;
    private accentColor: number;
    private theme: ThemeConfig;
    private placedItems: DraggableItem[] = [];
    private isHighlighted = false;

    constructor(scene: Phaser.Scene, config: DropZoneConfig) {
        super(scene, config.x, config.y);

        this.categoryId = config.categoryId;
        this.zoneLabel = config.label;
        this.zoneWidth = config.width;
        this.zoneHeight = config.height;
        this.accentColor = parseInt(config.color.replace('#', ''), 16);
        this.theme = config.theme;

        // Background
        this.bg = scene.add.graphics();
        this.add(this.bg);

        // Label at top of zone
        this.labelText = scene.add.text(0, -this.zoneHeight / 2 + 20, config.label, {
            fontSize: '28px',
            color: '#ffffff',
            fontFamily: GAME_FONT,
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);
        this.add(this.labelText);

        // Focus ring (hidden by default)
        this.focusRing = scene.add.graphics();
        this.focusRing.setVisible(false);
        this.add(this.focusRing);
        this.drawFocusRing();

        this.drawBackground(false);

        // Phaser drop zone: a Zone game object that acts as the drop target
        this.hitZone = scene.add.zone(config.x, config.y, config.width, config.height);
        this.hitZone.setRectangleDropZone(config.width, config.height);
        this.hitZone.setData('categoryId', config.categoryId);
        this.hitZone.setData('dropZone', this);

        this.setSize(config.width, config.height);

        scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    }

    getHitZone(): Phaser.GameObjects.Zone {
        return this.hitZone;
    }

    highlight(): void {
        if (this.isHighlighted) return;
        this.isHighlighted = true;
        this.drawBackground(true);
    }

    unhighlight(): void {
        if (!this.isHighlighted) return;
        this.isHighlighted = false;
        this.drawBackground(false);
    }

    addPlacedItem(item: DraggableItem): { x: number; y: number } {
        this.placedItems.push(item);
        const pos = this.getNextSlotPosition();
        return pos;
    }

    getPlacedCount(): number {
        return this.placedItems.length;
    }

    showFocus(): void {
        this.focusRing.setVisible(true);
    }

    hideFocus(): void {
        this.focusRing.setVisible(false);
    }

    getAccessibleLabel(): string {
        return `Category: ${this.zoneLabel}, ${this.placedItems.length} items placed`;
    }

    private getNextSlotPosition(): { x: number; y: number } {
        const count = this.placedItems.length;
        const cols = 3;
        const slotSize = 70;
        const startY = this.y - this.zoneHeight / 2 + 55;
        const row = Math.floor((count - 1) / cols);
        const col = (count - 1) % cols;
        const startX = this.x - ((Math.min(cols, count) - 1) * slotSize) / 2;

        return {
            x: startX + col * slotSize,
            y: startY + row * (slotSize + 5) + slotSize / 2
        };
    }

    private drawBackground(highlighted: boolean): void {
        this.bg.clear();

        const hw = this.zoneWidth / 2;
        const hh = this.zoneHeight / 2;
        const r = 16;

        // Fill
        const fillAlpha = highlighted ? 0.45 : 0.25;
        this.bg.fillStyle(this.accentColor, fillAlpha);
        this.bg.fillRoundedRect(-hw, -hh, this.zoneWidth, this.zoneHeight, r);

        // Border
        const strokeAlpha = highlighted ? 1 : 0.5;
        const strokeWidth = highlighted ? 3 : 2;
        this.bg.lineStyle(strokeWidth, this.accentColor, strokeAlpha);
        this.bg.strokeRoundedRect(-hw, -hh, this.zoneWidth, this.zoneHeight, r);

        if (highlighted) {
            // Inner glow
            this.bg.lineStyle(1, this.accentColor, 0.3);
            this.bg.strokeRoundedRect(-hw + 5, -hh + 5, this.zoneWidth - 10, this.zoneHeight - 10, r - 3);
        }
    }

    private drawFocusRing(): void {
        this.focusRing.clear();
        const hw = this.zoneWidth / 2 + 4;
        const hh = this.zoneHeight / 2 + 4;
        this.focusRing.lineStyle(3, 0xffcc00, 1);
        this.focusRing.strokeRoundedRect(-hw, -hh, hw * 2, hh * 2, 18);
    }
}
