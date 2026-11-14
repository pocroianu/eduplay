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
import SequencePad, { SequencePadSpec } from '../prefabs/SequencePad';

interface RawSequenceConfig {
    meta: {
        gameId: string;
        version?: string;
        gameType?: string;
        themeName?: string;
        pointsPerRound?: number;
        roundDelay?: number;
        supportedLanguages?: string[];
    };
    pads: SequencePadSpec[];
    sequence?: {
        startLength?: number;
        maxLength?: number;
        padLitMs?: number;
        playbackGapMs?: number;
        introDelayMs?: number;
        replayOnMiss?: boolean;
    };
}

interface SequenceTuning {
    startLength: number;
    maxLength: number;
    padLitMs: number;
    playbackGapMs: number;
    introDelayMs: number;
    replayOnMiss: boolean;
}

type PhaseState = 'idle' | 'playback' | 'awaiting-input' | 'failure' | 'complete';

/**
 * SequenceLevel — the Simon-style gameplay scene.
 *
 * State machine per round:
 *   playback  →  awaiting-input  →  (match) next round / (miss) failure
 *
 * The sequence length starts at `startLength` (usually 3) and grows by one
 * after each successful repeat until `maxLength` is reached — that point is
 * treated as game-complete. A miss ends the round early and routes to the
 * shared Results scene with a star rating based on rounds cleared.
 *
 * Audio identity is carried entirely by per-pad frequencies (see
 * SequencePad.playTone). No Romanian audio dependency.
 */
export default class SequenceLevel extends Phaser.Scene {
    static readonly EVENTS = {
        PLAYBACK_STARTED: 'sequence-playback-started',
        PLAYBACK_ENDED: 'sequence-playback-ended',
        PAD_CORRECT: 'sequence-pad-correct',
        PAD_WRONG: 'sequence-pad-wrong',
        ROUND_CLEARED: 'sequence-round-cleared',
        RUN_ENDED: 'sequence-run-ended'
    } as const;

    private gameManager!: GameManager;
    private audioManager!: AudioManager;
    private a11yManager!: AccessibilityManager;
    private theme!: ThemeConfig;

    private pads: SequencePad[] = [];
    private padsById: Map<string, SequencePad> = new Map();
    private tuning!: SequenceTuning;
    private pointsPerRound = 10;
    private roundDelay = 900;

    private currentSequence: string[] = [];
    private inputIndex = 0;
    private currentLength = 3;
    private roundsCleared = 0;
    private totalRounds = 0;
    private phase: PhaseState = 'idle';

    private instructionText!: Phaser.GameObjects.Text;
    private progressText!: Phaser.GameObjects.Text;
    private feedbackOverlay!: FeedbackOverlay;
    private activityTitle = 'Repeat sequence';
    private instructionFallback = 'Repeat the sequence';
    private watchPrompt = 'Watch';
    private repeatPrompt = 'Your turn';
    private progressTemplate = 'Round {current} of {total} • Sequence length {length}';

    constructor() {
        super('SequenceLevel');
    }

