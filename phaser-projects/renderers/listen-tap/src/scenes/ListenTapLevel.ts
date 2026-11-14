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
    Language
} from '@edu-play/game-core';
import AudioPromptButton from '../prefabs/AudioPromptButton';
import ChoiceTile, { ChoiceTileData } from '../prefabs/ChoiceTile';
import ChoiceTray from '../prefabs/ChoiceTray';

interface RawChoice {
    id: string;
    imageAssetId?: string;
    letter?: string;
    correct?: boolean;
    labelKey?: string;
}

interface RawRound {
    id: string;
    promptAudioId: string;
    choices: RawChoice[];
    promptKey?: string;
}

interface RawListenTapConfig {
    meta: {
        gameId: string;
        version?: string;
        gameType?: string;
        themeName?: string;
        pointsPerRound?: number;
        roundDelay?: number;
        supportedLanguages?: string[];
    };
    rounds: RawRound[];
}

interface HydratedChoice extends ChoiceTileData {
    correct: boolean;
}

interface HydratedRound {
    id: string;
    promptAudioId: string;
    promptText: string;
    choices: HydratedChoice[];
}

const DEFAULT_GAME_ID = 'phonics-ro-01';
const PROMPT_TO_CHOICE_DELAY = 700;
const REPLAY_COOLDOWN = 500;

export default class ListenTapLevel extends Phaser.Scene {
    static readonly EVENTS = {
        PROMPT_STARTED: 'listen-tap-prompt-started',
        ROUND_SOLVED: 'listen-tap-round-solved',
        ALL_ROUNDS_SOLVED: 'listen-tap-all-rounds-solved'
    } as const;

    private gameManager!: GameManager;
    private audioManager!: AudioManager;
    private a11yManager!: AccessibilityManager;
    private theme!: ThemeConfig;

    private rounds: HydratedRound[] = [];
    private roundIndex = 0;
    private pointsPerRound = 10;
    private roundDelay = 900;

    private promptButton!: AudioPromptButton;
    private currentTray: ChoiceTray | null = null;
    private feedbackOverlay!: FeedbackOverlay;
    private isLocked = false;
    private roundLayer!: Phaser.GameObjects.Container;
    private lastReplayAt = 0;

    constructor() {
        super('ListenTapLevel');
    }

