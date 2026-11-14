import Phaser from 'phaser';
import { ThemeConfig, GAME_FONT } from '@edu-play/game-core';

export type OrderableItemState = 'idle' | 'hover' | 'dragging' | 'locked';

export interface OrderableItemConfig {
    x: number;
    y: number;
    width: number;
    height: number;
    itemId: string;
    position: number;
    imageKey?: string;
    label: string;
    theme: ThemeConfig;
}

export default class OrderableItem extends Phaser.GameObjects.Container {
    static readonly EVENTS = {
        PICKED_UP: 'orderable-picked-up',
        DROPPED: 'orderable-dropped'
    } as const;

    readonly itemId: string;
    readonly correctPosition: number;
    readonly label: string;

    slotIndex: number;
    homeX: number;
    homeY: number;

    private bg: Phaser.GameObjects.Graphics;
    private img: Phaser.GameObjects.Image | null = null;
    private labelText: Phaser.GameObjects.Text | null = null;
    private focusRing: Phaser.GameObjects.Graphics;
    private itemWidth: number;
    private itemHeight: number;
    private theme: ThemeConfig;
    private currentState: OrderableItemState = 'idle';

    constructor(scene: Phaser.Scene, config: OrderableItemConfig) {
        super(scene, config.x, config.y);

        this.itemId = config.itemId;
        this.correctPosition = config.position;
        this.label = config.label;
        this.itemWidth = config.width;
        this.itemHeight = config.height;
        this.theme = config.theme;
        this.homeX = config.x;
        this.homeY = config.y;
        this.slotIndex = config.position - 1;

        // Background
        this.bg = scene.add.graphics();
        this.add(this.bg);

        // Image or text-rendered card
        if (config.imageKey && scene.textures.exists(config.imageKey)) {
            this.img = scene.add.image(0, 0, config.imageKey);
            const maxW = config.width * 0.7;
            const maxH = config.height * 0.7;
            const scale = Math.min(maxW / this.img.width, maxH / this.img.height);
            this.img.setDisplaySize(this.img.width * scale, this.img.height * scale);
            this.add(this.img);
        } else {
            this.labelText = scene.add.text(0, 0, config.label, {
                fontSize: `${Math.floor(config.height * 0.5)}px`,
                color: '#1F2937',
                fontFamily: GAME_FONT,
                fontStyle: 'bold',
                align: 'center'
            }).setOrigin(0.5);
            this.add(this.labelText);
        }

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

    getItemState(): OrderableItemState {
        return this.currentState;
    }

    setItemState(state: OrderableItemState): void {
        this.currentState = state;
        this.drawBackground(state);

        if (state === 'locked') {
            this.disableInteractive();
        }
    }

    isInCorrectSlot(): boolean {
        return this.slotIndex === this.correctPosition - 1;
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

    animateToSlot(targetX: number, duration = 250): void {
        this.scene.tweens.add({
            targets: this,
            x: targetX,
            duration,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.homeX = targetX;
            }
        });
    }

    animateSnapBack(): void {
        this.scene.tweens.add({
            targets: this,
            x: this.homeX,
            y: this.homeY,
            duration: 250,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.setItemState('idle');
            }
        });
    }

    animateLocked(): void {
        this.scene.tweens.add({
            targets: this,
            scaleX: 1.15,
            scaleY: 1.15,
            duration: 200,
            yoyo: true,
            repeat: 1,
            ease: 'Back.easeOut'
        });
    }

    showFocus(): void {
        this.focusRing.setVisible(true);
    }

    hideFocus(): void {
        this.focusRing.setVisible(false);
    }

    showCorrectHint(): void {
        if (this.currentState === 'locked') return;
        this.drawBackground('correct' as any);
    }

    clearCorrectHint(): void {
        if (this.currentState === 'locked') return;
        this.drawBackground(this.currentState);
    }

    selectViaKeyboard(): void {
        this.setItemState('dragging');
        this.emit(OrderableItem.EVENTS.PICKED_UP, this);
    }

    getAccessibleLabel(): string {
        return `${this.label}, position ${this.slotIndex + 1}`;
    }

    private drawBackground(state: OrderableItemState): void {
        this.bg.clear();

        const colors: Record<string, { fill: number; stroke: number }> = {
            idle:     { fill: 0xFFFFFF, stroke: 0xD0D5DD },
            hover:    { fill: 0xF0F4FF, stroke: this.theme.primary },
            dragging: { fill: 0xEEF4FF, stroke: this.theme.primary },
            locked:   { fill: 0xECFDF3, stroke: 0x50c878 },
            correct:  { fill: 0xECFDF3, stroke: 0x50c878 }
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
