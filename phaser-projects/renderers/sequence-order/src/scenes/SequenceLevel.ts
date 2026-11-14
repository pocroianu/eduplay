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
import OrderableItem from '../prefabs/OrderableItem';
import SlotIndicator from '../prefabs/SlotIndicator';

interface RawItem {
    id: string;
    imageKey?: string;
    labelKey: string;
    position: number;
}

interface RawSequenceConfig {
    meta: {
        gameId: string;
        version?: string;
        gameType?: string;
        themeName?: string;
        pointsPerItem?: number;
        shuffleItems?: boolean;
        supportedLanguages?: string[];
    };
    items: RawItem[];
}

interface HydratedItem {
    id: string;
    imageKey?: string;
    label: string;
    position: number;
}

export default class SequenceLevel extends Phaser.Scene {
    static readonly EVENTS = {
        ITEMS_SWAPPED: 'items-swapped',
        SEQUENCE_CORRECT: 'sequence-correct'
    } as const;

    private gameManager!: GameManager;
    private audioManager!: AudioManager;
    private a11yManager!: AccessibilityManager;
    private theme!: ThemeConfig;

    private orderableItems: OrderableItem[] = [];
    private slotIndicator!: SlotIndicator;
    private totalItems = 0;
    private pointsPerItem = 10;

    private feedbackOverlay!: FeedbackOverlay;

    // Slot layout
    private slotXPositions: number[] = [];
    private slotY = 0;

    // Keyboard drag state
    private keyboardHeldItem: OrderableItem | null = null;
    private instructionText = 'Put the items in order!';

    constructor() {
        super('SequenceLevel');
    }

