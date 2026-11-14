import Phaser from 'phaser';
import { ThemeConfig } from '@edu-play/game-core';
import ChoiceTile, { ChoiceTileData } from './ChoiceTile';

export interface ChoiceTrayTile {
    data: ChoiceTileData;
    correct: boolean;
}

export interface ChoiceTrayConfig {
    x: number;
    y: number;
    tiles: ChoiceTrayTile[];
    theme: ThemeConfig;
}

const TILE_SIZE = 200;
const TILE_GAP = 48;

/**
 * ChoiceTray — lays out ChoiceTiles horizontally and arbitrates taps.
 *
 * Two to three tiles by design — more than three is cognitively heavy for
 * pre-readers when paired with audio-only prompting. The tray emits
 * CORRECT / INCORRECT and locks all tiles after a correct answer so a
 * stray second tap can't double-score the round.
 */
export default class ChoiceTray extends Phaser.GameObjects.Container {
    static readonly EVENTS = {
        CORRECT: 'choice-tray-correct',
        INCORRECT: 'choice-tray-incorrect'
    } as const;

    private tiles: ChoiceTile[] = [];
    private solved = false;

    constructor(scene: Phaser.Scene, config: ChoiceTrayConfig) {
        super(scene, config.x, config.y);

        const count = config.tiles.length;
        const totalWidth = count * TILE_SIZE + (count - 1) * TILE_GAP;
        const startX = -totalWidth / 2 + TILE_SIZE / 2;

        for (let i = 0; i < count; i++) {
            const tileConfig = config.tiles[i];
            const tile = new ChoiceTile(scene, {
                x: startX + i * (TILE_SIZE + TILE_GAP),
                y: 0,
                size: TILE_SIZE,
                data: tileConfig.data,
                correct: tileConfig.correct,
                theme: config.theme
            });
            tile.on(ChoiceTile.EVENTS.TAPPED, this.onTileTapped, this);
            this.add(tile);
            this.tiles.push(tile);
        }

        scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    }

    animateIn(): void {
        this.tiles.forEach((tile, i) => tile.animateIn(i * 90));
    }

    getTiles(): ReadonlyArray<ChoiceTile> {
        return this.tiles;
    }

    private onTileTapped(tile: ChoiceTile): void {
        if (this.solved || tile.isLocked()) return;

        if (tile.correct) {
            this.solved = true;
            this.tiles.forEach((t) => {
                if (t !== tile) t.lock();
            });
            tile.markCorrect();
            this.emit(ChoiceTray.EVENTS.CORRECT, tile);
        } else {
            tile.markIncorrect();
            this.emit(ChoiceTray.EVENTS.INCORRECT, tile);
        }
    }
}
