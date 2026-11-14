import Phaser from 'phaser';
import {
    AccessibilityManager,
    AnimatedBackground,
    AudioManager,
    GAME_FONT,
    GameManager,
    type ThemeConfig,
    drawRoundedRect,
    drawStar,
    getPreviewRuntimeSettings
} from '@edu-play/game-core';

// PROTOTYPE — throwaway playable UI prototype for a new "odd one out" Activity type.
// Variant A won; this scene now keeps only the clean card-stage direction.

type SymbolKind = 'circle' | 'triangle' | 'leaf' | 'wave' | 'star' | 'ring' | 'bean' | 'flower' | 'bolt';

interface PrototypeItem {
    id: string;
    label: string;
    hint: string;
    symbol: SymbolKind;
    color: number;
}

interface PrototypeRound {
    id: string;
    rule: string;
    prompt: string;
    oddId: string;
    items: PrototypeItem[];
}

interface TileView {
    container: Phaser.GameObjects.Container;
    background: Phaser.GameObjects.Graphics;
    focusRing: Phaser.GameObjects.Graphics;
    item: PrototypeItem;
    index: number;
    width: number;
    height: number;
}

const INK = 0x243042;
const INK_TEXT = '#243042';
const WHITE = 0xfffbf2;
const GREEN = 0x22c55e;
const GREEN_DIM = 0x15803d;
const GOLD = 0xf8c94c;
const CORAL = 0xff8a65;
const BLUE = 0x38bdf8;
const PURPLE = 0xa78bfa;
const PINK = 0xf472b6;
const MINT = 0x86efac;
const POINTS_PER_ROUND = 10;

const PROTOTYPE_THEME: ThemeConfig = {
    primary: GREEN,
    secondary: GOLD,
    background: 0x175a43,
    cardBg: WHITE,
    textColor: '#ffffff',
    containerBg: WHITE,
    containerText: INK_TEXT,
    containerBorder: INK,
    correctColor: GREEN,
    incorrectColor: CORAL,
    starColor: GOLD,
    backgroundStyle: 'forest'
};

const ROUNDS: PrototypeRound[] = [
    {
        id: 'flyers',
        rule: 'Lucruri care zboară',
        prompt: 'Alege intrusul.',
        oddId: 'apple',
        items: [
            { id: 'bird', label: 'Pasăre', hint: 'Zboară', symbol: 'leaf', color: BLUE },
            { id: 'plane', label: 'Avion', hint: 'Zboară', symbol: 'triangle', color: PURPLE },
            { id: 'butterfly', label: 'Fluture', hint: 'Zboară', symbol: 'flower', color: PINK },
            { id: 'apple', label: 'Măr', hint: 'Nu zboară', symbol: 'circle', color: CORAL }
        ]
    },
    {
        id: 'water',
        rule: 'Lucruri din apă',
        prompt: 'Alege intrusul.',
        oddId: 'bear',
        items: [
            { id: 'fish', label: 'Pește', hint: 'Înoată', symbol: 'wave', color: BLUE },
            { id: 'shell', label: 'Scoică', hint: 'Din mare', symbol: 'ring', color: GOLD },
            { id: 'sea-star', label: 'Stea de mare', hint: 'Din mare', symbol: 'star', color: PINK },
            { id: 'bear', label: 'Urs', hint: 'Nu trăiește în apă', symbol: 'bean', color: PURPLE }
        ]
    },
    {
        id: 'music',
        rule: 'Instrumente muzicale',
        prompt: 'Alege intrusul.',
        oddId: 'carrot',
        items: [
            { id: 'drum', label: 'Tobă', hint: 'Instrument', symbol: 'ring', color: CORAL },
            { id: 'flute', label: 'Flaut', hint: 'Instrument', symbol: 'bolt', color: MINT },
            { id: 'guitar', label: 'Chitară', hint: 'Instrument', symbol: 'bean', color: GOLD },
            { id: 'carrot', label: 'Morcov', hint: 'Nu cântă', symbol: 'circle', color: GREEN }
        ]
    }
];

