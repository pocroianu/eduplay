import Phaser from 'phaser';
import {
    GameManager,
    AudioManager,
    AccessibilityManager,
    AnimatedBackground,
    FeedbackOverlay,
    ThemeConfig,
    GameConfig,
    getPreviewRuntimeSettings,
    ConfigLoader,
    i18n
} from '@edu-play/game-core';
import MatchCard from '../prefabs/MatchCard';
import WordCard from '../prefabs/WordCard';

interface MatchPair {
    id: string;
    imageKey: string;
    label: string;
}

interface RawMatchConfig {
    meta: {
        gameId: string;
        version?: string;
        gameType?: string;
        shufflePairs?: boolean;
        themeName?: string;
        pointsPerPair?: number;
        penaltyPoints?: number;
        supportedLanguages?: string[];
    };
    pairs: Array<{
        id: string;
        imageKey: string;
        labelKey: string;
    }>;
}

export default class MatchLevel extends Phaser.Scene {
    static readonly EVENTS = {
        PAIR_MATCHED:       'pair-matched',
        PAIR_WRONG:         'pair-wrong',
        ALL_PAIRS_MATCHED:  'all-pairs-matched'
    } as const;

    private gameManager!: GameManager;
    private audioManager!: AudioManager;
    private a11yManager!: AccessibilityManager;
    private theme!: ThemeConfig;

    matchCards: MatchCard[] = [];
    wordCards: WordCard[] = [];
    private selectedMatchCard: MatchCard | null = null;
    private selectedWordCard: WordCard | null = null;
    private matchedCount = 0;
    private totalPairs = 0;
    private isEvaluating = false;
    private pointsPerPair = 10;
    private penaltyPoints = 2;

    private feedbackOverlay!: FeedbackOverlay;

    constructor() {
        super('MatchLevel');
    }

    async create(data?: { config?: GameConfig & { pairs?: MatchPair[] } }): Promise<void> {
        this.gameManager = GameManager.getInstance();
        this.audioManager = AudioManager.getInstance();
        this.a11yManager = AccessibilityManager.getInstance();

        let pairs: MatchPair[] = [];

        // If Preload passed pairs via scene data, use them
        if (data?.config?.pairs?.length) {
            this.gameManager.loadConfig(data.config as GameConfig);
            pairs = data.config.pairs;
            this.pointsPerPair = (data.config.meta as any).pointsPerPair ?? 10;
            this.penaltyPoints = (data.config.meta as any).penaltyPoints ?? 2;
        } else if ((this.gameManager.getConfig() as any)?.pairs) {
            // Config already loaded by Preload into GameManager (future/restart path)
            const cfg = this.gameManager.getConfig() as GameConfig & { pairs: MatchPair[] };
            this.gameManager.loadConfig(cfg as GameConfig);
            pairs = cfg.pairs;
            this.pointsPerPair = (cfg.meta as any).pointsPerPair ?? 10;
            this.penaltyPoints = (cfg.meta as any).penaltyPoints ?? 2;
        } else {
            // Self-load through centralized ConfigLoader
            try {
                pairs = await this.loadMatchingConfig();
            } catch (err) {
                console.error('[MatchLevel] Failed to load config:', err);
                this.showError(String(err));
                return;
            }
        }

        if (!pairs.length) {
            console.error('[MatchLevel] No pairs found in config');
            this.showError('No pairs found in config');
            return;
        }

        const themeOverride = getPreviewRuntimeSettings().theme;
        if (themeOverride) {
            this.gameManager.setThemeName(themeOverride);
        }
        this.theme = this.gameManager.getTheme();
        this.totalPairs = pairs.length;
        this.loadPairActivity(pairs);

        // Background
        new AnimatedBackground(this, {
            width: this.scale.width,
            height: this.scale.height,
            theme: this.theme
        });

        this.layoutCards(pairs);

        // FeedbackOverlay
        this.feedbackOverlay = new FeedbackOverlay(this, {
            theme: this.theme
        });
        this.gameManager.on(GameManager.EVENTS.CONTROL_PAUSE, this.onPauseGame, this);
        this.gameManager.on(GameManager.EVENTS.CONTROL_RESUME, this.onResumeGame, this);
        this.events.once('shutdown', this.shutdown, this);

    }

