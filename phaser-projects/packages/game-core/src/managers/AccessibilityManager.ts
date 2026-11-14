import Phaser from 'phaser';

export interface FocusableItem {
    id: string;
    element: Phaser.GameObjects.Container | Phaser.GameObjects.GameObject;
    label: string;
    group?: string;
    onSelect?: () => void;
    onFocus?: () => void;
    onBlur?: () => void;
}

export interface AccessibilityConfig {
    announceDelay?: number;
    focusIndicatorColor?: number;
    focusIndicatorWidth?: number;
    reducedMotion?: boolean;
}

/**
 * Options for creating an AccessibilityManager instance
 */
export interface AccessibilityManagerOptions {
    /** Storage key prefix for isolated localStorage (optional) */
    storagePrefix?: string;
    /** Whether to use shared global storage (default: true) */
    shared?: boolean;
}

const DEFAULT_STORAGE_KEY = 'edu-play-a11y-settings';

const DEFAULT_CONFIG: Required<AccessibilityConfig> = {
    announceDelay: 100,
    focusIndicatorColor: 0xFFFF00,
    focusIndicatorWidth: 4,
    reducedMotion: false
};

// Lazy getter to avoid circular dependency with GameContextProvider
// The provider is accessed through a getter function that resolves at runtime
function getContextProvider(): any {
    // Dynamic import at runtime to break circular dependency
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return (globalThis as any).__CONTEXT_PROVIDER__;
}

/**
 * AccessibilityManager - Centralized accessibility control
 * Handles keyboard navigation, screen reader announcements, and focus management
 * Following WCAG 2.1 guidelines
 *
 * Supports both context-based usage (recommended) and legacy singleton pattern.
 */
export default class AccessibilityManager {
    /** Legacy singleton instance for backward compatibility */
    private static legacyInstance: AccessibilityManager | null = null;

    private scene: Phaser.Scene | null = null;
    private storageKey: string;

    private config: Required<AccessibilityConfig>;
    private focusableItems: FocusableItem[] = [];
    private currentFocusIndex: number = -1;
    private currentGroup: string | null = null;

    // DOM elements for screen reader
    private liveRegion: HTMLElement | null = null;
    private statusRegion: HTMLElement | null = null;

    // Keyboard state
    private keyboardEnabled: boolean = true;


    /**
     * Create a new AccessibilityManager instance
     * @param options - Configuration options
     */
    constructor(options: AccessibilityManagerOptions = {}) {
        // Determine storage key
        if (options.shared !== false && !options.storagePrefix) {
            this.storageKey = DEFAULT_STORAGE_KEY;
        } else if (options.storagePrefix) {
            this.storageKey = `${options.storagePrefix}-a11y-settings`;
        } else {
            this.storageKey = DEFAULT_STORAGE_KEY;
        }

        this.config = this.loadSettings();
        this.createLiveRegions();
        this.checkReducedMotionPreference();
    }

    /**
     * Get singleton instance
     * @deprecated Use GameContextProvider.getActiveContext().accessibilityManager instead
     *
     * Returns the active context's AccessibilityManager if available,
     * otherwise falls back to legacy singleton for backward compatibility.
     */
    static getInstance(): AccessibilityManager {
        // Try to get from active context first (via window global set by index.ts)
        const provider = getContextProvider();
        if (provider) {
            const context = provider.getActiveContext();
            if (context) {
                return context.accessibilityManager;
            }
        }

        // Fallback to legacy singleton
        if (!AccessibilityManager.legacyInstance) {
            AccessibilityManager.legacyInstance = new AccessibilityManager({ shared: true });
        }
        return AccessibilityManager.legacyInstance;
    }

    /**
     * Initialize with a Phaser scene
     */
    init(scene: Phaser.Scene): void {
        this.scene = scene;
        this.setupKeyboardListeners();
        this.createFocusIndicator();
    }

    // ============================================
    // SCREEN READER SUPPORT (ARIA Live Regions)
    // ============================================