    async create(): Promise<void> {
        this.gameManager = GameManager.getInstance();
        this.audioManager = AudioManager.getInstance();
        this.a11yManager = AccessibilityManager.getInstance();

        this.phase = 'idle';
        this.roundsCleared = 0;

        let raw: RawSequenceConfig;
        try {
            raw = await this.loadSequenceConfig();
        } catch (err) {
            console.error('[SequenceLevel] Failed to load config:', err);
            this.showError(String(err));
            return;
        }

        if (!raw.pads || raw.pads.length < 2) {
            this.showError('Sequence config needs at least two pads');
            return;
        }

        const themeOverride = getPreviewRuntimeSettings().theme;
        if (themeOverride) {
            this.gameManager.setThemeName(themeOverride);
        }
        this.theme = this.gameManager.getTheme();

        this.tuning = this.resolveTuning(raw.sequence);
        this.pointsPerRound = raw.meta.pointsPerRound ?? 10;
        this.roundDelay = raw.meta.roundDelay ?? 900;
        this.currentLength = this.tuning.startLength;
        this.totalRounds = Math.max(1, this.tuning.maxLength - this.tuning.startLength + 1);

        new AnimatedBackground(this, {
            width: this.scale.width,
            height: this.scale.height,
            theme: this.theme
        });

        this.instructionText = this.add.text(this.scale.width / 2, 60, this.instructionFallback, {
            fontSize: '38px',
            color: '#ffffff',
            fontFamily: GAME_FONT,
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);

        this.progressText = this.add.text(this.scale.width / 2, 110, '', {
            fontSize: '22px',
            color: '#E0E7FF',
            fontFamily: GAME_FONT,
            align: 'center'
        }).setOrigin(0.5);

        this.layoutPads(raw.pads);

        this.feedbackOverlay = new FeedbackOverlay(this, { theme: this.theme });
        this.gameManager.on(GameManager.EVENTS.CONTROL_PAUSE, this.onPauseGame, this);
        this.gameManager.on(GameManager.EVENTS.CONTROL_RESUME, this.onResumeGame, this);
        this.events.once('shutdown', this.shutdown, this);


        this.gameManager.loadSyntheticActivityConfig({
            gameId: raw.meta.gameId,
            title: this.activityTitle,
            totalSteps: this.totalRounds,
            maxScore: this.totalRounds * this.pointsPerRound,
            theme: this.theme,
            meta: { pointsPerRound: this.pointsPerRound }
        });

        this.registerKeyboardFocusables();

        this.time.delayedCall(this.tuning.introDelayMs, () => {
            this.startRound();
        });
    }

    private async loadSequenceConfig(): Promise<RawSequenceConfig> {
        const preview = getPreviewRuntimeSettings();
        const gameId = preview.gameId
            || ConfigLoader.getGameIdFromUrl()
            || 'colours-sequence-01';

        const urlLang = preview.language
            || ConfigLoader.getLanguageFromUrl()
            || 'ro';

        i18n.setLanguage(urlLang);

        const bundle = await ConfigLoader.getInstance().loadTemplateConfig({
            gameId,
            language: urlLang
        });
        const raw = bundle.config as unknown as RawSequenceConfig;
        const strings = bundle.strings as {
            meta?: { title?: string };
            instruction?: string;
            watchPrompt?: string;
            repeatPrompt?: string;
            progressTemplate?: string;
            pads?: Record<string, { label?: string }>;
        };

        this.activityTitle = strings.meta?.title ?? raw.meta.gameId;

        if (strings.instruction) {
            this.instructionFallback = strings.instruction;
        }
        if (strings.repeatPrompt) {
            this.repeatPrompt = strings.repeatPrompt;
        }
        if (strings.watchPrompt) {
            this.watchPrompt = strings.watchPrompt;
        }
        if (strings.progressTemplate) {
            this.progressTemplate = strings.progressTemplate;
        }

        // Layer pad labels from language file onto the pad specs.
        if (strings.pads) {
            for (const pad of raw.pads) {
                const override = strings.pads[pad.id];
                if (override?.label) {
                    pad.accessibleLabel = override.label;
                }
            }
        }

        return raw;
    }

    private resolveTuning(overrides?: RawSequenceConfig['sequence']): SequenceTuning {
        const startLength = Math.max(2, overrides?.startLength ?? 3);
        const maxLength = Math.max(startLength, overrides?.maxLength ?? 7);
        return {
            startLength,
            maxLength,
            padLitMs: Math.max(200, overrides?.padLitMs ?? 520),
            playbackGapMs: Math.max(80, overrides?.playbackGapMs ?? 180),
            introDelayMs: Math.max(200, overrides?.introDelayMs ?? 800),
            replayOnMiss: overrides?.replayOnMiss ?? false
        };
    }

    private layoutPads(specs: SequencePadSpec[]): void {
        const count = specs.length;
        const { width, height } = this.scale;

        // Classic Simon is a 2x2 grid of four pads; we lay any pad count out
        // in a centred grid (cols ≈ sqrt(n)) so 3, 4, or 5+ pad variants all
        // render cleanly without scene-specific code changes.
        const cols = count <= 4 ? 2 : Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);
        const maxGridH = height * 0.62;
        const maxGridW = Math.min(width * 0.72, 720);
        const padSize = Math.min(Math.floor(maxGridW / cols) - 32, Math.floor(maxGridH / rows) - 32, 220);
        const gap = Math.max(24, Math.floor(padSize * 0.14));
        const gridW = cols * padSize + (cols - 1) * gap;
        const gridH = rows * padSize + (rows - 1) * gap;
        const startX = (width - gridW) / 2 + padSize / 2;
        const startY = (height - gridH) / 2 + padSize / 2 + 20;

        this.pads = [];
        this.padsById.clear();

        specs.forEach((spec, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = startX + col * (padSize + gap);
            const y = startY + row * (padSize + gap);
            const pad = new SequencePad(this, {
                x,
                y,
                size: padSize,
                spec,
                theme: this.theme
            });
            pad.animateIn(i * 70);
            pad.on(SequencePad.EVENTS.PAD_PRESSED, this.onPadPressed, this);
            this.pads.push(pad);
            this.padsById.set(spec.id, pad);
        });
    }

