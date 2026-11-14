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
import FlipCard from '../prefabs/FlipCard';

interface RawPair {
    id: string;
    imageKey?: string;
    labelKey: string;
}

interface RawMemoryConfig {
    meta: {
        gameId: string;
        version?: string;
        gameType?: string;
        themeName?: string;
        pointsPerPair?: number;
        flipBackDelay?: number;
        gridColumns?: number;
        supportedLanguages?: string[];
    };
    pairs: RawPair[];
}

interface HydratedPair {
    id: string;
    imageKey?: string;
    label: string;
}

interface CardEntry {
    pairId: string;
    imageKey?: string;
    label: string;
}

export default class MemoryLevel extends Phaser.Scene {
    static readonly EVENTS = {
        CARDS_MATCHED: 'cards-matched',
        CARDS_MISMATCHED: 'cards-mismatched',
        ALL_MATCHED: 'all-matched'
    } as const;

    private gameManager!: GameManager;
    private audioManager!: AudioManager;
    private a11yManager!: AccessibilityManager;
    private theme!: ThemeConfig;

    private cards: FlipCard[] = [];
    private flippedCards: FlipCard[] = [];
    private matchedPairs = 0;
    private totalPairs = 0;
    private attempts = 0;
    private pointsPerPair = 10;
    private flipBackDelay = 1000;
    private gridColumns = 4;
    private isLocked = false;

    private feedbackOverlay!: FeedbackOverlay;
    private instructionText = 'Find the matching pairs!';

    constructor() {
        super('MemoryLevel');
    }