    /**
     * Create ARIA live regions for screen reader announcements
     */
    private createLiveRegions(): void {
        // Check if regions already exist
        if (document.getElementById('a11y-live-region')) {
            this.liveRegion = document.getElementById('a11y-live-region');
            this.statusRegion = document.getElementById('a11y-status-region');
            return;
        }

        // Polite announcements (for general updates)
        this.liveRegion = document.createElement('div');
        this.liveRegion.id = 'a11y-live-region';
        this.liveRegion.setAttribute('role', 'log');
        this.liveRegion.setAttribute('aria-live', 'polite');
        this.liveRegion.setAttribute('aria-atomic', 'true');
        this.liveRegion.style.cssText = `
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
        `;
        document.body.appendChild(this.liveRegion);

        // Assertive announcements (for important/urgent updates)
        this.statusRegion = document.createElement('div');
        this.statusRegion.id = 'a11y-status-region';
        this.statusRegion.setAttribute('role', 'status');
        this.statusRegion.setAttribute('aria-live', 'assertive');
        this.statusRegion.setAttribute('aria-atomic', 'true');
        this.statusRegion.style.cssText = this.liveRegion.style.cssText;
        document.body.appendChild(this.statusRegion);
    }

    /**
     * Announce message to screen readers (polite)
     */
    announce(message: string, delay: number = this.config.announceDelay): void {
        if (!this.liveRegion) return;

        setTimeout(() => {
            if (this.liveRegion) {
                // Clear and set to trigger announcement
                this.liveRegion.textContent = '';
                setTimeout(() => {
                    if (this.liveRegion) {
                        this.liveRegion.textContent = message;
                    }
                }, 50);
            }
        }, delay);
    }

    /**
     * Announce urgent message to screen readers (assertive)
     */
    announceUrgent(message: string): void {
        if (!this.statusRegion) return;

        this.statusRegion.textContent = '';
        setTimeout(() => {
            if (this.statusRegion) {
                this.statusRegion.textContent = message;
            }
        }, 50);
    }

    /**
     * Announce question to screen reader
     */
    announceQuestion(questionText: string, choiceCount: number): void {
        const message = `Question: ${questionText}. ${choiceCount} choices available. Use arrow keys to navigate, Enter or Space to select.`;
        this.announce(message, 500);
    }

    /**
     * Announce answer result
     */
    announceResult(isCorrect: boolean, correctAnswer?: string): void {
        if (isCorrect) {
            this.announceUrgent('Correct! Great job!');
        } else {
            const message = correctAnswer
                ? `Incorrect. The correct answer was ${correctAnswer}.`
                : 'Incorrect. Try again!';
            this.announceUrgent(message);
        }
    }

    /**
     * Announce game progress
     */
    announceProgress(current: number, total: number, score: number): void {
        this.announce(`Question ${current} of ${total}. Current score: ${score}.`);
    }

    /**
     * Announce game completion
     */
    announceGameComplete(score: number, total: number): void {
        const percentage = Math.round((score / total) * 100);
        this.announceUrgent(`Game complete! You scored ${score} out of ${total}, that's ${percentage} percent!`);
    }

    // ============================================
    // KEYBOARD NAVIGATION
    // ============================================

    private setupKeyboardListeners(): void {
        if (!this.scene) return;

        // Use Phaser's keyboard input
        this.scene.input.keyboard?.on('keydown', this.handleKeyDown, this);
    }

    private handleKeyDown(event: KeyboardEvent): void {
        if (!this.keyboardEnabled || this.focusableItems.length === 0) return;

        const filteredItems = this.getFilteredItems();
        if (filteredItems.length === 0) return;

        switch (event.key) {
            case 'ArrowRight':
            case 'ArrowDown':
                event.preventDefault();
                this.focusNext();
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
                event.preventDefault();
                this.focusPrevious();
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                this.selectCurrent();
                break;
            case 'Home':
                event.preventDefault();
                this.focusFirst();
                break;
            case 'End':
                event.preventDefault();
                this.focusLast();
                break;
            case 'Tab':
                event.preventDefault();
                if (event.shiftKey) {
                    this.focusPrevious();
                } else {
                    this.focusNext();
                }
                break;
            case 'Escape':
                this.clearFocus();
                break;
        }
    }