export default class PrototypeOddOneOutLevel extends Phaser.Scene {
    private gameManager!: GameManager;
    private audioManager!: AudioManager;
    private a11yManager!: AccessibilityManager;
    private roundLayer!: Phaser.GameObjects.Container;
    private overlayLayer!: Phaser.GameObjects.Container;
    private roundIndex = 0;
    private focusedTileIndex = 0;
    private tiles: TileView[] = [];
    private isLocked = false;

    constructor() {
        super('PrototypeOddOneOutLevel');
    }

    create(): void {
        this.gameManager = GameManager.getInstance();
        this.audioManager = AudioManager.getInstance();
        this.a11yManager = AccessibilityManager.getInstance();
        this.audioManager.init(this);
        this.a11yManager.init(this);

        const themeOverride = getPreviewRuntimeSettings().theme;
        const theme = themeOverride ? { ...PROTOTYPE_THEME, backgroundStyle: themeOverride } : PROTOTYPE_THEME;
        this.gameManager.loadSyntheticActivityConfig({
            gameId: 'prototype-odd-one-out-01',
            title: 'Prototip: Ce nu se potrivește?',
            totalSteps: ROUNDS.length,
            maxScore: ROUNDS.length * POINTS_PER_ROUND,
            theme,
            meta: { prototype: true, pointsPerRound: POINTS_PER_ROUND }
        });

        new AnimatedBackground(this, {
            width: this.scale.width,
            height: this.scale.height,
            theme
        });

        this.roundLayer = this.add.container(0, 0);
        this.overlayLayer = this.add.container(0, 0).setDepth(2000);
        this.installKeyboardControls();
        this.events.once('shutdown', this.shutdown, this);
        this.startRound(0);
    }

    private startRound(index: number): void {
        this.roundIndex = index;
        this.focusedTileIndex = 0;
        this.isLocked = false;
        this.tiles = [];
        this.roundLayer.removeAll(true);
        this.overlayLayer.removeAll(true);

        const round = ROUNDS[index];
        this.gameManager.startStep(index);
        this.a11yManager.announce(`${round.rule}. ${round.prompt} Folosește săgețile și apasă Enter sau Spațiu.`);

        this.drawHeader(round);
        this.drawCards(round);
        this.updateFocus();
    }

    private drawHeader(round: PrototypeRound): void {
        const { width } = this.scale;
        this.addText(width / 2, 66, 'Ce nu se potrivește?', 50, '#ffffff', 760).setOrigin(0.5);
        this.addText(width / 2, 122, round.prompt, 30, '#fff7cc', 520).setOrigin(0.5);
        this.drawRulePill(width / 2, 178, round.rule);
    }

    private drawCards(round: PrototypeRound): void {
        const positions = [
            { x: 210, y: 250 },
            { x: 690, y: 250 },
            { x: 210, y: 452 },
            { x: 690, y: 452 }
        ];

        round.items.forEach((item, index) => {
            const pos = positions[index];
            this.createTile(item, index, pos.x, pos.y, 380, 150);
        });
    }

