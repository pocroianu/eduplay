import Phaser from 'phaser';
import { ThemeConfig, GAME_FONT } from '@edu-play/game-core';

export interface NumeralTrayConfig {
    x: number;
    y: number;
    numerals: number[];
    correctNumeral: number;
    theme: ThemeConfig;
}

interface NumeralButton {
    container: Phaser.GameObjects.Container;
    panel: Phaser.GameObjects.Graphics;
    label: Phaser.GameObjects.Text;
    value: number;
    locked: boolean;
}

/**
 * NumeralTray — a row of number-buttons the child picks from to answer
 * "how many are there?". Emits CORRECT / INCORRECT on tap, runs the
 * appropriate celebratory or gentle-shake animation, and locks buttons
 * after a correct answer.
 */
export default class NumeralTray extends Phaser.GameObjects.Container {
    static readonly EVENTS = {
        CORRECT: 'numeral-correct',
        INCORRECT: 'numeral-incorrect'
    } as const;

    private buttons: NumeralButton[] = [];
    private theme: ThemeConfig;
    private correctNumeral: number;
    private solved = false;

    constructor(scene: Phaser.Scene, config: NumeralTrayConfig) {
        super(scene, config.x, config.y);

        this.theme = config.theme;
        this.correctNumeral = config.correctNumeral;

        const buttonSize = 100;
        const gap = 24;
        const totalWidth = config.numerals.length * buttonSize + (config.numerals.length - 1) * gap;
        const startX = -totalWidth / 2 + buttonSize / 2;

        for (let i = 0; i < config.numerals.length; i++) {
            const value = config.numerals[i];
            const bx = startX + i * (buttonSize + gap);
            const btn = this.createButton(bx, 0, buttonSize, value);
            this.buttons.push(btn);
            this.add(btn.container);
        }

        scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    }

    animateIn(): void {
        this.buttons.forEach((btn, i) => {
            btn.container.setScale(0);
            btn.container.setAlpha(0);
            this.scene.tweens.add({
                targets: btn.container,
                scaleX: 1,
                scaleY: 1,
                alpha: 1,
                duration: 280,
                delay: i * 80,
                ease: 'Back.easeOut'
            });
        });
    }

    lockAll(): void {
        this.buttons.forEach(btn => {
            btn.locked = true;
            btn.container.disableInteractive();
        });
    }

    setCorrectNumeral(value: number): void {
        this.correctNumeral = value;
    }

    private createButton(x: number, y: number, size: number, value: number): NumeralButton {
        const container = this.scene.add.container(x, y);

        const shadow = this.scene.add.graphics();
        shadow.fillStyle(this.theme.primary, 1);
        shadow.fillRoundedRect(-size / 2, -size / 2 + 6, size, size, 22);
        container.add(shadow);

        const panel = this.scene.add.graphics();
        this.drawPanel(panel, size, 0xFFFFFF);
        container.add(panel);

        const label = this.scene.add.text(0, 0, String(value), {
            fontFamily: GAME_FONT,
            fontSize: `${Math.floor(size * 0.55)}px`,
            fontStyle: 'bold',
            color: '#1A237E'
        }).setOrigin(0.5);
        container.add(label);

        container.setSize(size, size);
        container.setInteractive({ useHandCursor: true });

        const btn: NumeralButton = {
            container,
            panel,
            label,
            value,
            locked: false
        };

        container.on('pointerover', () => {
            if (btn.locked) return;
            this.scene.tweens.add({
                targets: container,
                scaleX: 1.06,
                scaleY: 1.06,
                duration: 140,
                ease: 'Back.easeOut'
            });
        });

        container.on('pointerout', () => {
            if (btn.locked) return;
            this.scene.tweens.add({
                targets: container,
                scaleX: 1,
                scaleY: 1,
                duration: 140
            });
        });

        container.on('pointerdown', () => {
            if (btn.locked) return;
            this.scene.tweens.add({
                targets: container,
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 80
            });
        });

        container.on('pointerup', () => {
            if (btn.locked || this.solved) return;
            this.onButtonTap(btn);
        });

        return btn;
    }

    private onButtonTap(btn: NumeralButton): void {
        if (btn.value === this.correctNumeral) {
            this.solved = true;
            this.drawPanel(btn.panel, btn.container.width, 0xC8E6C9);
            btn.label.setColor('#1B5E20');
            this.scene.tweens.add({
                targets: btn.container,
                scaleX: 1.18,
                scaleY: 1.18,
                duration: 180,
                yoyo: true,
                ease: 'Back.easeOut'
            });
            this.lockAll();
            this.emit(NumeralTray.EVENTS.CORRECT, btn.value);
        } else {
            this.drawPanel(btn.panel, btn.container.width, 0xFFE0B2);
            btn.label.setColor('#E65100');
            this.scene.tweens.chain({
                targets: btn.container,
                tweens: [
                    { x: btn.container.x - 8, duration: 60 },
                    { x: btn.container.x + 8, duration: 60 },
                    { x: btn.container.x - 6, duration: 60 },
                    { x: btn.container.x, duration: 60 }
                ]
            });
            btn.locked = true;
            btn.container.disableInteractive();
            // Re-enable after the shake so children can try again from a calm state
            this.scene.time.delayedCall(500, () => {
                if (this.solved) return;
                this.drawPanel(btn.panel, btn.container.width, 0xFFFFFF);
                btn.label.setColor('#1A237E');
                btn.locked = false;
                btn.container.setInteractive({ useHandCursor: true });
            });
            this.emit(NumeralTray.EVENTS.INCORRECT, btn.value);
        }
    }

    private drawPanel(panel: Phaser.GameObjects.Graphics, size: number, fillColor: number): void {
        panel.clear();
        panel.fillStyle(fillColor, 1);
        panel.fillRoundedRect(-size / 2, -size / 2, size, size, 22);
        panel.lineStyle(4, this.theme.primary, 1);
        panel.strokeRoundedRect(-size / 2, -size / 2, size, size, 22);
    }
}