    private getFilteredItems(): FocusableItem[] {
        if (this.currentGroup) {
            return this.focusableItems.filter(item => item.group === this.currentGroup);
        }
        return this.focusableItems;
    }

    /**
     * Focus next item
     */
    focusNext(): void {
        const items = this.getFilteredItems();
        if (items.length === 0) return;

        // If no item is focused yet, start with the first item
        if (this.currentFocusIndex === -1) {
            this.currentFocusIndex = this.focusableItems.indexOf(items[0]);
            this.updateFocus();
            return;
        }

        // Find current index in filtered items
        const currentItem = this.focusableItems[this.currentFocusIndex];
        let filteredIndex = currentItem ? items.indexOf(currentItem) : -1;

        filteredIndex = (filteredIndex + 1) % items.length;
        const newItem = items[filteredIndex];
        this.currentFocusIndex = this.focusableItems.indexOf(newItem);

        this.updateFocus();
    }

    /**
     * Focus previous item
     */
    focusPrevious(): void {
        const items = this.getFilteredItems();
        if (items.length === 0) return;

        // If no item is focused yet, start with the last item
        if (this.currentFocusIndex === -1) {
            this.currentFocusIndex = this.focusableItems.indexOf(items[items.length - 1]);
            this.updateFocus();
            return;
        }

        const currentItem = this.focusableItems[this.currentFocusIndex];
        let filteredIndex = currentItem ? items.indexOf(currentItem) : 0;

        filteredIndex = filteredIndex <= 0 ? items.length - 1 : filteredIndex - 1;
        const newItem = items[filteredIndex];
        this.currentFocusIndex = this.focusableItems.indexOf(newItem);

        this.updateFocus();
    }

    /**
     * Focus first item
     */
    focusFirst(): void {
        const items = this.getFilteredItems();
        if (items.length === 0) return;

        this.currentFocusIndex = this.focusableItems.indexOf(items[0]);
        this.updateFocus();
    }

    /**
     * Focus last item
     */
    focusLast(): void {
        const items = this.getFilteredItems();
        if (items.length === 0) return;

        this.currentFocusIndex = this.focusableItems.indexOf(items[items.length - 1]);
        this.updateFocus();
    }

    /**
     * Focus next group
     */
    private focusNextGroup(): void {
        const groups = [...new Set(this.focusableItems.map(i => i.group).filter(Boolean))];
        if (groups.length === 0) return;

        const currentGroupIndex = this.currentGroup ? groups.indexOf(this.currentGroup) : -1;
        const nextGroupIndex = (currentGroupIndex + 1) % groups.length;
        this.currentGroup = groups[nextGroupIndex] || null;
        this.focusFirst();
    }

    /**
     * Focus previous group
     */
    private focusPreviousGroup(): void {
        const groups = [...new Set(this.focusableItems.map(i => i.group).filter(Boolean))];
        if (groups.length === 0) return;

        const currentGroupIndex = this.currentGroup ? groups.indexOf(this.currentGroup) : 0;
        const prevGroupIndex = currentGroupIndex <= 0 ? groups.length - 1 : currentGroupIndex - 1;
        this.currentGroup = groups[prevGroupIndex] || null;
        this.focusFirst();
    }

    /**
     * Select currently focused item
     */
    selectCurrent(): void {
        const item = this.focusableItems[this.currentFocusIndex];
        if (item?.onSelect) {
            item.onSelect();
        }
    }

    /**
     * Update focus indicator and callbacks
     */
    private updateFocus(): void {
        const item = this.focusableItems[this.currentFocusIndex];
        if (!item) return;

        // Call blur on all other items
        this.focusableItems.forEach((i, index) => {
            if (index !== this.currentFocusIndex && i.onBlur) {
                i.onBlur();
            }
        });

        // Call focus on current item
        if (item.onFocus) {
            item.onFocus();
        }

        // Update visual focus indicator
        this.updateFocusIndicator(item);

        // Announce to screen reader
        this.announce(item.label);
    }

