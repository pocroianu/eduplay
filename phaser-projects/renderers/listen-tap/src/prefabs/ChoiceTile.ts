import Phaser from 'phaser';
import { ThemeConfig, GAME_FONT } from '@edu-play/game-core';

export interface ChoiceTileData {
    id: string;
    imageAssetId?: string;
    letter?: string;
}

export interface ChoiceTileConfig {
    x: number;
    y: number;
    size: number;
    data: ChoiceTileData;
    correct: boolean;
    theme: ThemeConfig;
}

const FALLBACK_EMOJI: Record<string, string> = {
    'dog-tile': '🐶',
    'cat-tile': '🐱',
    'cow-tile': '🐄',
    'sheep-tile': '🐑',
    'bird-tile': '🐦',
    'horse-tile': '🐴',
    'pig-tile': '🐷',
    'duck-tile': '🦆'
};

/**
 * ChoiceTile — a single answer tile in the listen-tap tray.
 *
 * Tile anatomy:
 *   - Rounded panel (theme-coloured) with a soft drop shadow.
 *   - An image if the config supplies `imageAssetId` and the texture is
 *     loaded; otherwise an emoji fallback from {@link FALLBACK_EMOJI};
 *     otherwise just the letter.
 *   - Optional `letter` overlay — used in phonics rounds where the
 *     letter glyph IS the content.
 *
 * Intentionally large (min 160px) and high-contrast for pre-reader use.
 */
export default class ChoiceTile extends Phaser.GameObjects.Container {
    static readonly EVENTS = {
        TAPPED: 'choice-tile-tapped'
    } as const;

    readonly tileData: ChoiceTileData;
    readonly correct: boolean;

    private size: number;
    private theme: ThemeConfig;
    private panel: Phaser.GameObjects.Graphics;
    private imageSprite: Phaser.GameObjects.Image | null = null;
    private emojiText: Phaser.GameObjects.Text | null = null;
    private letterText: Phaser.GameObjects.Text | null = null;
    private locked = false;

    constructor(scene: Phaser.Scene, config: ChoiceTileConfig) {
        super(scene, config.x, config.y);

        this.tileData = config.data;
        this.correct = config.correct;
        this.size = config.size;
        this.theme = config.theme;

        const shadow = scene.add.graphics();
        shadow.fillStyle(0x000000, 0.22);
        shadow.fillRoundedRect(-this.size / 2, -this.size / 2 + 8, this.size, this.size, 28);
        this.add(shadow);

        this.panel = scene.add.graphics();
        this.drawPanel(0xFFFFFF);
        this.add(this.panel);

        this.addContent();

        this.setSize(this.size, this.size);
        this.setInteractive({ useHandCursor: true });

        this.on('pointerover', this.onPointerOver, this);
        this.on('pointerout', this.onPointerOut, this);
        this.on('pointerdown', this.onPointerDown, this);
        this.on('pointerup', this.onPointerUp, this);

        scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    }

    isLocked(): boolean {
        return this.locked;
    }

    lock(): void {
        this.locked = true;
        this.disableInteractive();
    }

    unlock(): void {
        this.locked = false;
        this.setInteractive({ useHandCursor: true });
    }

    markCorrect(): Promise<void> {
        this.locked = true;
        this.disableInteractive();
        this.drawPanel(0xC8E6C9);
        if (this.letterText) {
            this.letterText.setColor('#1B5E20');
        }
        return new Promise((resolve) => {
            this.scene.tweens.add({
                targets: this,
                scaleX: 1.12,
                scaleY: 1.12,
                duration: 180,
                yoyo: true,
                ease: 'Back.easeOut',
                onComplete: () => resolve()
            });
        });
    }

    markIncorrect(): Promise<void> {
        this.locked = true;
        this.disableInteractive();
        this.drawPanel(0xFFE0B2);
        if (this.letterText) {
            this.letterText.setColor('#E65100');
        }
        const startX = this.x;
        return new Promise((resolve) => {
            this.scene.tweens.chain({
                targets: this,
                tweens: [
                    { x: startX - 8, duration: 60 },
                    { x: startX + 8, duration: 60 },
                    { x: startX - 6, duration: 60 },
                    { x: startX, duration: 60 }
                ],
                onComplete: () => {
                    // Reset after a short rest so the child can retry from calm state.
                    this.scene.time.delayedCall(500, () => {
                        this.drawPanel(0xFFFFFF);
                        if (this.letterText) {
                            this.letterText.setColor('#1A237E');
                        }
                        this.locked = false;
                        this.setInteractive({ useHandCursor: true });
                        resolve();
                    });
                }
            });
        });
    }

    animateIn(delay: number): void {
        this.setScale(0);
        this.setAlpha(0);
        this.scene.tweens.add({
            targets: this,
            scaleX: 1,
            scaleY: 1,
            alpha: 1,
            duration: 320,
            delay,
            ease: 'Back.easeOut'
        });
    }

    private addContent(): void {
        const hasTexture = this.tileData.imageAssetId
            && this.scene.textures.exists(this.tileData.imageAssetId);

        if (hasTexture) {
            const img = this.scene.add.image(0, 0, this.tileData.imageAssetId!);
            const scale = Math.min(
                (this.size * 0.7) / img.width,
                (this.size * 0.7) / img.height
            );
            img.setScale(scale);
            this.add(img);
            this.imageSprite = img;
        } else {
            const emoji = this.tileData.imageAssetId && FALLBACK_EMOJI[this.tileData.imageAssetId];
            if (emoji) {
                this.emojiText = this.scene.add.text(0, 0, emoji, {
                    fontFamily: GAME_FONT,
                    fontSize: `${Math.floor(this.size * 0.55)}px`
                }).setOrigin(0.5);
                this.add(this.emojiText);
            }
        }

        if (this.tileData.letter) {
            const overlayY = (this.emojiText || this.imageSprite) ? this.size * 0.28 : 0;
            this.letterText = this.scene.add.text(0, overlayY, this.tileData.letter, {
                fontFamily: GAME_FONT,
                fontSize: `${Math.floor(this.size * 0.44)}px`,
                fontStyle: 'bold',
                color: '#1A237E'
            }).setOrigin(0.5);
            this.add(this.letterText);
        }
    }

    private drawPanel(fillColor: number): void {
        const panel = this.panel;
        panel.clear();
        panel.fillStyle(fillColor, 1);
        panel.fillRoundedRect(-this.size / 2, -this.size / 2, this.size, this.size, 28);
        panel.lineStyle(5, this.theme.primary, 1);
        panel.strokeRoundedRect(-this.size / 2, -this.size / 2, this.size, this.size, 28);
    }

    private onPointerOver(): void {
        if (this.locked) return;
        this.scene.tweens.add({
            targets: this,
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 140,
            ease: 'Back.easeOut'
        });
    }

    private onPointerOut(): void {
        if (this.locked) return;
        this.scene.tweens.add({
            targets: this,
            scaleX: 1,
            scaleY: 1,
            duration: 140
        });
    }

    private onPointerDown(): void {
        if (this.locked) return;
        this.scene.tweens.add({
            targets: this,
            scaleX: 0.95,
            scaleY: 0.95,
            duration: 80
        });
    }

    private onPointerUp(): void {
        if (this.locked) return;
        this.emit(ChoiceTile.EVENTS.TAPPED, this);
    }
}