    private setInteractivity(enabled: boolean): void {
        this.pads.forEach((p) => p.setEnabled(enabled));
    }

    private async startRound(): Promise<void> {
        if (this.currentLength > this.tuning.maxLength) {
            this.onRunComplete();
            return;
        }

        this.gameManager.startStep(this.roundsCleared);
        this.currentSequence = this.generateSequence(this.currentLength);
        this.inputIndex = 0;
        this.phase = 'playback';
        this.setInteractivity(false);
        this.instructionText.setText(this.watchPrompt);
        this.updateProgressLabel();
        this.a11yManager.announce(this.watchPrompt);
        this.events.emit(SequenceLevel.EVENTS.PLAYBACK_STARTED, {
            length: this.currentLength
        });

        await this.playbackSequence(this.currentSequence);

        this.phase = 'awaiting-input';
        this.instructionText.setText(this.repeatPrompt);
        this.a11yManager.announce(this.repeatPrompt);
        this.setInteractivity(true);
        this.events.emit(SequenceLevel.EVENTS.PLAYBACK_ENDED);
    }

    private async playbackSequence(sequence: string[]): Promise<void> {
        for (const padId of sequence) {
            const pad = this.padsById.get(padId);
            if (!pad) continue;
            await pad.flash(this.tuning.padLitMs, { playTone: true });
            await this.wait(this.tuning.playbackGapMs);
        }
    }

    private onPadPressed(pad: SequencePad): void {
        if (this.phase !== 'awaiting-input') return;
        const expected = this.currentSequence[this.inputIndex];

        // Light the pad so the kid can feel their own tap, regardless of
        // correct/wrong. Tone is gated on correctness so a miss doesn't
        // reward with the right melodic note.
        if (pad.spec.id === expected) {
            pad.flash(Math.max(220, this.tuning.padLitMs - 120), { playTone: true });
            this.inputIndex++;
            this.events.emit(SequenceLevel.EVENTS.PAD_CORRECT, {
                padId: pad.spec.id,
                progress: this.inputIndex,
                total: this.currentSequence.length
            });
            if (this.inputIndex >= this.currentSequence.length) {
                this.onRoundCleared();
            }
        } else {
            pad.flash(220, { playTone: false });
            pad.animateWrong();
            this.onRoundFailed(pad);
        }
    }

