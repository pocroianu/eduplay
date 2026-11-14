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
import CountableObject, { CountableShape } from '../prefabs/CountableObject';
import NumeralTray from '../prefabs/NumeralTray';

interface RawRound {
    id: string;
    count: number;
    shape?: CountableShape;
    fillColor?: number;
    strokeColor?: number;
    trayNumerals?: number[];
    promptKey?: string;
    objectLabelKey?: string;
}

interface RawCountingConfig {
    meta: {
        gameId: string;
        version?: string;
        gameType?: string;
        themeName?: string;
        pointsPerRound?: number;
        roundDelay?: number;
        supportedLanguages?: string[];
        defaultShape?: CountableShape;
        defaultFillColor?: number;
        defaultStrokeColor?: number;
    };
    rounds: RawRound[];
}

interface HydratedRound {
    id: string;
    count: number;
    shape: CountableShape;
    fillColor: number;
    strokeColor: number;
    trayNumerals: number[];
    prompt: string;
    objectLabel: string;
}

export default class CountingLevel extends Phaser.Scene {
    static readonly EVENTS = {
        OBJECT_COUNTED: 'counting-object-counted',
        ROUND_SOLVED: 'counting-round-solved',
        ALL_ROUNDS_SOLVED: 'counting-all-rounds-solved'
    } as const;

    private gameManager!: GameManager;
    private audioManager!: AudioManager;
    private a11yManager!: AccessibilityManager;
    private theme!: ThemeConfig;

    private rounds: HydratedRound[] = [];
    private roundIndex = 0;
    private pointsPerRound = 10;
    private roundDelay = 900;
    private instructionFallback = 'Câte sunt?';

    private currentObjects: CountableObject[] = [];
    private currentTray: NumeralTray | null = null;
    private instructionText!: Phaser.GameObjects.Text;
    private countReadoutText!: Phaser.GameObjects.Text;
    private feedbackOverlay!: FeedbackOverlay;
    private isLocked = false;
    private roundLayer!: Phaser.GameObjects.Container;

    constructor() {
        super('CountingLevel');
    }