    async create(): Promise<void> {
        this.gameManager = GameManager.getInstance();
        this.audioManager = AudioManager.getInstance();
        this.a11yManager = AccessibilityManager.getInstance();

        // Reset state
        this.cards = [];
        this.flippedCards = [];
        this.matchedPairs = 0;
        this.attempts = 0;
        this.isLocked = false;

        let pairs: HydratedPair[] = [];

        try {
            pairs = await this.loadMemoryConfig();
        } catch (err) {
            console.error('[MemoryLevel] Failed to load config:', err);
            this.showError(String(err));
            return;
        }

        if (!pairs.length) {
            console.error('[MemoryLevel] No pairs in config');
            this.showError('No pairs found in config');
            return;
        }

        const themeOverride = getPreviewRuntimeSettings().theme;
        if (themeOverride) {
            this.gameManager.setThemeName(themeOverride);
        }
        this.theme = this.gameManager.getTheme();
        this.totalPairs = pairs.length;
        this.gameManager.startStep(0);

        // Animated background
        new AnimatedBackground(this, {
            width: this.scale.width,
            height: this.scale.height,
            theme: this.theme
        });

        // Instruction text
        this.add.text(this.scale.width / 2, 40, this.instructionText, {
            fontSize: '32px',
            color: '#ffffff',
            fontFamily: GAME_FONT,
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);

        // Duplicate pairs to create card entries, then shuffle
        const cardEntries: CardEntry[] = [];
        for (const pair of pairs) {
            cardEntries.push({ pairId: pair.id, imageKey: pair.imageKey, label: pair.label });
            cardEntries.push({ pairId: pair.id, imageKey: pair.imageKey, label: pair.label });
        }
        this.shuffleArray(cardEntries);

        // Compute grid layout
        const totalCards = cardEntries.length;
        const rows = Math.ceil(totalCards / this.gridColumns);
        const cardSize = this.computeCardSize(rows);
        const gap = 12;
        const gridWidth = this.gridColumns * cardSize + (this.gridColumns - 1) * gap;
        const gridHeight = rows * cardSize + (rows - 1) * gap;
        const startX = (this.scale.width - gridWidth) / 2 + cardSize / 2;
        const startY = (this.scale.height - gridHeight) / 2 + cardSize / 2;

        // Create FlipCard instances
        for (let i = 0; i < cardEntries.length; i++) {
            const entry = cardEntries[i];
            const col = i % this.gridColumns;
            const row = Math.floor(i / this.gridColumns);
            const x = startX + col * (cardSize + gap);
            const y = startY + row * (cardSize + gap);

            const card = new FlipCard(this, {
                x,
                y,
                width: cardSize,
                height: cardSize,
                pairId: entry.pairId,
                imageKey: entry.imageKey,
                label: entry.label,
                theme: this.theme
            });
            card.animateIn(i * 50);
            this.cards.push(card);
        }

        // Card click handler
        for (const card of this.cards) {
            card.on('pointerdown', () => this.onCardClicked(card));
        }

        // Keyboard accessibility
        this.setupKeyboardAccessibility();

        // Feedback overlay
        this.feedbackOverlay = new FeedbackOverlay(this, {
            theme: this.theme
        });
        this.gameManager.on(GameManager.EVENTS.CONTROL_PAUSE, this.onPauseGame, this);
        this.gameManager.on(GameManager.EVENTS.CONTROL_RESUME, this.onResumeGame, this);
        this.events.once('shutdown', this.shutdown, this);

        // Bottom navbar
    }

    private async loadMemoryConfig(): Promise<HydratedPair[]> {
        const preview = getPreviewRuntimeSettings();
        const gameId = preview.gameId
            || ConfigLoader.getGameIdFromUrl()
            || 'animals-memory-01';

        const urlLang = preview.language
            || ConfigLoader.getLanguageFromUrl()
            || 'en';

        i18n.setLanguage(urlLang);

        const bundle = await ConfigLoader.getInstance().loadTemplateConfig({
            gameId,
            language: urlLang
        });
        const raw = bundle.config as unknown as RawMemoryConfig;
        const strings = bundle.strings as {
            meta?: any;
            instruction?: string;
            pairs?: Record<string, string>;
        };

        this.pointsPerPair = raw.meta.pointsPerPair ?? 10;
        this.flipBackDelay = raw.meta.flipBackDelay ?? 1500;
        this.gridColumns = raw.meta.gridColumns ?? 4;

        if (strings.instruction) {
            this.instructionText = strings.instruction;
        }

        // Hydrate pairs
        const pairStrings = strings.pairs ?? {};
        const pairs: HydratedPair[] = raw.pairs.map(p => ({
            id: p.id,
            imageKey: p.imageKey,
            label: pairStrings[p.labelKey] ?? p.labelKey
        }));

        this.gameManager.loadSyntheticActivityConfig({
            gameId: raw.meta.gameId,
            title: strings.meta?.title ?? raw.meta.gameId,
            totalSteps: pairs.length,
            maxScore: pairs.length * this.pointsPerPair,
            theme: this.gameManager.getTheme(),
            meta: { pointsPerPair: this.pointsPerPair }
        });

        return pairs;
    }

    private async onCardClicked(card: FlipCard): Promise<void> {
        if (this.isLocked || card.isLocked()) {
            return;
        }

        this.audioManager.playSfx('click');
        await card.flip();
        this.flippedCards.push(card);

        if (this.flippedCards.length === 2) {
            this.isLocked = true;
            this.attempts++;
            const [cardA, cardB] = this.flippedCards;

            if (cardA.getPairId() === cardB.getPairId()) {
                // Match!
                cardA.animateMatch();
                cardB.animateMatch();
                const stepIndex = this.matchedPairs;
                this.gameManager.completeStep(stepIndex, {
                    scoreDelta: this.pointsPerPair,
                    correct: true
                });
                this.matchedPairs++;
                if (this.matchedPairs < this.totalPairs) {
                    this.gameManager.startStep(this.matchedPairs);
                }
                this.a11yManager.announce(`Matched! ${cardA.label}.`);
                this.events.emit(MemoryLevel.EVENTS.CARDS_MATCHED, cardA.getPairId());

                this.flippedCards = [];
                this.isLocked = false;

                if (this.matchedPairs === this.totalPairs) {
                    this.onAllMatched();
                }
            } else {
                // No match — flip back after delay
                this.a11yManager.announce('No match. Try again.');
                this.events.emit(MemoryLevel.EVENTS.CARDS_MISMATCHED);
                this.showEncouragement(this.scale.width / 2, this.scale.height / 2);

                this.time.delayedCall(this.flipBackDelay, async () => {
                    await Promise.all([cardA.flipBack(), cardB.flipBack()]);
                    this.flippedCards = [];
                    this.isLocked = false;
                });
            }
        }
    }

    private onAllMatched(): void {
        this.events.emit(MemoryLevel.EVENTS.ALL_MATCHED);

        // Calculate star rating based on attempts
        const starRating = this.attempts <= this.totalPairs + 2
            ? 3
            : this.attempts <= this.totalPairs * 2
                ? 2
                : 1;

        this.feedbackOverlay.showCorrect().then(() => {
            this.gameManager.completeActivity({ starRating });
            this.scene.start('Results', this.gameManager.createResultsData({
                restartScene: 'MemoryLevel',
                starRating
            }));
        });
    }

    private setupKeyboardAccessibility(): void {
        this.cards.forEach((card, index) => {
            this.a11yManager.registerFocusable({
                id: `card-${index}`,
                element: card,
                label: card.getAccessibleLabel(),
                group: 'cards',
                onSelect: () => this.onCardClicked(card),
                onFocus: () => card.showFocus(),
                onBlur: () => card.hideFocus()
            });
        });

        this.a11yManager.setActiveGroup('cards');
    }

    private computeCardSize(rows: number): number {
        const maxW = (this.scale.width - 80) / this.gridColumns - 12;
        const maxH = (this.scale.height - 160) / rows - 12;
        return Math.min(120, maxW, maxH);
    }

    private shuffleArray<T>(array: T[]): void {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
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
        this.isLocked = true;
        this.cards
            .filter(card => !card.isMatched())
            .forEach(card => card.disableInteractive());
    }

    private onResumeGame(): void {
        this.isLocked = false;
        this.cards
            .filter(card => !card.isMatched())
            .forEach(card => card.setInteractive());
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
        this.a11yManager.clearGroup('cards');
    }
}
