import Phaser from 'phaser';
import { ThemeConfig } from '@edu-play/game-core';

export type DraggableItemState = 'idle' | 'hover' | 'dragging' | 'placed' | 'snapback';

export interface DraggableItemConfig {
    x: number;
    y: number;
    width: number;
    height: number;
    itemId: string;
    categoryId: string;
    imageKey: string;
    label: string;
    theme: ThemeConfig;
}

export default class DraggableItem extends Phaser.GameObjects.Container {
    static readonly EVENTS = {
        PICKED_UP: 'draggable-picked-up',
        PLACED: 'draggable-placed',
        SNAP_BACK: 'draggable-snap-back'
    } as const;

    readonly itemId: string;
    readonly categoryId: string;
    readonly label: string;

    homeX: number;
    homeY: number;

    private bg: Phaser.GameObjects.Graphics;
    private img: Phaser.GameObjects.Image;
    private focusRing: Phaser.GameObjects.Graphics;
    private itemWidth: number;
    private itemHeight: number;
    private theme: ThemeConfig;
    private currentState: DraggableItemState = 'idle';

    constructor(scene: Phaser.Scene, config: DraggableItemConfig) {
        super(scene, config.x, config.y);

        this.itemId = config.itemId;
        this.categoryId = config.categoryId;
        this.label = config.label;
        this.itemWidth = config.width;
        this.itemHeight = config.height;
        this.theme = config.theme;
        this.homeX = config.x;
        this.homeY = config.y;

        // Background
        this.bg = scene.add.graphics();
        this.add(this.bg);

        // Image
        this.img = scene.add.image(0, 0, config.imageKey);
        const maxW = config.width * 0.8;
        const maxH = config.height * 0.8;
        const scale = Math.min(maxW / this.img.width, maxH / this.img.height);
        this.img.setDisplaySize(this.img.width * scale, this.img.height * scale);
        this.add(this.img);

        // Focus ring (hidden by default)
        this.focusRing = scene.add.graphics();
        this.focusRing.setVisible(false);
        this.add(this.focusRing);
        this.drawFocusRing();

        this.drawBackground('idle');

        this.setSize(config.width, config.height);
        this.setInteractive({ draggable: true, useHandCursor: true });

        this.on('pointerover', this.onPointerOver, this);
        this.on('pointerout', this.onPointerOut, this);

        scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    }

    getItemState(): DraggableItemState {
        return this.currentState;
    }

    setItemState(state: DraggableItemState): void {
        this.currentState = state;
        this.drawBackground(state);

        if (state === 'placed') {
            this.disableInteractive();
        }
    }

    animateIn(delay: number): void {
        this.setScale(0);
        this.setAlpha(0);
        this.scene.tweens.add({
            targets: this,
            scaleX: 1,
            scaleY: 1,
            alpha: 1,
            duration: 300,
            delay,
            ease: 'Back.easeOut'
        });
    }

    animateSnapBack(): void {
        this.currentState = 'snapback';

        // Wobble then fly back
        this.scene.tweens.add({
            targets: this,
            x: this.x + 8,
            duration: 50,
            yoyo: true,
            repeat: 2,
            onComplete: () => {
                this.scene.tweens.add({
                    targets: this,
                    x: this.homeX,
                    y: this.homeY,
                    duration: 250,
                    ease: 'Back.easeOut',
                    onComplete: () => {
                        this.setItemState('idle');
                        this.emit(DraggableItem.EVENTS.SNAP_BACK, this);
                    }
                });
            }
        });
    }

    animatePlaced(targetX: number, targetY: number): void {
        this.scene.tweens.add({
            targets: this,
            x: targetX,
            y: targetY,
            scaleX: 0.8,
            scaleY: 0.8,
            duration: 200,
            ease: 'Back.easeIn',
            onComplete: () => {
                // Celebration bounce
                this.scene.tweens.add({
                    targets: this,
                    scaleX: 0.9,
                    scaleY: 0.9,
                    duration: 150,
                    yoyo: true,
                    ease: 'Back.easeOut',
                    onComplete: () => {
                        this.setItemState('placed');
                        this.emit(DraggableItem.EVENTS.PLACED, this);
                    }
                });
            }
        });
    }

    animateOut(delay: number): void {
        this.scene.tweens.add({
            targets: this,
            scaleX: 0,
            scaleY: 0,
            alpha: 0,
            duration: 200,
            delay,
            ease: 'Back.easeIn'
        });
    }

    showFocus(): void {
        this.focusRing.setVisible(true);
    }

    hideFocus(): void {
        this.focusRing.setVisible(false);
    }

    selectViaKeyboard(): void {
        this.setItemState('dragging');
        this.emit(DraggableItem.EVENTS.PICKED_UP, this);
    }

    getAccessibleLabel(): string {
        return this.label;
    }

    private drawBackground(state: DraggableItemState): void {
        this.bg.clear();

        const colors: Record<string, { fill: number; stroke: number }> = {
            idle:     { fill: 0xFFFFFF, stroke: 0xD0D5DD },
            hover:    { fill: 0xF0F4FF, stroke: this.theme.primary },
            dragging: { fill: 0xEEF4FF, stroke: this.theme.primary },
            placed:   { fill: 0xECFDF3, stroke: 0x50c878 },
            snapback: { fill: 0xFFFFFF, stroke: 0xD0D5DD }
        };

        const { fill, stroke } = colors[state] ?? colors['idle'];
        const strokeWidth = state === 'dragging' ? 3 : 2;
        const r = 12;
        const hw = this.itemWidth / 2;
        const hh = this.itemHeight / 2;

        this.bg.fillStyle(fill, 1);
        this.bg.fillRoundedRect(-hw, -hh, this.itemWidth, this.itemHeight, r);
        this.bg.lineStyle(strokeWidth, stroke, 1);
        this.bg.strokeRoundedRect(-hw, -hh, this.itemWidth, this.itemHeight, r);
    }

    private drawFocusRing(): void {
        this.focusRing.clear();
        const hw = this.itemWidth / 2 + 4;
        const hh = this.itemHeight / 2 + 4;
        this.focusRing.lineStyle(3, 0xffcc00, 1);
        this.focusRing.strokeRoundedRect(-hw, -hh, hw * 2, hh * 2, 14);
    }

    private onPointerOver(): void {
        if (this.currentState === 'idle') {
            this.scene.input.setDefaultCursor('grab');
            this.drawBackground('hover');
            this.setScale(1.10);
        }
    }

    private onPointerOut(): void {
        this.scene.input.setDefaultCursor('default');
        if (this.currentState === 'idle') {
            this.drawBackground('idle');
            this.setScale(1);
        }
    }
}