    async create(): Promise<void> {
        this.gameManager = GameManager.getInstance();
        this.audioManager = AudioManager.getInstance();
        this.a11yManager = AccessibilityManager.getInstance();

        let items: HydratedItem[] = [];

        try {
            items = await this.loadSequenceConfig();
        } catch (err) {
            console.error('[SequenceLevel] Failed to load config:', err);
            this.showError(String(err));
            return;
        }

        if (!items.length) {
            console.error('[SequenceLevel] No items in config');
            this.showError('No items found in config');
            return;
        }

        const themeOverride = getPreviewRuntimeSettings().theme;
        if (themeOverride) {
            this.gameManager.setThemeName(themeOverride);
        }
        this.theme = this.gameManager.getTheme();
        this.totalItems = items.length;
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

        // Compute slot layout
        this.computeSlotLayout(items.length);

        // Create slot indicators
        this.slotIndicator = new SlotIndicator(this, {
            x: this.scale.width / 2,
            y: this.slotY + 75,
            totalSlots: items.length,
            slotWidth: this.getItemSize(),
            slotGap: this.getItemGap(),
            theme: this.theme
        });

        // Shuffle items for display
        const shuffled = [...items].sort(() => Math.random() - 0.5);

        // Create orderable items at shuffled slot positions
        for (let i = 0; i < shuffled.length; i++) {
            const item = shuffled[i];
            const x = this.slotXPositions[i];

            const orderable = new OrderableItem(this, {
                x,
                y: this.slotY,
                width: this.getItemSize(),
                height: this.getItemSize(),
                itemId: item.id,
                position: item.position,
                imageKey: item.imageKey,
                label: item.label,
                theme: this.theme
            });
            orderable.slotIndex = i;
            orderable.animateIn(i * 80);
            this.orderableItems.push(orderable);
        }

        // Setup drag events
        this.setupDragEvents();

        // Setup keyboard accessibility
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

    private async loadSequenceConfig(): Promise<HydratedItem[]> {
        const preview = getPreviewRuntimeSettings();
        const gameId = preview.gameId
            || ConfigLoader.getGameIdFromUrl()
            || 'numbers-1-to-6';

        const urlLang = preview.language
            || ConfigLoader.getLanguageFromUrl()
            || 'en';

        i18n.setLanguage(urlLang);

        const bundle = await ConfigLoader.getInstance().loadTemplateConfig({
            gameId,
            language: urlLang
        });
        const raw = bundle.config as unknown as RawSequenceConfig;
        const strings = bundle.strings as {
            meta?: any;
            instruction?: string;
            items?: Record<string, string>;
        };

        this.pointsPerItem = raw.meta.pointsPerItem ?? 10;

        if (strings.instruction) {
            this.instructionText = strings.instruction;
        }

        // Hydrate items
        const itemStrings = strings.items ?? {};
        const items: HydratedItem[] = raw.items.map(i => ({
            id: i.id,
            imageKey: i.imageKey,
            label: itemStrings[i.labelKey] ?? i.labelKey,
            position: i.position
        }));

        this.gameManager.loadSyntheticActivityConfig({
            gameId: raw.meta.gameId,
            title: strings.meta?.title ?? raw.meta.gameId,
            totalSteps: items.length,
            maxScore: items.length * this.pointsPerItem,
            theme: this.gameManager.getTheme(),
            meta: { pointsPerItem: this.pointsPerItem }
        });

        return items;
    }

    private getItemSize(): number {
        return Math.min(110, (this.scale.width - 80) / this.totalItems - 12);
    }

    private getItemGap(): number {
        return 12;
    }

    private computeSlotLayout(count: number): void {
        const itemSize = this.getItemSize();
        const gap = this.getItemGap();
        const totalWidth = count * itemSize + (count - 1) * gap;
        const startX = (this.scale.width - totalWidth) / 2 + itemSize / 2;
        this.slotY = this.scale.height / 2 - 20;

        this.slotXPositions = [];
        for (let i = 0; i < count; i++) {
            this.slotXPositions.push(startX + i * (itemSize + gap));
        }
    }

    private setupDragEvents(): void {
        this.input.on('dragstart', (pointer: Phaser.Input.Pointer, gameObject: OrderableItem) => {
            if (!(gameObject instanceof OrderableItem)) return;
            gameObject.setItemState('dragging');
            gameObject.setDepth(100);
            this.input.setDefaultCursor('grabbing');
            this.audioManager.playSfx('click');
        });

        this.input.on('drag', (pointer: Phaser.Input.Pointer, gameObject: OrderableItem, dragX: number, dragY: number) => {
            if (!(gameObject instanceof OrderableItem)) return;
            gameObject.x = dragX;
            gameObject.y = dragY;
        });

        this.input.on('dragend', (pointer: Phaser.Input.Pointer, gameObject: OrderableItem) => {
            if (!(gameObject instanceof OrderableItem)) return;
            this.input.setDefaultCursor('default');
            gameObject.setDepth(0);

            // Find closest slot to drop position
            const targetSlot = this.findClosestSlot(gameObject.x);

            if (targetSlot !== gameObject.slotIndex) {
                this.swapItems(gameObject.slotIndex, targetSlot);
            } else {
                gameObject.animateSnapBack();
            }
        });
    }

    private findClosestSlot(x: number): number {
        let closest = 0;
        let minDist = Infinity;

        for (let i = 0; i < this.slotXPositions.length; i++) {
            const dist = Math.abs(x - this.slotXPositions[i]);
            if (dist < minDist) {
                minDist = dist;
                closest = i;
            }
        }

        return closest;
    }

    private swapItems(slotA: number, slotB: number): void {
        const itemA = this.orderableItems.find(item => item.slotIndex === slotA)!;
        const itemB = this.orderableItems.find(item => item.slotIndex === slotB)!;

        // Swap slot indices
        itemA.slotIndex = slotB;
        itemB.slotIndex = slotA;

        // Animate to new positions
        itemA.animateToSlot(this.slotXPositions[slotB]);
        itemB.animateToSlot(this.slotXPositions[slotA]);

        this.audioManager.playSfx('click');

        this.events.emit(SequenceLevel.EVENTS.ITEMS_SWAPPED, {
            itemA: itemA.itemId,
            itemB: itemB.itemId
        });

        // Update accessibility labels
        this.refreshAccessibilityLabels();

        // Show progressive hints for correctly-placed items
        this.time.delayedCall(300, () => {
            this.orderableItems.forEach(item => {
                if (item.getItemState() !== 'locked') {
                    if (item.isInCorrectSlot()) {
                        item.showCorrectHint();
                    } else {
                        item.clearCorrectHint();
                    }
                }
            });
        });

        // Auto-check if sequence is correct
        this.checkSequence();
    }

    private checkSequence(): void {
        const allCorrect = this.orderableItems.every(item => item.isInCorrectSlot());

        if (allCorrect) {
            this.onSequenceCorrect();
        }
    }

    private onSequenceCorrect(): void {
        this.events.emit(SequenceLevel.EVENTS.SEQUENCE_CORRECT);

        // Lock all items
        this.orderableItems.forEach(item => {
            item.setItemState('locked');
            item.animateLocked();
        });

        // The sequence is only accepted when every learner-facing item is in
        // the correct slot, so complete all item steps together at lock-in.
        for (let stepIndex = 0; stepIndex < this.totalItems; stepIndex++) {
            this.gameManager.completeStep(stepIndex, {
                scoreDelta: this.pointsPerItem,
                correct: true
            });
        }

        this.feedbackOverlay.showCorrect().then(() => {
            this.gameManager.completeActivity();
            this.scene.start('Results', this.gameManager.createResultsData({
                restartScene: 'SequenceLevel'
            }));
        });
    }

    private setupKeyboardAccessibility(): void {
        this.orderableItems.forEach((item) => {
            this.a11yManager.registerFocusable({
                id: `item-${item.itemId}`,
                element: item,
                label: item.getAccessibleLabel(),
                group: 'items',
                onSelect: () => this.onKeyboardSelect(item),
                onFocus: () => item.showFocus(),
                onBlur: () => item.hideFocus()
            });
        });

        this.a11yManager.setActiveGroup('items');

        // Escape key cancels keyboard hold
        this.input.keyboard?.on('keydown-ESC', () => {
            if (this.keyboardHeldItem) {
                this.keyboardHeldItem.setItemState('idle');
                this.a11yManager.announce('Cancelled. Use arrow keys to navigate.');
                this.keyboardHeldItem = null;
            }
        });

        // Arrow keys move held item
        this.input.keyboard?.on('keydown-LEFT', () => {
            if (this.keyboardHeldItem && this.keyboardHeldItem.slotIndex > 0) {
                this.swapItems(this.keyboardHeldItem.slotIndex, this.keyboardHeldItem.slotIndex - 1);
                this.a11yManager.announce(
                    `${this.keyboardHeldItem.label} moved to position ${this.keyboardHeldItem.slotIndex + 1}`
                );
            }
        });

        this.input.keyboard?.on('keydown-RIGHT', () => {
            if (this.keyboardHeldItem && this.keyboardHeldItem.slotIndex < this.totalItems - 1) {
                this.swapItems(this.keyboardHeldItem.slotIndex, this.keyboardHeldItem.slotIndex + 1);
                this.a11yManager.announce(
                    `${this.keyboardHeldItem.label} moved to position ${this.keyboardHeldItem.slotIndex + 1}`
                );
            }
        });
    }

    private onKeyboardSelect(item: OrderableItem): void {
        if (item.getItemState() === 'locked') return;

        if (this.keyboardHeldItem === null) {
            // Pick up
            this.keyboardHeldItem = item;
            item.selectViaKeyboard();
            this.a11yManager.announce(
                `Picked up ${item.label}. Use Left/Right arrows to move, Enter to drop, Escape to cancel.`
            );
        } else if (this.keyboardHeldItem === item) {
            // Drop (confirm position)
            item.setItemState('idle');
            this.a11yManager.announce(`${item.label} placed at position ${item.slotIndex + 1}.`);
            this.keyboardHeldItem = null;
        } else {
            // Swap with held item
            const heldSlot = this.keyboardHeldItem.slotIndex;
            const targetSlot = item.slotIndex;
            this.keyboardHeldItem.setItemState('idle');
            this.keyboardHeldItem = null;
            this.swapItems(heldSlot, targetSlot);
        }
    }

    private refreshAccessibilityLabels(): void {
        this.orderableItems.forEach(item => {
            this.a11yManager.registerFocusable({
                id: `item-${item.itemId}`,
                element: item,
                label: item.getAccessibleLabel(),
                group: 'items',
                onSelect: () => this.onKeyboardSelect(item),
                onFocus: () => item.showFocus(),
                onBlur: () => item.hideFocus()
            });
        });
    }

    private onPauseGame(): void {
        this.orderableItems
            .filter(item => item.getItemState() !== 'locked')
            .forEach(item => item.disableInteractive());
    }

    private onResumeGame(): void {
        this.orderableItems
            .filter(item => item.getItemState() === 'idle')
            .forEach(item => item.setInteractive({ draggable: true }));
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
        this.a11yManager.clearGroup('items');
    }
}
