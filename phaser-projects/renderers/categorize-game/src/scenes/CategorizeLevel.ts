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
import DraggableItem from '../prefabs/DraggableItem';
import DropZone from '../prefabs/DropZone';

interface RawCategory {
    id: string;
    labelKey: string;
    imageKey?: string;
    color: string;
}

interface RawItem {
    id: string;
    imageKey: string;
    labelKey: string;
    categoryId: string;
}

interface RawCategorizeConfig {
    meta: {
        gameId: string;
        version?: string;
        gameType?: string;
        themeName?: string;
        pointsPerItem?: number;
        shuffleItems?: boolean;
        supportedLanguages?: string[];
    };
    categories: RawCategory[];
    items: RawItem[];
}

interface HydratedCategory {
    id: string;
    label: string;
    imageKey?: string;
    color: string;
}

interface HydratedItem {
    id: string;
    imageKey: string;
    label: string;
    categoryId: string;
}

export default class CategorizeLevel extends Phaser.Scene {
    static readonly EVENTS = {
        ITEM_PLACED:     'item-placed',
        ITEM_WRONG:      'item-wrong',
        ALL_ITEMS_PLACED: 'all-items-placed'
    } as const;

    private gameManager!: GameManager;
    private audioManager!: AudioManager;
    private a11yManager!: AccessibilityManager;
    private theme!: ThemeConfig;

    private draggableItems: DraggableItem[] = [];
    private dropZones: DropZone[] = [];
    private placedCount = 0;
    private totalItems = 0;
    private pointsPerItem = 10;

    private feedbackOverlay!: FeedbackOverlay;

    // Keyboard drag state
    private keyboardHeldItem: DraggableItem | null = null;
    private focusedZoneIndex = -1;
    private instructionText = 'Sort the items!';

    constructor() {
        super('CategorizeLevel');
    }

