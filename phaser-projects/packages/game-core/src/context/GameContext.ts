/**
 * GameContext - Interface definitions for scoped game context
 *
 * A GameContext represents an isolated instance of a game with its own managers.
 * This enables running multiple games simultaneously without state conflicts.
 */

import GameManager from '../managers/GameManager';
import AudioManager from '../managers/AudioManager';
import AccessibilityManager from '../managers/AccessibilityManager';
import ConfigLoader from '../services/ConfigLoader';

/**
 * Unique identifier for a game context
 */
export type GameContextId = string;

/**
 * A GameContext contains all managers needed to run a game instance.
 * Each context is isolated from others, enabling multi-game scenarios.
 */
export interface GameContext {
	/** Unique identifier for this context */
	readonly id: GameContextId;

	/** Game state and configuration manager */
	readonly gameManager: GameManager;

	/** Audio/sound effects manager */
	readonly audioManager: AudioManager;

	/** Accessibility features manager */
	readonly accessibilityManager: AccessibilityManager;

	/** Configuration loading service */
	readonly configLoader: ConfigLoader;

	/** Timestamp when this context was created */
	readonly createdAt: number;

	/** Whether this context has been destroyed */
	isDestroyed: boolean;
}

/**
 * Options for creating a new GameContext
 */
export interface GameContextOptions {
	/** Optional custom ID (auto-generated if not provided) */
	id?: GameContextId;

	/** Audio manager options */
	audio?: {
		/** Prefix for localStorage keys (for isolated storage) */
		storagePrefix?: string;
		/** Whether to share storage with other contexts (default: true) */
		shared?: boolean;
	};

	/** Accessibility manager options */
	accessibility?: {
		/** Prefix for localStorage keys */
		storagePrefix?: string;
		/** Whether to share storage with other contexts (default: true) */
		shared?: boolean;
	};
}

/**
 * Internal data structure for storing context information
 */
export interface GameContextData {
	context: GameContext;
	boundScenes: Set<Phaser.Scene>;
}
