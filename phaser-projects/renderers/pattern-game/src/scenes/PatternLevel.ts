import Phaser from 'phaser';
import {
    GameManager,
    AudioManager,
    AccessibilityManager,
    AnimatedBackground,
    FeedbackOverlay,
    ThemeConfig,
    getPreviewRuntimeSettings,
    ConfigLoader,
    i18n,
    GAME_FONT
} from '@edu-play/game-core';
import PatternTile, { TileShape, TileSize, TileSpec } from '../prefabs/PatternTile';
import PatternGap from '../prefabs/PatternGap';

interface RawTile {
    shape: TileShape;
    fillColor: number;
    strokeColor?: number;
    size?: TileSize;
}

interface RawRound {
    id: string;
    pattern: string;
    gapCount?: number;
    distractors?: string[];
}

interface RawPatternConfig {
    meta: {
        gameId: string;
        version?: string;
        gameType?: string;
        themeName?: string;
        pointsPerRound?: number;
        roundDelay?: number;
        supportedLanguages?: string[];
        defaultSize?: TileSize;
    };
    tiles: Record<string, RawTile>;
    rounds: RawRound[];
}

interface HydratedRound {
    id: string;
    patternKeys: string[];
    gapCount: number;
    distractorKeys: string[];
    prompt: string;
}

/**
 * PatternLevel — the pattern-completion gameplay scene.
 *
 * Each round shows a row like `[A][B][A][B][A][ ? ]`. Correct tile keys
 * live in `tiles`; the pattern is a string of single-char keys. The last N
 * positions are replaced by PatternGap drop zones and the child drags from
 * a tray of answer tiles below.
 *
 * Drag/drop is wired inline here (copied from categorize-game). Extracting
 * to `packages/dragdrop` is deferred until a third consumer exists.
 */
export default class PatternLevel extends Phaser.Scene {
    static readonly EVENTS = {
        TILE_PLACED: 'pattern-tile-placed',
        TILE_WRONG: 'pattern-tile-wrong',
        ROUND_SOLVED: 'pattern-round-solved',
        ALL_ROUNDS_SOLVED: 'pattern-all-rounds-solved'
    } as const;

    private gameManager!: GameManager;
    private audioManager!: AudioManager;
    private a11yManager!: AccessibilityManager;
    private theme!: ThemeConfig;

    private tileSpecs: Record<string, TileSpec> = {};
    private rounds: HydratedRound[] = [];
    private roundIndex = 0;
    private pointsPerRound = 10;
    private roundDelay = 900;
    private instructionFallback = 'Ce urmează?';

    private displayTiles: PatternTile[] = [];
    private gaps: PatternGap[] = [];
    private trayTiles: PatternTile[] = [];
    private keyboardHeldTile: PatternTile | null = null;

    private instructionText!: Phaser.GameObjects.Text;
    private feedbackOverlay!: FeedbackOverlay;
    private roundLayer!: Phaser.GameObjects.Container;
    private isLocked = false;
    private correctPlacements = 0;

    constructor() {
        super('PatternLevel');
    }