    async create(): Promise<void> {
        this.gameManager = GameManager.getInstance();
        this.audioManager = AudioManager.getInstance();
        this.a11yManager = AccessibilityManager.getInstance();
        this.audioManager.init(this);

        this.roundIndex = 0;
        this.currentTray = null;
        this.isLocked = false;

        let rounds: HydratedRound[];
        try {
            rounds = await this.loadListenTapConfig();
        } catch (err) {
            console.error('[ListenTapLevel] Failed to load config:', err);
            this.showError(String(err));
            return;
        }

        if (!rounds.length) {
            console.error('[ListenTapLevel] No rounds in config');
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

        this.roundLayer = this.add.container(0, 0);

        this.promptButton = new AudioPromptButton(this, {
            x: this.scale.width / 2,
            y: 180,
            radius: 90,
            theme: this.theme
        });
        this.promptButton.on(AudioPromptButton.EVENTS.PRESSED, this.onReplayPressed, this);
        this.gameManager.setActivityCapabilities({ repeatInstruction: true });
        this.gameManager.on(GameManager.EVENTS.CONTROL_REPEAT_INSTRUCTION, this.onReplayPressed, this);

        this.feedbackOverlay = new FeedbackOverlay(this, { theme: this.theme });
        this.gameManager.on(GameManager.EVENTS.CONTROL_PAUSE, this.onPauseGame, this);
        this.gameManager.on(GameManager.EVENTS.CONTROL_RESUME, this.onResumeGame, this);
        this.events.once('shutdown', this.shutdown, this);


        this.startRound(0);
    }

    private async loadListenTapConfig(): Promise<HydratedRound[]> {
        const preview = getPreviewRuntimeSettings();
        const gameId = preview.gameId
            || ConfigLoader.getGameIdFromUrl()
            || DEFAULT_GAME_ID;

        const urlLang = preview.language
            || ConfigLoader.getLanguageFromUrl()
            || 'ro';

        i18n.setLanguage(urlLang);

        const bundle = await ConfigLoader.getInstance().loadTemplateConfig({
            gameId,
            language: urlLang
        });
        const raw = bundle.config as unknown as RawListenTapConfig;

        // i18n strings live alongside the config but are mostly advisory —
        // the student UI itself is audio-first and text-free.
        const strings = bundle.strings as {
            meta?: { title?: string };
            rounds?: Record<string, { prompt?: string }>;
        };

        this.pointsPerRound = raw.meta.pointsPerRound ?? 10;
        this.roundDelay = raw.meta.roundDelay ?? 900;

        const roundStrings = strings.rounds ?? {};
        const rounds: HydratedRound[] = raw.rounds.map((r) => {
            const rs = roundStrings[r.id] ?? {};
            return {
                id: r.id,
                promptAudioId: r.promptAudioId,
                promptText: rs.prompt ?? r.id,
                choices: r.choices.map((c) => ({
                    id: c.id,
                    imageAssetId: c.imageAssetId,
                    letter: c.letter,
                    correct: !!c.correct
                }))
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
        this.clearRoundLayer();

        const round = this.rounds[index];
        this.a11yManager.announce(round.promptText);

        // Audio-first timing: prompt plays, *then* the tiles animate in. For
        // pre-readers the order matters — showing the choices before the
        // audio prompt invites guessing.
        this.playPrompt(round);
        this.promptButton.pulse();

        this.time.delayedCall(PROMPT_TO_CHOICE_DELAY, () => {
            if (!this.scene.isActive()) return;
            this.spawnTray(round);
        });
    }

    private spawnTray(round: HydratedRound): void {
        const tray = new ChoiceTray(this, {
            x: this.scale.width / 2,
            y: this.scale.height * 0.62,
            tiles: round.choices.map((choice) => ({
                data: choice,
                correct: choice.correct
            })),
            theme: this.theme
        });
        tray.animateIn();
        tray.on(ChoiceTray.EVENTS.CORRECT, this.onCorrectChoice, this);
        tray.on(ChoiceTray.EVENTS.INCORRECT, this.onIncorrectChoice, this);
        this.roundLayer.add(tray);
        this.currentTray = tray;
    }

    private playPrompt(round: HydratedRound): void {
        try {
            if (this.cache.audio.exists(round.promptAudioId)) {
                this.audioManager.playSound(round.promptAudioId);
                this.events.emit(ListenTapLevel.EVENTS.PROMPT_STARTED, round.promptAudioId);
            } else {
                // Silent placeholder path — fine during the pre-TTS window.
                this.events.emit(ListenTapLevel.EVENTS.PROMPT_STARTED, round.promptAudioId);
            }
        } catch (err) {
            console.warn('[ListenTapLevel] Failed to play prompt audio', err);
        }
    }

    private onReplayPressed(): void {
        if (this.isLocked) return;
        const now = this.time.now;
        if (now - this.lastReplayAt < REPLAY_COOLDOWN) return;
        this.lastReplayAt = now;

        const round = this.rounds[this.roundIndex];
        if (!round) return;
        this.a11yManager.announce(round.promptText);
        this.playPrompt(round);
    }

    private onCorrectChoice(_tile: ChoiceTile): void {
        if (this.isLocked) return;
        this.isLocked = true;
        this.gameManager.completeStep(this.roundIndex, {
            scoreDelta: this.pointsPerRound,
            correct: true
        });
        this.a11yManager.announce(i18n.tRandom('feedback.correct'));
        this.events.emit(ListenTapLevel.EVENTS.ROUND_SOLVED, this.roundIndex);
        this.audioManager.playSfx('correct');

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

    private onIncorrectChoice(_tile: ChoiceTile): void {
        this.a11yManager.announce(i18n.tRandom('feedback.incorrect'));
        this.audioManager.playSfx('incorrect');
    }

    private onAllRoundsSolved(): void {
        this.events.emit(ListenTapLevel.EVENTS.ALL_ROUNDS_SOLVED);
        this.gameManager.completeActivity();
        this.scene.start('Results', this.gameManager.createResultsData({
            restartScene: 'ListenTapLevel'
        }));
    }

    private clearRoundLayer(): void {
        if (this.currentTray) {
            this.currentTray.off(ChoiceTray.EVENTS.CORRECT, this.onCorrectChoice, this);
            this.currentTray.off(ChoiceTray.EVENTS.INCORRECT, this.onIncorrectChoice, this);
            this.currentTray = null;
        }
        this.roundLayer.removeAll(true);
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
        this.gameManager.off(GameManager.EVENTS.CONTROL_REPEAT_INSTRUCTION, this.onReplayPressed, this);
        this.gameManager.off(GameManager.EVENTS.CONTROL_PAUSE, this.onPauseGame, this);
        this.gameManager.off(GameManager.EVENTS.CONTROL_RESUME, this.onResumeGame, this);
    }
}
