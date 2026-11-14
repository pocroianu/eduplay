/**
 * GameContextProvider - Factory and registry for GameContext instances
 *
 * This singleton manages the lifecycle of GameContext instances, enabling:
 * - Creation of isolated game contexts
 * - Switching between active contexts
 * - Automatic cleanup of destroyed contexts
 * - Backward compatibility with legacy singleton pattern via window globals
 */

import {
	GameContext,
	GameContextId,
	GameContextOptions,
	GameContextData
} from './GameContext';
import GameManager from '../managers/GameManager';
import AudioManager from '../managers/AudioManager';
import AccessibilityManager from '../managers/AccessibilityManager';
import ConfigLoader from '../services/ConfigLoader';

/**
 * GameContextProvider manages GameContext instances
 *
 * Usage:
 * ```typescript
 * const provider = GameContextProvider.getInstance();
 * const context = provider.createContext({ id: 'game-1' });
 * provider.setActiveContext('game-1');
 *
 * // Access managers via context
 * context.gameManager.loadConfig(config);
 * ```
 */
export default class GameContextProvider {
	private static instance: GameContextProvider;

	/** Map of context ID to context data */
	private contexts: Map<GameContextId, GameContextData> = new Map();

	/** Currently active context ID */
	private activeContextId: GameContextId | null = null;

	/** Counter for auto-generating context IDs */
	private contextCounter = 0;

	private constructor() {
		// Private constructor for singleton
	}

	/**
	 * Get the singleton instance
	 */
	static getInstance(): GameContextProvider {
		if (!GameContextProvider.instance) {
			GameContextProvider.instance = new GameContextProvider();
		}
		return GameContextProvider.instance;
	}

	/**
	 * Create a new GameContext with isolated managers
	 */
	createContext(options: GameContextOptions = {}): GameContext {
		const id = options.id ?? `context-${++this.contextCounter}`;

		if (this.contexts.has(id)) {
			throw new Error(`GameContext with id "${id}" already exists`);
		}

		// Create isolated manager instances
		const gameManager = new GameManager();
		const audioManager = new AudioManager({
			storagePrefix: options.audio?.storagePrefix,
			shared: options.audio?.shared ?? true
		});
		const accessibilityManager = new AccessibilityManager({
			storagePrefix: options.accessibility?.storagePrefix,
			shared: options.accessibility?.shared ?? true
		});
		const configLoader = new ConfigLoader();

		const context: GameContext = {
			id,
			gameManager,
			audioManager,
			accessibilityManager,
			configLoader,
			createdAt: Date.now(),
			isDestroyed: false
		};

		this.contexts.set(id, {
			context,
			boundScenes: new Set()
		});

		return context;
	}

	/**
	 * Get a context by ID
	 */
	getContext(id: GameContextId): GameContext | null {
		return this.contexts.get(id)?.context ?? null;
	}

	/**
	 * Get the currently active context
	 */
	getActiveContext(): GameContext | null {
		if (!this.activeContextId) return null;
		return this.getContext(this.activeContextId);
	}

	/**
	 * Set the active context by ID
	 * Updates window globals for backward compatibility
	 */
	setActiveContext(id: GameContextId | null): void {
		if (id !== null && !this.contexts.has(id)) {
			throw new Error(`GameContext with id "${id}" does not exist`);
		}

		this.activeContextId = id;

		// Update window globals for backward compatibility with E2E tests
		// and legacy code that uses getInstance()
		if (id !== null) {
			const context = this.getContext(id)!;
			(window as any).__GAME_MANAGER__ = context.gameManager;
			(window as any).__AUDIO_MANAGER__ = context.audioManager;
			(window as any).__A11Y_MANAGER__ = context.accessibilityManager;
			(window as any).__GAME_CONTEXT__ = context;
		}
	}

	/**
	 * Get the active context ID
	 */
	getActiveContextId(): GameContextId | null {
		return this.activeContextId;
	}

	/**
	 * Destroy a context and clean up its resources
	 */
	destroyContext(id: GameContextId): void {
		const data = this.contexts.get(id);
		if (!data) return;

		// Mark as destroyed
		data.context.isDestroyed = true;

		// Clear bound scenes
		data.boundScenes.clear();

		// Remove from registry
		this.contexts.delete(id);

		// If this was the active context, clear it
		if (this.activeContextId === id) {
			this.activeContextId = null;
		}
	}

	/**
	 * Destroy all contexts
	 */
	destroyAll(): void {
		for (const id of this.contexts.keys()) {
			this.destroyContext(id);
		}
	}

	/**
	 * Bind a context to a Phaser scene
	 * This helps track which scenes are using which contexts
	 */
	bindToScene(contextId: GameContextId, scene: Phaser.Scene): void {
		const data = this.contexts.get(contextId);
		if (data) {
			data.boundScenes.add(scene);
		}
	}

	/**
	 * Unbind a context from a Phaser scene
	 */
	unbindFromScene(contextId: GameContextId, scene: Phaser.Scene): void {
		const data = this.contexts.get(contextId);
		if (data) {
			data.boundScenes.delete(scene);
		}
	}

	/**
	 * Get all context IDs
	 */
	getAllContextIds(): GameContextId[] {
		return Array.from(this.contexts.keys());
	}

	/**
	 * Get the number of active contexts
	 */
	getContextCount(): number {
		return this.contexts.size;
	}
}