    async create(): Promise<void> {
        this.gameManager = GameManager.getInstance();
        this.audioManager = AudioManager.getInstance();
        this.a11yManager = AccessibilityManager.getInstance();

        this.roundIndex = 0;
        this.isLocked = false;
        this.correctPlacements = 0;

        let rounds: HydratedRound[];
        try {
            rounds = await this.loadPatternConfig();
        } catch (err) {
            console.error('[PatternLevel] Failed to load config:', err);
            this.showError(String(err));
            return;
        }

        if (!rounds.length) {
            console.error('[PatternLevel] No rounds in config');
            this.showError('No rounds found in config');
            return;
        }

        const themeOverride = getPreviewRuntimeSettings().theme;
        if (themeOverride) {
            this.gameManager.setThemeName(themeOverride);
        }
        this.theme = this.gameManager.getTheme();
        this.rounds = rounds;

        new AnimatedBackground(this, {
            width: this.scale.width,
            height: this.scale.height,
            theme: this.theme
        });

        this.instructionText = this.add.text(this.scale.width / 2, 60, '', {
            fontSize: '38px',
            color: '#ffffff',
            fontFamily: GAME_FONT,
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);

        this.roundLayer = this.add.container(0, 0);

        this.setupDragEvents();

        this.feedbackOverlay = new FeedbackOverlay(this, { theme: this.theme });
        this.gameManager.on(GameManager.EVENTS.CONTROL_PAUSE, this.onPauseGame, this);
        this.gameManager.on(GameManager.EVENTS.CONTROL_RESUME, this.onResumeGame, this);
        this.events.once('shutdown', this.shutdown, this);


        this.startRound(0);
    }

    private async loadPatternConfig(): Promise<HydratedRound[]> {
        const preview = getPreviewRuntimeSettings();
        const gameId = preview.gameId
            || ConfigLoader.getGameIdFromUrl()
            || 'shapes-pattern-01';

        const urlLang = preview.language
            || ConfigLoader.getLanguageFromUrl()
            || 'ro';

        i18n.setLanguage(urlLang);

        const bundle = await ConfigLoader.getInstance().loadTemplateConfig({
            gameId,
            language: urlLang
        });
        const raw = bundle.config as unknown as RawPatternConfig;
        const strings = bundle.strings as {
            meta?: { title?: string };
            instruction?: string;
            rounds?: Record<string, { prompt?: string }>;
        };

        this.pointsPerRound = raw.meta.pointsPerRound ?? 10;
        this.roundDelay = raw.meta.roundDelay ?? 900;
        const defaultSize = raw.meta.defaultSize ?? 'medium';

        if (strings.instruction) {
            this.instructionFallback = strings.instruction;
        }

        // Hydrate the tile dictionary into strongly-typed TileSpecs
        this.tileSpecs = {};
        for (const [key, tile] of Object.entries(raw.tiles ?? {})) {
            this.tileSpecs[key] = {
                shape: tile.shape,
                fillColor: tile.fillColor,
                strokeColor: tile.strokeColor,
                size: tile.size ?? defaultSize
            };
        }

        const roundStrings = strings.rounds ?? {};
        const rounds: HydratedRound[] = (raw.rounds ?? []).map((r) => {
            const patternKeys = r.pattern.split('');
            const gapCount = Math.max(1, Math.min(r.gapCount ?? 1, patternKeys.length - 1));

            // Default distractor set: any tile key not among the expected
            // answers for this round. Keeps difficulty consistent without
            // requiring content-writer work.
            const answerKeys = patternKeys.slice(patternKeys.length - gapCount);
            const answerSet = new Set(answerKeys);
            const autoDistractors = Object.keys(this.tileSpecs)
                .filter((k) => !answerSet.has(k));

            return {
                id: r.id,
                patternKeys,
                gapCount,
                distractorKeys: r.distractors ?? autoDistractors,
                prompt: roundStrings[r.id]?.prompt ?? this.instructionFallback
            };
        });

        this.gameManager.loadSyntheticActivityConfig({
            gameId: raw.meta.gameId,
            title: strings.meta?.title ?? raw.meta.gameId,
            totalSteps: rounds.length,
            maxScore: rounds.length * this.pointsPerRound,
            theme: this.gameManager.getTheme(),
            meta: { pointsPerRound: this.pointsPerRound }
        });

        return rounds;
    }

    private startRound(index: number): void {
        this.roundIndex = index;
        this.gameManager.startStep(index);
        this.correctPlacements = 0;
        this.clearRoundLayer();

        const round = this.rounds[index];
        this.instructionText.setText(round.prompt);
        this.a11yManager.announce(round.prompt);

        this.layoutPatternRow(round);
        this.layoutTray(round);
        this.registerKeyboardFocusables();
    }

    private layoutPatternRow(round: HydratedRound): void {
        const { width } = this.scale;
        const totalTiles = round.patternKeys.length;
        const maxRowWidth = width - 160;

        // Keep slots uniform — the pattern shouldn't change size between
        // a display tile and a gap, otherwise the eye tracks the wrong cue.
        const slotSize = Math.max(72, Math.min(118, maxRowWidth / totalTiles - 10));
        const gap = 12;
        const rowWidth = totalTiles * slotSize + (totalTiles - 1) * gap;
        const startX = (width - rowWidth) / 2 + slotSize / 2;
        const rowY = 220;

        const firstGapIndex = round.patternKeys.length - round.gapCount;

        for (let i = 0; i < totalTiles; i++) {
            const x = startX + i * (slotSize + gap);
            const key = round.patternKeys[i];

            if (i < firstGapIndex) {
                const spec = this.tileSpecs[key];
                if (!spec) {
                    console.warn(`[PatternLevel] Unknown tile key in pattern: ${key}`);
                    continue;
                }
                const tile = new PatternTile(this, {
                    x,
                    y: rowY,
                    slotWidth: slotSize,
                    slotHeight: slotSize,
                    spec,
                    tileKey: key,
                    mode: 'display',
                    theme: this.theme,
                    accessibleLabel: `tile ${key}`
                });
                tile.animateIn(i * 60);
                this.roundLayer.add(tile);
                this.displayTiles.push(tile);
            } else {
                const gapIndex = i - firstGapIndex;
                const pgap = new PatternGap(this, {
                    x,
                    y: rowY,
                    width: slotSize,
                    height: slotSize,
                    expectedTileKey: key,
                    index: gapIndex,
                    theme: this.theme
                });
                pgap.setAlpha(0);
                this.tweens.add({
                    targets: pgap,
                    alpha: 1,
                    duration: 320,
                    delay: i * 60,
                    ease: 'Sine.easeOut'
                });
                this.roundLayer.add(pgap);
                this.gaps.push(pgap);
            }
        }
    }

    private layoutTray(round: HydratedRound): void {
        const { width, height } = this.scale;

        // Answer pool: the expected keys (one per gap) + any distractors.
        const answerKeys = round.patternKeys.slice(round.patternKeys.length - round.gapCount);
        const trayKeys = [...answerKeys, ...round.distractorKeys].filter((k) => !!this.tileSpecs[k]);
        const shuffled = this.shuffle(trayKeys);

        const slotSize = 96;
        const gap = 20;
        const rowWidth = shuffled.length * slotSize + (shuffled.length - 1) * gap;
        const startX = (width - rowWidth) / 2 + slotSize / 2;
        const trayY = height - 180;

        for (let i = 0; i < shuffled.length; i++) {
            const key = shuffled[i];
            const spec = this.tileSpecs[key];
            const x = startX + i * (slotSize + gap);

            const tile = new PatternTile(this, {
                x,
                y: trayY,
                slotWidth: slotSize,
                slotHeight: slotSize,
                spec,
                tileKey: key,
                mode: 'draggable',
                theme: this.theme,
                accessibleLabel: `answer tile ${key}`
            });
            tile.animateIn(i * 80);
            this.roundLayer.add(tile);
            this.trayTiles.push(tile);
        }
    }

    private setupDragEvents(): void {
        this.input.on('dragstart', (_pointer: Phaser.Input.Pointer, gameObject: PatternTile) => {
            if (!(gameObject instanceof PatternTile)) return;
            if (this.isLocked) return;
            gameObject.setTileState('dragging');
            gameObject.setDepth(100);
            this.input.setDefaultCursor('grabbing');
            this.audioManager.playSfx('click');
        });

        this.input.on('drag', (_pointer: Phaser.Input.Pointer, gameObject: PatternTile, dragX: number, dragY: number) => {
            if (!(gameObject instanceof PatternTile)) return;
            gameObject.x = dragX;
            gameObject.y = dragY;
        });

        this.input.on('dragenter', (_pointer: Phaser.Input.Pointer, _gameObject: PatternTile, dropZone: Phaser.GameObjects.Zone) => {
            const gap = dropZone.getData('patternGap') as PatternGap;
            if (gap) gap.highlight();
        });

        this.input.on('dragleave', (_pointer: Phaser.Input.Pointer, _gameObject: PatternTile, dropZone: Phaser.GameObjects.Zone) => {
            const gap = dropZone.getData('patternGap') as PatternGap;
            if (gap) gap.unhighlight();
        });

        this.input.on('drop', (_pointer: Phaser.Input.Pointer, gameObject: PatternTile, dropZone: Phaser.GameObjects.Zone) => {
            if (!(gameObject instanceof PatternTile)) return;

            const gap = dropZone.getData('patternGap') as PatternGap;
            if (!gap) {
                gameObject.animateSnapBack();
                return;
            }
            gap.unhighlight();

            if (gap.isFilled()) {
                // Another tile has already been locked in here — wobble back.
                gameObject.animateSnapBack();
                return;
            }

            if (gap.expectedTileKey === gameObject.tileKey) {
                this.onCorrectDrop(gameObject, gap);
            } else {
                this.onIncorrectDrop(gameObject);
            }
        });

        this.input.on('dragend', (_pointer: Phaser.Input.Pointer, gameObject: PatternTile, dropped: boolean) => {
            if (!(gameObject instanceof PatternTile)) return;
            this.input.setDefaultCursor('default');
            if (!dropped && gameObject.getTileState() !== 'placed') {
                gameObject.animateSnapBack();
            }
        });
    }

    private onCorrectDrop(tile: PatternTile, gap: PatternGap): void {
        gap.setFilled(true);
        tile.animatePlaced(gap.x, gap.y);
        this.audioManager.playSfx('correct');
        this.events.emit(PatternLevel.EVENTS.TILE_PLACED, {
            tileKey: tile.tileKey,
            gapIndex: gap.index
        });

        this.correctPlacements++;
        const round = this.rounds[this.roundIndex];
        if (this.correctPlacements === round.gapCount) {
            this.onRoundSolved();
        }
    }

    private onIncorrectDrop(tile: PatternTile): void {
        tile.animateSnapBack();
        this.audioManager.playSfx('incorrect');
        this.showEncouragement(tile.x, tile.y - 40);
        this.events.emit(PatternLevel.EVENTS.TILE_WRONG, { tileKey: tile.tileKey });
    }

    private onRoundSolved(): void {
        if (this.isLocked) return;
        this.isLocked = true;
        this.gameManager.completeStep(this.roundIndex, {
            scoreDelta: this.pointsPerRound,
            correct: true
        });
        this.a11yManager.announce(i18n.tRandom('feedback.correct'));
        this.events.emit(PatternLevel.EVENTS.ROUND_SOLVED, this.roundIndex);

        this.feedbackOverlay.showCorrect().then(() => {
            const next = this.roundIndex + 1;
            if (next >= this.rounds.length) {
                this.onAllRoundsSolved();
                return;
            }
            this.time.delayedCall(this.roundDelay, () => {
                this.isLocked = false;
                this.startRound(next);
            });
        });
    }

    private onAllRoundsSolved(): void {
        this.events.emit(PatternLevel.EVENTS.ALL_ROUNDS_SOLVED);
        this.gameManager.completeActivity();
        this.scene.start('Results', this.gameManager.createResultsData({
            restartScene: 'PatternLevel'
        }));
    }

    private registerKeyboardFocusables(): void {
        this.a11yManager.clearGroup('tiles');
        this.a11yManager.clearGroup('gaps');

        this.trayTiles.forEach((tile) => {
            this.a11yManager.registerFocusable({
                id: `tile-${tile.tileKey}-${tile.homeX}`,
                element: tile,
                label: tile.getAccessibleLabel(),
                group: 'tiles',
                onSelect: () => this.onKeyboardPickUp(tile),
                onFocus: () => tile.showFocus(),
                onBlur: () => tile.hideFocus()
            });
        });

        this.gaps.forEach((gap) => {
            this.a11yManager.registerFocusable({
                id: `gap-${gap.index}`,
                element: gap,
                label: gap.getAccessibleLabel(),
                group: 'gaps',
                onSelect: () => this.onKeyboardDrop(gap),
                onFocus: () => gap.showFocus(),
                onBlur: () => gap.hideFocus()
            });
        });

        this.a11yManager.setActiveGroup('tiles');

        this.input.keyboard?.on('keydown-ESC', this.cancelKeyboardHold, this);
    }

    private cancelKeyboardHold(): void {
        if (this.keyboardHeldTile) {
            this.keyboardHeldTile.setTileState('idle');
            this.keyboardHeldTile = null;
            this.a11yManager.setActiveGroup('tiles');
        }
    }

    private onKeyboardPickUp(tile: PatternTile): void {
        if (tile.getTileState() === 'placed') return;
        this.keyboardHeldTile = tile;
        tile.selectViaKeyboard();
        this.a11yManager.setActiveGroup('gaps');
        this.a11yManager.announce(`Picked up ${tile.getAccessibleLabel()}. Arrow keys choose a gap, Enter to drop.`);
    }

    private onKeyboardDrop(gap: PatternGap): void {
        if (!this.keyboardHeldTile || gap.isFilled()) return;
        const tile = this.keyboardHeldTile;
        this.keyboardHeldTile = null;

        if (tile.tileKey === gap.expectedTileKey) {
            this.onCorrectDrop(tile, gap);
            this.a11yManager.announceUrgent(`${tile.getAccessibleLabel()} placed. Correct!`);
        } else {
            this.onIncorrectDrop(tile);
            this.a11yManager.announce(`${tile.getAccessibleLabel()} returned. Try another gap.`);
        }

        this.a11yManager.setActiveGroup('tiles');
    }

    private clearRoundLayer(): void {
        this.gaps.forEach((g) => g.getHitZone().destroy());
        this.gaps = [];
        this.displayTiles = [];
        this.trayTiles = [];
        this.keyboardHeldTile = null;
        this.roundLayer.removeAll(true);
        this.a11yManager.clearGroup('tiles');
        this.a11yManager.clearGroup('gaps');
    }

    private shuffle<T>(arr: T[]): T[] {
        const out = [...arr];
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    }

    private showEncouragement(x: number, y: number): void {
        const text = this.add.text(x, y, i18n.tRandom('feedback.incorrect'), {
            fontSize: '24px',
            color: '#FFB74D',
            fontFamily: GAME_FONT,
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.tweens.add({
            targets: text,
            y: y - 40,
            alpha: 0,
            duration: 1200,
            ease: 'Sine.easeOut',
            onComplete: () => text.destroy()
        });
    }

    private onPauseGame(): void {
        this.isLocked = true;
        this.trayTiles
            .filter((t) => t.getTileState() !== 'placed')
            .forEach((t) => t.disableInteractive());
    }

    private onResumeGame(): void {
        this.isLocked = false;
        this.trayTiles
            .filter((t) => t.getTileState() === 'idle')
            .forEach((t) => t.setInteractive({ draggable: true, useHandCursor: true }));
    }

    private showError(message: string): void {
        const { width, height } = this.cameras.main;
        this.add.text(width / 2, height / 2, `Error: ${message}`, {
            fontSize: '24px',
            color: '#E87D7D',
            align: 'center',
            wordWrap: { width: width - 100 }
        }).setOrigin(0.5);
    }

    shutdown(): void {
        this.gameManager.off(GameManager.EVENTS.CONTROL_PAUSE, this.onPauseGame, this);
        this.gameManager.off(GameManager.EVENTS.CONTROL_RESUME, this.onResumeGame, this);
        this.input.keyboard?.off('keydown-ESC', this.cancelKeyboardHold, this);
        this.a11yManager.clearGroup('tiles');
        this.a11yManager.clearGroup('gaps');
    }
}