    async create(): Promise<void> {
        this.gameManager = GameManager.getInstance();
        this.audioManager = AudioManager.getInstance();
        this.a11yManager = AccessibilityManager.getInstance();

        this.roundIndex = 0;
        this.currentObjects = [];
        this.currentTray = null;
        this.isLocked = false;

        let rounds: HydratedRound[];
        try {
            rounds = await this.loadCountingConfig();
        } catch (err) {
            console.error('[CountingLevel] Failed to load config:', err);
            this.showError(String(err));
            return;
        }

        if (!rounds.length) {
            console.error('[CountingLevel] No rounds in config');
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
            fontSize: '40px',
            color: '#ffffff',
            fontFamily: GAME_FONT,
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);

        this.countReadoutText = this.add.text(this.scale.width / 2, 110, '', {
            fontSize: '26px',
            color: '#fff8e1',
            fontFamily: GAME_FONT,
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);

        this.roundLayer = this.add.container(0, 0);

        this.feedbackOverlay = new FeedbackOverlay(this, { theme: this.theme });
        this.gameManager.on(GameManager.EVENTS.CONTROL_PAUSE, this.onPauseGame, this);
        this.gameManager.on(GameManager.EVENTS.CONTROL_RESUME, this.onResumeGame, this);
        this.events.once('shutdown', this.shutdown, this);


        this.startRound(0);
    }

    private async loadCountingConfig(): Promise<HydratedRound[]> {
        const preview = getPreviewRuntimeSettings();
        const gameId = preview.gameId
            || ConfigLoader.getGameIdFromUrl()
            || 'farm-count-01';

        const urlLang = preview.language
            || ConfigLoader.getLanguageFromUrl()
            || 'ro';

        i18n.setLanguage(urlLang);

        const bundle = await ConfigLoader.getInstance().loadTemplateConfig({
            gameId,
            language: urlLang
        });
        const raw = bundle.config as unknown as RawCountingConfig;
        const strings = bundle.strings as {
            meta?: { title?: string };
            instruction?: string;
            countReadout?: string;
            rounds?: Record<string, { prompt?: string; objectLabel?: string }>;
        };

        this.pointsPerRound = raw.meta.pointsPerRound ?? 10;
        this.roundDelay = raw.meta.roundDelay ?? 900;

        if (strings.instruction) {
            this.instructionFallback = strings.instruction;
        }

        const defaultShape = raw.meta.defaultShape ?? 'circle';
        const defaultFill = raw.meta.defaultFillColor ?? 0xFFB74D;
        const defaultStroke = raw.meta.defaultStrokeColor ?? 0xE65100;

        const roundStrings = strings.rounds ?? {};
        const rounds: HydratedRound[] = raw.rounds.map((r) => {
            const strings = roundStrings[r.id] ?? {};
            return {
                id: r.id,
                count: r.count,
                shape: r.shape ?? defaultShape,
                fillColor: r.fillColor ?? defaultFill,
                strokeColor: r.strokeColor ?? defaultStroke,
                trayNumerals: (r.trayNumerals && r.trayNumerals.length > 0)
                    ? r.trayNumerals
                    : this.buildDefaultTray(r.count),
                prompt: strings.prompt ?? this.instructionFallback,
                objectLabel: strings.objectLabel ?? r.id
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

    private buildDefaultTray(target: number): number[] {
        // Always produce a tray of 4 options including the correct target.
        // Keep candidates in the same local range so the child has to count —
        // wildly distant options are too easy for ages 3-6.
        const candidates = new Set<number>();
        candidates.add(target);
        let offset = 1;
        while (candidates.size < 4 && offset < 20) {
            if (target - offset >= 1) candidates.add(target - offset);
            if (candidates.size < 4) candidates.add(target + offset);
            offset++;
        }
        const arr = Array.from(candidates).sort((a, b) => a - b);
        return arr.slice(0, 4);
    }

    private startRound(index: number): void {
        this.roundIndex = index;
        this.gameManager.startStep(index);
        this.clearRoundLayer();

        const round = this.rounds[index];
        this.instructionText.setText(round.prompt);
        this.updateCountReadout(0, round.count);

        // Emit equivalent to the shared "question" ARIA announcement
        this.a11yManager.announce(round.prompt);

        this.spawnObjects(round);
        this.spawnTray(round);
    }

    private spawnObjects(round: HydratedRound): void {
        this.currentObjects = [];

        const { width, height } = this.scale;
        const playArea = {
            x: 80,
            y: 150,
            width: width - 160,
            height: height - 360
        };

        const radius = this.pickObjectRadius(round.count, playArea.width, playArea.height);
        const positions = this.layoutPositions(round.count, radius, playArea);

        for (let i = 0; i < round.count; i++) {
            const pos = positions[i];
            const obj = new CountableObject(this, {
                x: pos.x,
                y: pos.y,
                radius,
                shape: round.shape,
                fillColor: round.fillColor,
                strokeColor: round.strokeColor,
                theme: this.theme,
                accessibleLabel: round.objectLabel
            });
            obj.on('pointerup', () => this.onObjectTapped(obj));
            obj.animateIn(i * 60);
            this.roundLayer.add(obj);
            this.currentObjects.push(obj);
        }
    }

    private spawnTray(round: HydratedRound): void {
        const tray = new NumeralTray(this, {
            x: this.scale.width / 2,
            y: this.scale.height - 120,
            numerals: round.trayNumerals,
            correctNumeral: round.count,
            theme: this.theme
        });
        tray.animateIn();
        tray.on(NumeralTray.EVENTS.CORRECT, this.onCorrectNumeral, this);
        tray.on(NumeralTray.EVENTS.INCORRECT, this.onIncorrectNumeral, this);
        this.roundLayer.add(tray);
        this.currentTray = tray;
    }

    private onObjectTapped(obj: CountableObject): void {
        if (this.isLocked || obj.isCounted()) return;
        this.audioManager.playSfx('click');
        obj.pop();
        this.events.emit(CountingLevel.EVENTS.OBJECT_COUNTED, obj);

        const round = this.rounds[this.roundIndex];
        const counted = this.currentObjects.filter(o => o.isCounted()).length;
        this.updateCountReadout(counted, round.count);
    }

    private onCorrectNumeral(_numeral: number): void {
        if (this.isLocked) return;
        this.isLocked = true;
        this.gameManager.completeStep(this.roundIndex, {
            scoreDelta: this.pointsPerRound,
            correct: true
        });
        this.a11yManager.announce(i18n.tRandom('feedback.correct'));
        this.events.emit(CountingLevel.EVENTS.ROUND_SOLVED, this.roundIndex);

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

    private onIncorrectNumeral(_numeral: number): void {
        this.a11yManager.announce(i18n.tRandom('feedback.incorrect'));
        this.showEncouragement(this.scale.width / 2, this.scale.height - 220);
    }

    private onAllRoundsSolved(): void {
        this.events.emit(CountingLevel.EVENTS.ALL_ROUNDS_SOLVED);
        this.gameManager.completeActivity();
        this.scene.start('Results', this.gameManager.createResultsData({
            restartScene: 'CountingLevel'
        }));
    }

    private clearRoundLayer(): void {
        if (this.currentTray) {
            this.currentTray.off(NumeralTray.EVENTS.CORRECT, this.onCorrectNumeral, this);
            this.currentTray.off(NumeralTray.EVENTS.INCORRECT, this.onIncorrectNumeral, this);
            this.currentTray = null;
        }
        this.roundLayer.removeAll(true);
        this.currentObjects = [];
    }

    private updateCountReadout(counted: number, total: number): void {
        this.countReadoutText.setText(`${counted} / ${total}`);
    }

    private pickObjectRadius(count: number, areaW: number, areaH: number): number {
        // Target ~6-8% of the shorter axis for counts up to 5; shrink for higher
        // counts to keep objects fully inside the play area on 720p.
        const base = Math.min(areaW, areaH) * 0.09;
        const shrink = count <= 5 ? 1 : count <= 10 ? 0.8 : 0.65;
        return Math.max(40, Math.min(80, base * shrink));
    }

    private layoutPositions(count: number, radius: number, area: { x: number; y: number; width: number; height: number }): { x: number; y: number }[] {
        const positions: { x: number; y: number }[] = [];
        const cols = Math.min(count, count <= 6 ? count : Math.ceil(Math.sqrt(count * 1.4)));
        const rows = Math.ceil(count / cols);
        const cellW = area.width / cols;
        const cellH = area.height / rows;
        const padding = radius + 8;

        for (let i = 0; i < count; i++) {
            const c = i % cols;
            const r = Math.floor(i / cols);
            const cx = area.x + c * cellW + cellW / 2;
            const cy = area.y + r * cellH + cellH / 2;

            // Light jitter inside each cell so the layout feels playful — but
            // clamped to stay inside the play area.
            const jitterX = Phaser.Math.Between(-Math.floor(cellW / 6), Math.floor(cellW / 6));
            const jitterY = Phaser.Math.Between(-Math.floor(cellH / 6), Math.floor(cellH / 6));
            const x = Phaser.Math.Clamp(cx + jitterX, area.x + padding, area.x + area.width - padding);
            const y = Phaser.Math.Clamp(cy + jitterY, area.y + padding, area.y + area.height - padding);
            positions.push({ x, y });
        }

        return positions;
    }

    private showEncouragement(x: number, y: number): void {
        const text = this.add.text(x, y, i18n.tRandom('feedback.incorrect'), {
            fontSize: '26px',
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
    }

    private onResumeGame(): void {
        this.isLocked = false;
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
    }
}