    private async loadMatchingConfig(): Promise<MatchPair[]> {
        const preview = getPreviewRuntimeSettings();
        const gameId = preview.gameId
            || ConfigLoader.getGameIdFromUrl()
            || 'animals-match-01';

        const urlLang = preview.language
            || ConfigLoader.getLanguageFromUrl()
            || 'en';

        i18n.setLanguage(urlLang);

        const bundle = await ConfigLoader.getInstance().loadTemplateConfig({
            gameId,
            language: urlLang
        });
        const raw = bundle.config as unknown as RawMatchConfig;
        const strings = bundle.strings as { pairs?: Record<string, string>; meta?: any };

        this.pointsPerPair = raw.meta.pointsPerPair ?? 10;
        this.penaltyPoints = raw.meta.penaltyPoints ?? 2;

        // Build hydrated pairs
        const pairsStrings: Record<string, string> = strings.pairs ?? {};
        const pairs: MatchPair[] = raw.pairs.map(p => ({
            id: p.id,
            imageKey: p.imageKey,
            label: pairsStrings[p.labelKey] ?? p.labelKey
        }));

        // Load a minimal GameConfig into GameManager so tests can read it
        const syntheticConfig: GameConfig & { pairs: MatchPair[] } = {
            meta: {
                gameId: raw.meta.gameId,
                totalSteps: pairs.length,
                theme: this.gameManager.getTheme(),
                title: strings.meta?.title ?? raw.meta.gameId,
                pointsPerPair: this.pointsPerPair,
                penaltyPoints: this.penaltyPoints
            } as any,
            questions: [],
            pairs
        };
        this.gameManager.loadConfig(syntheticConfig as unknown as GameConfig);

        return pairs;
    }