    async create(): Promise<void> {
        this.gameManager = GameManager.getInstance();
        this.audioManager = AudioManager.getInstance();
        this.a11yManager = AccessibilityManager.getInstance();

        let categories: HydratedCategory[] = [];
        let items: HydratedItem[] = [];

        try {
            const result = await this.loadCategorizeConfig();
            categories = result.categories;
            items = result.items;
        } catch (err) {
            console.error('[CategorizeLevel] Failed to load config:', err);
            this.showError(String(err));
            return;
        }

        if (!categories.length || !items.length) {
            console.error('[CategorizeLevel] No categories or items in config');
            this.showError('No categories or items found in config');
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
        const instruction = this.instructionText;
        this.add.text(this.scale.width / 2, 40, instruction, {
            fontSize: '32px',
            color: '#ffffff',
            fontFamily: GAME_FONT,
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);

        // Create drop zones
        this.layoutDropZones(categories);

        // Create draggable items
        this.layoutDraggableItems(items);

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

    private async loadCategorizeConfig(): Promise<{
        categories: HydratedCategory[];
        items: HydratedItem[];
    }> {
        const preview = getPreviewRuntimeSettings();
        const gameId = preview.gameId
            || ConfigLoader.getGameIdFromUrl()
            || 'animals-habitat-01';

        const urlLang = preview.language
            || ConfigLoader.getLanguageFromUrl()
            || 'en';

        i18n.setLanguage(urlLang);

        const bundle = await ConfigLoader.getInstance().loadTemplateConfig({
            gameId,
            language: urlLang
        });
        const raw = bundle.config as unknown as RawCategorizeConfig;
        const strings = bundle.strings as {
            meta?: any;
            instruction?: string;
            categories?: Record<string, string>;
            items?: Record<string, string>;
        };

        this.pointsPerItem = raw.meta.pointsPerItem ?? 10;

        // Store instruction text for display
        if (strings.instruction) {
            this.instructionText = strings.instruction;
        }

        // Hydrate categories
        const catStrings = strings.categories ?? {};
        const categories: HydratedCategory[] = raw.categories.map(c => ({
            id: c.id,
            label: catStrings[c.labelKey] ?? c.labelKey,
            imageKey: c.imageKey,
            color: c.color
        }));

        // Hydrate items
        const itemStrings = strings.items ?? {};
        let items: HydratedItem[] = raw.items.map(i => ({
            id: i.id,
            imageKey: i.imageKey,
            label: itemStrings[i.labelKey] ?? i.labelKey,
            categoryId: i.categoryId
        }));

        // Shuffle items if configured
        if (raw.meta.shuffleItems !== false) {
            items = items.sort(() => Math.random() - 0.5);
        }

        this.gameManager.loadSyntheticActivityConfig({
            gameId: raw.meta.gameId,
            title: strings.meta?.title ?? raw.meta.gameId,
            totalSteps: items.length,
            maxScore: items.length * this.pointsPerItem,
            theme: this.gameManager.getTheme(),
            meta: { pointsPerItem: this.pointsPerItem }
        });

        return { categories, items };
    }

    private layoutDropZones(categories: HydratedCategory[]): void {
        const gameWidth = this.scale.width;
        const n = categories.length;

        const zoneWidth = Math.min(320, (gameWidth - 80) / n - 20);
        const zoneHeight = 220;
        const totalWidth = n * zoneWidth + (n - 1) * 30;
        const startX = (gameWidth - totalWidth) / 2 + zoneWidth / 2;
        const zoneY = 200;

        for (let i = 0; i < n; i++) {
            const cat = categories[i];
            const x = startX + i * (zoneWidth + 30);

            const zone = new DropZone(this, {
                x,
                y: zoneY,
                width: zoneWidth,
                height: zoneHeight,
                categoryId: cat.id,
                label: cat.label,
                color: cat.color,
                theme: this.theme
            });
            this.dropZones.push(zone);
        }
    }

    private layoutDraggableItems(items: HydratedItem[]): void {
        const gameWidth = this.scale.width;
        const n = items.length;

        const itemSize = Math.min(110, (gameWidth - 80) / n - 10);
        const totalWidth = n * itemSize + (n - 1) * 12;
        const startX = (gameWidth - totalWidth) / 2 + itemSize / 2;
        const itemY = this.scale.height - 140;

        for (let i = 0; i < n; i++) {
            const item = items[i];
            const x = startX + i * (itemSize + 12);

            const draggable = new DraggableItem(this, {
                x,
                y: itemY,
                width: itemSize,
                height: itemSize,
                itemId: item.id,
                categoryId: item.categoryId,
                imageKey: item.imageKey,
                label: item.label,
                theme: this.theme
            });
            draggable.animateIn(i * 80);
            this.draggableItems.push(draggable);
        }
    }

    private setupDragEvents(): void {
        this.input.on('dragstart', (pointer: Phaser.Input.Pointer, gameObject: DraggableItem) => {
            if (!(gameObject instanceof DraggableItem)) return;
            gameObject.setItemState('dragging');
            gameObject.setDepth(100);
            this.input.setDefaultCursor('grabbing');
            this.audioManager.playSfx('click');
        });

        this.input.on('drag', (pointer: Phaser.Input.Pointer, gameObject: DraggableItem, dragX: number, dragY: number) => {
            if (!(gameObject instanceof DraggableItem)) return;
            gameObject.x = dragX;
            gameObject.y = dragY;
        });

        this.input.on('dragenter', (pointer: Phaser.Input.Pointer, gameObject: DraggableItem, dropZone: Phaser.GameObjects.Zone) => {
            const zone = dropZone.getData('dropZone') as DropZone;
            if (zone) zone.highlight();
        });

        this.input.on('dragleave', (pointer: Phaser.Input.Pointer, gameObject: DraggableItem, dropZone: Phaser.GameObjects.Zone) => {
            const zone = dropZone.getData('dropZone') as DropZone;
            if (zone) zone.unhighlight();
        });

        this.input.on('drop', (pointer: Phaser.Input.Pointer, gameObject: DraggableItem, dropZone: Phaser.GameObjects.Zone) => {
            if (!(gameObject instanceof DraggableItem)) return;

            const zone = dropZone.getData('dropZone') as DropZone;
            if (!zone) {
                gameObject.animateSnapBack();
                return;
            }
            zone.unhighlight();

            const targetCategoryId = dropZone.getData('categoryId') as string;
            const isCorrect = gameObject.categoryId === targetCategoryId;

            if (isCorrect) {
                this.onCorrectDrop(gameObject, zone);
            } else {
                this.onIncorrectDrop(gameObject);
            }
        });

        this.input.on('dragend', (pointer: Phaser.Input.Pointer, gameObject: DraggableItem, dropped: boolean) => {
            if (!(gameObject instanceof DraggableItem)) return;
            this.input.setDefaultCursor('default');
            if (!dropped && gameObject.getItemState() !== 'placed') {
                gameObject.animateSnapBack();
            }
        });
    }

    private onCorrectDrop(item: DraggableItem, zone: DropZone): void {
        const pos = zone.addPlacedItem(item);
        item.animatePlaced(pos.x, pos.y);
        this.audioManager.playSfx('correct');
        const stepIndex = this.placedCount;
        this.gameManager.completeStep(stepIndex, {
            scoreDelta: this.pointsPerItem,
            correct: true
        });
        this.placedCount++;
        if (this.placedCount < this.totalItems) {
            this.gameManager.startStep(this.placedCount);
        }

        this.events.emit(CategorizeLevel.EVENTS.ITEM_PLACED, {
            itemId: item.itemId,
            categoryId: zone.categoryId
        });

        if (this.placedCount === this.totalItems) {
            this.onAllItemsPlaced();
        }
    }

    private onIncorrectDrop(item: DraggableItem): void {
        item.animateSnapBack();
        this.audioManager.playSfx('incorrect');
        this.showEncouragement(item.x, item.y);

        this.events.emit(CategorizeLevel.EVENTS.ITEM_WRONG, {
            itemId: item.itemId
        });
    }

    private setupKeyboardAccessibility(): void {
        // Register items as focusable
        this.draggableItems.forEach((item, index) => {
            this.a11yManager.registerFocusable({
                id: `item-${item.itemId}`,
                element: item,
                label: item.getAccessibleLabel(),
                group: 'items',
                onSelect: () => this.onKeyboardPickUp(item),
                onFocus: () => item.showFocus(),
                onBlur: () => item.hideFocus()
            });
        });

        // Register zones as focusable
        this.dropZones.forEach((zone, index) => {
            this.a11yManager.registerFocusable({
                id: `zone-${zone.categoryId}`,
                element: zone,
                label: zone.getAccessibleLabel(),
                group: 'zones',
                onSelect: () => this.onKeyboardDrop(zone),
                onFocus: () => zone.showFocus(),
                onBlur: () => zone.hideFocus()
            });
        });

        // Start with items group active
        this.a11yManager.setActiveGroup('items');

        // Escape key cancels keyboard hold
        this.input.keyboard?.on('keydown-ESC', () => {
            if (this.keyboardHeldItem) {
                this.keyboardHeldItem.setItemState('idle');
                this.keyboardHeldItem = null;
                this.a11yManager.setActiveGroup('items');
            }
        });
    }

    private onKeyboardPickUp(item: DraggableItem): void {
        if (item.getItemState() === 'placed') return;

        this.keyboardHeldItem = item;
        item.selectViaKeyboard();
        this.a11yManager.setActiveGroup('zones');
        this.a11yManager.announce(
            `Picked up ${item.getAccessibleLabel()}. Use arrow keys to choose a category, then press Enter to drop.`
        );
    }

    private onKeyboardDrop(zone: DropZone): void {
        if (!this.keyboardHeldItem) return;

        const item = this.keyboardHeldItem;
        this.keyboardHeldItem = null;

        const isCorrect = item.categoryId === zone.categoryId;

        if (isCorrect) {
            this.onCorrectDrop(item, zone);
            this.a11yManager.announceUrgent(
                `${item.getAccessibleLabel()} placed in ${zone.zoneLabel}. Correct!`
            );
        } else {
            this.onIncorrectDrop(item);
            this.a11yManager.announce(
                `${item.getAccessibleLabel()} returned. Try another category.`
            );
        }

        this.a11yManager.setActiveGroup('items');
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
        this.draggableItems
            .filter(item => item.getItemState() !== 'placed')
            .forEach(item => item.disableInteractive());
    }

    private onResumeGame(): void {
        this.draggableItems
            .filter(item => item.getItemState() === 'idle')
            .forEach(item => item.setInteractive({ draggable: true }));
    }

    private onAllItemsPlaced(): void {
        this.events.emit(CategorizeLevel.EVENTS.ALL_ITEMS_PLACED);

        this.feedbackOverlay.showCorrect().then(() => {
            this.gameManager.completeActivity();
            this.scene.start('Results', this.gameManager.createResultsData({
                restartScene: 'CategorizeLevel'
            }));
        });
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
        this.a11yManager.clearGroup('zones');
    }
}