    private createTile(item: PrototypeItem, index: number, x: number, y: number, width: number, height: number): TileView {
        const container = this.add.container(x, y);
        container.setSize(width, height);

        const focusRing = this.add.graphics();
        focusRing.lineStyle(5, GOLD, 1);
        focusRing.strokeRoundedRect(-8, -8, width + 16, height + 16, 34);
        focusRing.setVisible(false);

        const background = this.add.graphics();
        drawRoundedRect(background, 0, 0, width, height, 28, {
            fillColor: WHITE,
            strokeColor: INK,
            strokeWidth: 3,
            shadowColor: this.shadowFor(item.color),
            shadowOffset: 8
        });

        const symbol = this.add.graphics();
        this.drawSymbol(symbol, 92, height / 2, 40, item);

        const label = this.add.text(170, height / 2 - 16, item.label, {
            fontFamily: GAME_FONT,
            fontSize: '34px',
            fontStyle: 'bold',
            color: INK_TEXT,
            align: 'left',
            wordWrap: { width: width - 200 }
        }).setOrigin(0, 0.5);

        const hint = this.add.text(170, height / 2 + 32, item.hint, {
            fontFamily: GAME_FONT,
            fontSize: '21px',
            fontStyle: 'bold',
            color: '#526070',
            align: 'left',
            wordWrap: { width: width - 200 }
        }).setOrigin(0, 0.5);

        const hitZone = this.add.zone(width / 2, height / 2, Math.max(width, 88), Math.max(height, 88));
        hitZone.setInteractive({ useHandCursor: true });
        container.add([focusRing, background, symbol, label, hint, hitZone]);

        const tile: TileView = { container, background, focusRing, item, index, width, height };
        hitZone.on('pointerover', () => this.focusTile(index));
        hitZone.on('pointerdown', () => this.chooseTile(tile));
        this.roundLayer.add(container);
        this.tiles.push(tile);

        container.setAlpha(0);
        container.setY(y + 18);
        this.tweens.add({
            targets: container,
            y,
            alpha: 1,
            duration: 280,
            delay: index * 55,
            ease: 'Back.easeOut'
        });

        return tile;
    }

    private chooseTile(tile: TileView): void {
        if (this.isLocked) return;

        this.audioManager.playSfx('click');
        this.focusTile(tile.index);

        const round = ROUNDS[this.roundIndex];
        if (tile.item.id !== round.oddId) {
            this.audioManager.playSfx('incorrect');
            this.a11yManager.announce('Aproape! Caută intrusul.');
            this.showIncorrectFeedback(tile);
            return;
        }

        this.isLocked = true;
        this.audioManager.playSfx('correct');
        this.a11yManager.announce('Super! Ai găsit intrusul.');
        this.markTileCorrect(tile);
        this.gameManager.completeStep(this.roundIndex, {
            scoreDelta: POINTS_PER_ROUND,
            correct: true
        });

        this.showCorrectFeedback().then(() => {
            const next = this.roundIndex + 1;
            if (next >= ROUNDS.length) {
                this.completePrototype();
            } else {
                this.startRound(next);
            }
        });
    }

    private markTileCorrect(tile: TileView): void {
        tile.background.clear();
        drawRoundedRect(tile.background, 0, 0, tile.width, tile.height, 28, {
            fillColor: 0xdcfce7,
            strokeColor: GREEN_DIM,
            strokeWidth: 4,
            shadowColor: GREEN_DIM,
            shadowOffset: 8
        });
    }

    private showIncorrectFeedback(tile: TileView): void {
        const startX = tile.container.x;
        const label = this.add.text(tile.container.x + tile.width / 2, tile.container.y - 22, 'Aproape!', {
            fontFamily: GAME_FONT,
            fontSize: '30px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#8a3a24',
            strokeThickness: 5
        }).setOrigin(0.5).setDepth(1200);
        this.roundLayer.add(label);

        this.tweens.add({
            targets: tile.container,
            x: startX + 12,
            duration: 60,
            yoyo: true,
            repeat: 2,
            ease: 'Sine.easeInOut',
            onComplete: () => tile.container.setX(startX)
        });
        this.tweens.add({
            targets: label,
            y: label.y - 34,
            alpha: 0,
            duration: 520,
            ease: 'Sine.easeOut',
            onComplete: () => label.destroy()
        });
    }