    private onRoundCleared(): void {
        this.phase = 'idle';
        this.setInteractivity(false);
        this.gameManager.completeStep(this.roundsCleared, {
            scoreDelta: this.pointsPerRound,
            correct: true
        });
        this.roundsCleared++;
        this.events.emit(SequenceLevel.EVENTS.ROUND_CLEARED, {
            length: this.currentLength,
            roundsCleared: this.roundsCleared
        });

        this.feedbackOverlay.showCorrect().then(() => {
            this.currentLength++;
            if (this.currentLength > this.tuning.maxLength) {
                this.onRunComplete();
                return;
            }
            this.time.delayedCall(this.roundDelay, () => this.startRound());
        });
    }

    private onRoundFailed(_pad: SequencePad): void {
        this.phase = 'failure';
        this.setInteractivity(false);
        this.audioManager.playSfx('incorrect');
        this.a11yManager.announce(i18n.tRandom('feedback.incorrect'));
        this.events.emit(SequenceLevel.EVENTS.PAD_WRONG, {
            expected: this.currentSequence[this.inputIndex],
            progress: this.inputIndex,
            roundsCleared: this.roundsCleared
        });

        if (this.tuning.replayOnMiss) {
            // Give one retry at the same length before ending the run.
            this.time.delayedCall(this.roundDelay, () => this.startRound());
            return;
        }

        this.time.delayedCall(this.roundDelay, () => this.onRunEnded(false));
    }

    private onRunComplete(): void {
        this.phase = 'complete';
        this.onRunEnded(true);
    }

    private onRunEnded(perfect: boolean): void {
        const total = this.totalRounds;
        const accuracy = total > 0 ? this.roundsCleared / total : 0;
        const starRating = perfect || accuracy >= 0.9 ? 3 : accuracy >= 0.66 ? 2 : 1;

        this.gameManager.completeActivity({ starRating });
        this.events.emit(SequenceLevel.EVENTS.RUN_ENDED, {
            perfect,
            roundsCleared: this.roundsCleared,
            total
        });
        this.scene.start('Results', this.gameManager.createResultsData({
            restartScene: 'SequenceLevel',
            starRating
        }));
    }

    private generateSequence(length: number): string[] {
        const ids: string[] = this.pads.map((p) => p.spec.id);
        const out: string[] = [];
        let lastPick: string | null = null;
        for (let i = 0; i < length; i++) {
            const pool: string[] = ids.length > 1 && lastPick !== null
                ? ids.filter((id) => id !== lastPick)
                : ids;
            const pick: string = pool[Math.floor(Math.random() * pool.length)];
            out.push(pick);
            lastPick = pick;
        }
        return out;
    }

    private updateProgressLabel(): void {
        const current = Math.min(this.roundsCleared + 1, this.totalRounds);
        const label = this.progressTemplate
            .replace('{current}', String(current))
            .replace('{total}', String(this.totalRounds))
            .replace('{length}', String(this.currentLength));
        this.progressText.setText(label);
    }

    private registerKeyboardFocusables(): void {
        this.a11yManager.clearGroup('pads');
        this.pads.forEach((pad) => {
            this.a11yManager.registerFocusable({
                id: `pad-${pad.spec.id}`,
                element: pad,
                label: pad.getAccessibleLabel(),
                group: 'pads',
                onSelect: () => {
                    if (this.phase === 'awaiting-input') {
                        this.onPadPressed(pad);
                    }
                },
                onFocus: () => pad.showFocus(),
                onBlur: () => pad.hideFocus()
            });
        });
        this.a11yManager.setActiveGroup('pads');
    }

    private onPauseGame(): void {
        this.setInteractivity(false);
    }

    private onResumeGame(): void {
        if (this.phase === 'awaiting-input') {
            this.setInteractivity(true);
        }
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

    private wait(ms: number): Promise<void> {
        return new Promise((resolve) => {
            this.time.delayedCall(ms, resolve);
        });
    }

    shutdown(): void {
        this.gameManager.off(GameManager.EVENTS.CONTROL_PAUSE, this.onPauseGame, this);
        this.gameManager.off(GameManager.EVENTS.CONTROL_RESUME, this.onResumeGame, this);
        this.pads.forEach((p) => p.removeAllListeners());
        this.a11yManager.clearGroup('pads');
    }
}