    private loadPairActivity(pairs: MatchPair[]): void {
        const meta = this.gameManager.getConfig()?.meta as any;
        this.gameManager.loadActivity({
            gameId: meta?.gameId,
            title: meta?.title,
            totalSteps: pairs.length,
            maxScore: pairs.length * this.pointsPerPair,
            theme: this.theme
        }, { resetState: false });
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

    private layoutCards(pairs: MatchPair[]): void {
        const gameWidth  = this.scale.width;
        const gameHeight = this.scale.height;
        const n = pairs.length;

        const verticalUsable = gameHeight * 0.75;
        const cardHeight = Math.max(80, Math.min(80, Math.floor((verticalUsable - (n - 1) * 12) / n)));
        const cardWidth  = Math.floor(gameWidth * 0.28);
        const gap        = 12;

        const totalHeight = n * cardHeight + (n - 1) * gap;
        const startY      = (gameHeight - totalHeight) / 2 + cardHeight / 2;

        const leftX  = gameWidth * 0.25;
        const rightX = gameWidth * 0.75;

        // Shuffle right-column order independently
        const shuffledPairs = [...pairs].sort(() => Math.random() - 0.5);

        for (let i = 0; i < n; i++) {
            const y = startY + i * (cardHeight + gap);

            const matchCard = new MatchCard(this, {
                x: leftX, y,
                width: cardWidth, height: cardHeight,
                imageKey: pairs[i].imageKey,
                pairId: pairs[i].id,
                theme: this.theme
            });
            matchCard.on(MatchCard.EVENTS.SELECTED, this.onMatchCardSelected, this);
            this.matchCards.push(matchCard);

            const wordCard = new WordCard(this, {
                x: rightX, y,
                width: cardWidth, height: cardHeight,
                label: shuffledPairs[i].label,
                pairId: shuffledPairs[i].id,
                theme: this.theme
            });
            wordCard.on(WordCard.EVENTS.SELECTED, this.onWordCardSelected, this);
            this.wordCards.push(wordCard);
        }
    }

    private onMatchCardSelected(card: MatchCard): void {
        if (this.isEvaluating) return;

        if (this.selectedMatchCard && this.selectedMatchCard !== card) {
            this.selectedMatchCard.setCardState('idle');
            this.selectedMatchCard.setScale(1);
        }

        this.selectedMatchCard = card;
        card.setCardState('selected');
        card.setScale(1);
        this.audioManager.playSfx('click');

        if (this.selectedWordCard) {
            this.evaluatePair();
        }
    }

    private onWordCardSelected(card: WordCard): void {
        if (this.isEvaluating) return;

        if (this.selectedWordCard && this.selectedWordCard !== card) {
            this.selectedWordCard.setCardState('idle');
            this.selectedWordCard.setScale(1);
        }

        this.selectedWordCard = card;
        card.setCardState('selected');
        card.setScale(1);
        this.audioManager.playSfx('click');

        if (this.selectedMatchCard) {
            this.evaluatePair();
        }
    }

    private evaluatePair(): void {
        if (!this.selectedMatchCard || !this.selectedWordCard) return;

        this.isEvaluating = true;
        const isCorrect = this.selectedMatchCard.pairId === this.selectedWordCard.pairId;

        if (isCorrect) {
            this.selectedMatchCard.setCardState('matched');
            this.selectedWordCard.setCardState('matched');
            this.audioManager.playSfx('correct');
            const stepIndex = this.matchedCount;
            this.gameManager.completeStep(stepIndex, {
                scoreDelta: this.pointsPerPair,
                correct: true
            });
            this.events.emit(MatchLevel.EVENTS.PAIR_MATCHED, {
                pairId: this.selectedMatchCard.pairId
            });

            this.matchedCount++;
            this.selectedMatchCard = null;
            this.selectedWordCard  = null;
            this.isEvaluating = false;

            if (this.matchedCount === this.totalPairs) {
                this.onAllPairsMatched();
            }
        } else {
            const mc = this.selectedMatchCard;
            const wc = this.selectedWordCard;
            mc.setCardState('wrong');
            wc.setCardState('wrong');
            this.audioManager.playSfx('incorrect');
            this.gameManager.deductPoints(this.penaltyPoints);

            this.events.emit(MatchLevel.EVENTS.PAIR_WRONG, {
                matchPairId: mc.pairId,
                wordPairId:  wc.pairId
            });

            this.selectedMatchCard = null;
            this.selectedWordCard  = null;

            this.showEncouragement(this.scale.width / 2, this.scale.height / 2);

            this.time.delayedCall(350, () => {
                this.isEvaluating = false;
            });
        }
    }

    private showEncouragement(x: number, y: number): void {
        const text = this.add.text(x, y - 30, 'Try again!', {
            fontSize: '22px',
            color: '#f59e0b',
            fontFamily: "'Nunito', Arial, sans-serif",
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.tweens.add({
            targets: text,
            y: y - 70,
            alpha: 0,
            duration: 1200,
            ease: 'Sine.easeOut',
            onComplete: () => text.destroy()
        });
    }

    private onPauseGame(): void {
        this.isEvaluating = true;
        this.matchCards
            .filter(c => c.getState() !== 'matched')
            .forEach(c => c.disableInteractive());
        this.wordCards
            .filter(c => c.getState() !== 'matched')
            .forEach(c => c.disableInteractive());
    }

    private onResumeGame(): void {
        this.isEvaluating = false;
        this.matchCards
            .filter(c => c.getState() === 'idle' || c.getState() === 'selected')
            .forEach(c => c.setInteractive());
        this.wordCards
            .filter(c => c.getState() === 'idle' || c.getState() === 'selected')
            .forEach(c => c.setInteractive());
    }

    shutdown(): void {
        this.gameManager.off(GameManager.EVENTS.CONTROL_PAUSE, this.onPauseGame, this);
        this.gameManager.off(GameManager.EVENTS.CONTROL_RESUME, this.onResumeGame, this);
    }

    private onAllPairsMatched(): void {
        this.events.emit(MatchLevel.EVENTS.ALL_PAIRS_MATCHED);

        this.feedbackOverlay.showCorrect().then(() => {
            this.gameManager.completeActivity();
            this.scene.start('Results', this.gameManager.createResultsData({
                restartScene: 'MatchLevel'
            }));
        });
    }
}