    /**
     * Clear focus
     */
    clearFocus(): void {
        const item = this.focusableItems[this.currentFocusIndex];
        if (item?.onBlur) {
            item.onBlur();
        }
        this.currentFocusIndex = -1;
        this.hideFocusIndicator();
    }

    // ============================================
    // FOCUS INDICATOR
    // ============================================

    private createFocusIndicator(): void {
        // Visual focus is handled by each focusable item's own onFocus/onBlur callbacks
        // (e.g. ChoiceCard.showFocus uses gold shadow + scale, matching hover visuals)
    }

    private updateFocusIndicator(_item: FocusableItem): void {
        // No-op — items render their own focus state
    }

    private hideFocusIndicator(): void {
        // No-op
    }

    // ============================================
    // FOCUSABLE ITEM MANAGEMENT
    // ============================================

    /**
     * Register a focusable item
     */
    registerFocusable(item: FocusableItem): void {
        // Remove existing item with same ID
        this.unregisterFocusable(item.id);
        this.focusableItems.push(item);
    }

    /**
     * Register multiple focusable items
     */
    registerFocusables(items: FocusableItem[]): void {
        items.forEach(item => this.registerFocusable(item));
    }

    /**
     * Unregister a focusable item
     */
    unregisterFocusable(id: string): void {
        const index = this.focusableItems.findIndex(item => item.id === id);
        if (index !== -1) {
            if (this.currentFocusIndex === index) {
                this.clearFocus();
            } else if (this.currentFocusIndex > index) {
                this.currentFocusIndex--;
            }
            this.focusableItems.splice(index, 1);
        }
    }

    /**
     * Clear all focusable items
     */
    clearFocusables(): void {
        this.focusableItems = [];
        this.currentFocusIndex = -1;
        this.hideFocusIndicator();
    }

    /**
     * Clear focusable items in a group
     */
    clearGroup(group: string): void {
        this.focusableItems = this.focusableItems.filter(item => item.group !== group);
        if (this.currentGroup === group) {
            this.currentFocusIndex = -1;
            this.hideFocusIndicator();
        }
    }

    /**
     * Set active group for navigation
     * Does not automatically focus - focus will appear on first keyboard interaction
     */
    setActiveGroup(group: string | null): void {
        this.currentGroup = group;
        // Reset focus index so the first keyboard gesture will focus the first item
        this.currentFocusIndex = -1;
        this.hideFocusIndicator();
    }

    // ============================================
    // SETTINGS
    // ============================================

    /**
     * Check system preference for reduced motion
     */
    private checkReducedMotionPreference(): void {
        if (typeof window !== 'undefined' && window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
            this.config.reducedMotion = mediaQuery.matches;

            mediaQuery.addEventListener('change', (e) => {
                this.config.reducedMotion = e.matches;
                this.saveSettings();
            });
        }
    }

    setReducedMotion(enabled: boolean): void {
        this.config.reducedMotion = enabled;
        this.saveSettings();
    }

    isReducedMotion(): boolean {
        return this.config.reducedMotion;
    }

    setKeyboardEnabled(enabled: boolean): void {
        this.keyboardEnabled = enabled;
        if (!enabled) {
            this.clearFocus();
        }
    }

    isKeyboardEnabled(): boolean {
        return this.keyboardEnabled;
    }

    // ============================================
    // PERSISTENCE
    // ============================================

    private saveSettings(): void {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify({
                reducedMotion: this.config.reducedMotion
            }));
        } catch (error) {
            console.warn('AccessibilityManager: Could not save settings', error);
        }
    }

    private loadSettings(): Required<AccessibilityConfig> {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.warn('AccessibilityManager: Could not load settings', error);
        }
        return DEFAULT_CONFIG;
    }

    // ============================================
    // CLEANUP
    // ============================================

    cleanup(): void {
        this.clearFocusables();
        if (this.scene?.input.keyboard) {
            this.scene.input.keyboard.off('keydown', this.handleKeyDown, this);
        }
        this.scene = null;
    }
}