    private showCorrectFeedback(): Promise<void> {
        return new Promise((resolve) => {
            const { width, height } = this.scale;
            const overlay = this.add.container(0, 0).setDepth(1500);
            const wash = this.add.rectangle(width / 2, height / 2, width, height, GREEN, 0.78);
            const card = this.add.graphics();
            drawRoundedRect(card, width / 2 - 230, height / 2 - 106, 460, 190, 34, {
                fillColor: WHITE,
                strokeColor: INK,
                strokeWidth: 3,
                shadowColor: INK,
                shadowOffset: 8
            });
            const message = this.add.text(width / 2, height / 2 - 22, 'Super!', {
                fontFamily: GAME_FONT,
                fontSize: '68px',
                fontStyle: 'bold',
                color: INK_TEXT,
                align: 'center'
            }).setOrigin(0.5);
            const sub = this.add.text(width / 2, height / 2 + 58, '+10 puncte', {
                fontFamily: GAME_FONT,
                fontSize: '26px',
                fontStyle: 'bold',
                color: '#166534',
                align: 'center'
            }).setOrigin(0.5);
            overlay.add([wash, card, message, sub]);
            this.addStarBurst(overlay, width / 2, height / 2 - 20);
            this.overlayLayer.add(overlay);

            overlay.setScale(0.92);
            overlay.setAlpha(0);
            this.tweens.add({ targets: overlay, scaleX: 1, scaleY: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
            this.time.delayedCall(680, () => {
                this.tweens.add({
                    targets: overlay,
                    alpha: 0,
                    duration: 180,
                    onComplete: () => {
                        overlay.destroy();
                        resolve();
                    }
                });
            });
        });
    }

    private completePrototype(): void {
        this.isLocked = true;
        this.audioManager.playSfx('complete');
        this.gameManager.completeActivity();
        this.roundLayer.removeAll(true);
        this.overlayLayer.removeAll(true);
        this.drawEndScreen();
    }

    private drawEndScreen(): void {
        const { width, height } = this.scale;
        const card = this.add.graphics();
        drawRoundedRect(card, width / 2 - 360, height / 2 - 170, 720, 310, 38, {
            fillColor: WHITE,
            strokeColor: INK,
            strokeWidth: 3,
            shadowColor: INK,
            shadowOffset: 10
        });
        this.roundLayer.add(card);
        this.roundLayer.add(this.add.text(width / 2, height / 2 - 96, 'Prototip terminat', {
            fontFamily: GAME_FONT,
            fontSize: '50px',
            fontStyle: 'bold',
            color: INK_TEXT,
            align: 'center'
        }).setOrigin(0.5));
        this.roundLayer.add(this.add.text(width / 2, height / 2 - 18, 'Direcție aleasă: cartonașe aerisite, 2 × 2.', {
            fontFamily: GAME_FONT,
            fontSize: '27px',
            fontStyle: 'bold',
            color: '#334155',
            align: 'center'
        }).setOrigin(0.5));
        this.createActionButton(width / 2, height / 2 + 112, 260, 82, 'Joacă din nou', () => this.scene.restart());
    }

    private createActionButton(
        centerX: number,
        centerY: number,
        width: number,
        height: number,
        label: string,
        onClick: () => void
    ): Phaser.GameObjects.Container {
        const button = this.add.container(centerX - width / 2, centerY - height / 2);
        button.setSize(width, height);
        const bg = this.add.graphics();
        drawRoundedRect(bg, 0, 0, width, height, 24, {
            fillColor: GREEN,
            strokeColor: INK,
            strokeWidth: 3,
            shadowColor: GREEN_DIM,
            shadowOffset: 7
        });
        const text = this.add.text(width / 2, height / 2, label, {
            fontFamily: GAME_FONT,
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        const hitZone = this.add.zone(width / 2, height / 2, Math.max(width, 88), Math.max(height, 88));
        hitZone.setInteractive({ useHandCursor: true });
        hitZone.on('pointerdown', () => {
            this.audioManager.playSfx('click');
            onClick();
        });
        button.add([bg, text, hitZone]);
        this.roundLayer.add(button);
        return button;
    }

    private drawRulePill(centerX: number, centerY: number, label: string): void {
        const width = Math.max(400, label.length * 18);
        const pill = this.add.graphics();
        drawRoundedRect(pill, centerX - width / 2, centerY - 30, width, 62, 31, {
            fillColor: GOLD,
            strokeColor: INK,
            strokeWidth: 3,
            shadowColor: INK,
            shadowOffset: 5
        });
        this.roundLayer.add(pill);
        this.roundLayer.add(this.add.text(centerX, centerY, label, {
            fontFamily: GAME_FONT,
            fontSize: '28px',
            fontStyle: 'bold',
            color: INK_TEXT,
            align: 'center'
        }).setOrigin(0.5));
    }

    private drawSymbol(graphics: Phaser.GameObjects.Graphics, x: number, y: number, size: number, item: PrototypeItem): void {
        graphics.fillStyle(item.color, 1);
        graphics.lineStyle(4, INK, 1);
        switch (item.symbol) {
            case 'circle':
                graphics.fillCircle(x, y, size);
                graphics.strokeCircle(x, y, size);
                graphics.fillStyle(MINT, 1);
                graphics.fillEllipse(x + size * 0.36, y - size * 0.74, size * 0.54, size * 0.28);
                break;
            case 'triangle':
                graphics.fillTriangle(x, y - size, x - size, y + size * 0.72, x + size, y + size * 0.72);
                graphics.strokeTriangle(x, y - size, x - size, y + size * 0.72, x + size, y + size * 0.72);
                break;
            case 'leaf':
                graphics.fillEllipse(x, y, size * 1.7, size * 1.05);
                graphics.strokeEllipse(x, y, size * 1.7, size * 1.05);
                graphics.lineBetween(x - size * 0.45, y, x + size * 0.45, y);
                break;
            case 'wave':
                graphics.fillEllipse(x - size * 0.1, y, size * 1.85, size);
                graphics.strokeEllipse(x - size * 0.1, y, size * 1.85, size);
                graphics.fillTriangle(x + size * 0.68, y, x + size * 1.2, y - size * 0.48, x + size * 1.2, y + size * 0.48);
                graphics.strokeTriangle(x + size * 0.68, y, x + size * 1.2, y - size * 0.48, x + size * 1.2, y + size * 0.48);
                break;
            case 'star':
                drawStar(graphics, x, y, size, { fillColor: item.color, strokeColor: INK, strokeWidth: 4 });
                break;
            case 'ring':
                graphics.fillCircle(x, y, size);
                graphics.strokeCircle(x, y, size);
                graphics.fillStyle(WHITE, 1);
                graphics.fillCircle(x, y, size * 0.52);
                graphics.strokeCircle(x, y, size * 0.52);
                break;
            case 'bean':
                graphics.fillEllipse(x - size * 0.28, y, size * 1.28, size * 1.75);
                graphics.strokeEllipse(x - size * 0.28, y, size * 1.28, size * 1.75);
                graphics.fillEllipse(x + size * 0.38, y + size * 0.22, size * 0.82, size * 1.18);
                graphics.strokeEllipse(x + size * 0.38, y + size * 0.22, size * 0.82, size * 1.18);
                break;
            case 'flower':
                for (let i = 0; i < 6; i++) {
                    const angle = (i / 6) * Math.PI * 2;
                    graphics.fillEllipse(x + Math.cos(angle) * size * 0.52, y + Math.sin(angle) * size * 0.52, size * 0.72, size * 0.92);
                    graphics.strokeEllipse(x + Math.cos(angle) * size * 0.52, y + Math.sin(angle) * size * 0.52, size * 0.72, size * 0.92);
                }
                graphics.fillStyle(GOLD, 1);
                graphics.fillCircle(x, y, size * 0.38);
                break;
            case 'bolt':
                graphics.fillPoints([
                    { x: x - size * 0.08, y: y - size },
                    { x: x + size * 0.58, y: y - size * 0.12 },
                    { x: x + size * 0.14, y: y - size * 0.12 },
                    { x: x + size * 0.34, y: y + size },
                    { x: x - size * 0.58, y: y + size * 0.02 },
                    { x: x - size * 0.12, y: y + size * 0.02 }
                ], true);
                break;
        }
    }

    private addStarBurst(parent: Phaser.GameObjects.Container, x: number, y: number): void {
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const star = this.add.graphics();
            drawStar(star, 0, 0, 14, { fillColor: GOLD, strokeColor: INK, strokeWidth: 2 });
            star.setPosition(x, y);
            parent.add(star);
            this.tweens.add({
                targets: star,
                x: x + Math.cos(angle) * 210,
                y: y + Math.sin(angle) * 135,
                alpha: 0,
                duration: 640,
                ease: 'Cubic.easeOut',
                onComplete: () => star.destroy()
            });
        }
    }

    private addText(x: number, y: number, text: string, size: number, color: string, width: number): Phaser.GameObjects.Text {
        const label = this.add.text(x, y, text, {
            fontFamily: GAME_FONT,
            fontSize: `${size}px`,
            fontStyle: 'bold',
            color,
            align: 'center',
            wordWrap: { width }
        });
        this.roundLayer.add(label);
        return label;
    }

    private shadowFor(color: number): number {
        if (color === GREEN || color === MINT) return GREEN_DIM;
        if (color === BLUE) return 0x0284c7;
        if (color === PURPLE) return 0x6d28d9;
        if (color === PINK) return 0xbe185d;
        if (color === GOLD) return 0xb7791f;
        return 0xc2410c;
    }

    private focusTile(index: number): void {
        if (!this.tiles.length) return;
        this.focusedTileIndex = Phaser.Math.Clamp(index, 0, this.tiles.length - 1);
        this.updateFocus();
    }

    private updateFocus(): void {
        this.tiles.forEach((tile, index) => {
            tile.focusRing.setVisible(index === this.focusedTileIndex);
            tile.container.setDepth(index === this.focusedTileIndex ? 10 : 1);
        });
    }

    private activateFocusedTile(): void {
        const tile = this.tiles[this.focusedTileIndex];
        if (tile) this.chooseTile(tile);
    }

    private focusPreviousTile(): void {
        this.focusTile((this.focusedTileIndex - 1 + this.tiles.length) % this.tiles.length);
    }

    private focusNextTile(): void {
        this.focusTile((this.focusedTileIndex + 1) % this.tiles.length);
    }

    private installKeyboardControls(): void {
        this.input.keyboard?.on('keydown-LEFT', this.onKeyLeft, this);
        this.input.keyboard?.on('keydown-UP', this.onKeyLeft, this);
        this.input.keyboard?.on('keydown-RIGHT', this.onKeyRight, this);
        this.input.keyboard?.on('keydown-DOWN', this.onKeyRight, this);
        this.input.keyboard?.on('keydown-HOME', this.onKeyHome, this);
        this.input.keyboard?.on('keydown-END', this.onKeyEnd, this);
        this.input.keyboard?.on('keydown-ENTER', this.onKeyActivate, this);
        this.input.keyboard?.on('keydown-SPACE', this.onKeyActivate, this);
    }

    private onKeyLeft(): void { if (!this.isLocked) this.focusPreviousTile(); }
    private onKeyRight(): void { if (!this.isLocked) this.focusNextTile(); }
    private onKeyHome(): void { if (!this.isLocked) this.focusTile(0); }
    private onKeyEnd(): void { if (!this.isLocked) this.focusTile(this.tiles.length - 1); }
    private onKeyActivate(): void { if (!this.isLocked) this.activateFocusedTile(); }

    shutdown(): void {
        this.input.keyboard?.off('keydown-LEFT', this.onKeyLeft, this);
        this.input.keyboard?.off('keydown-UP', this.onKeyLeft, this);
        this.input.keyboard?.off('keydown-RIGHT', this.onKeyRight, this);
        this.input.keyboard?.off('keydown-DOWN', this.onKeyRight, this);
        this.input.keyboard?.off('keydown-HOME', this.onKeyHome, this);
        this.input.keyboard?.off('keydown-END', this.onKeyEnd, this);
        this.input.keyboard?.off('keydown-ENTER', this.onKeyActivate, this);
        this.input.keyboard?.off('keydown-SPACE', this.onKeyActivate, this);
    }
}
