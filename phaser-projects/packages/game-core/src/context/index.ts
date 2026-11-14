/**
 * Context Module - Public exports
 *
 * This module provides scoped context management for Phaser games,
 * enabling multiple isolated game instances to run simultaneously.
 */

export type {
	GameContext,
	GameContextId,
	GameContextOptions,
	GameContextData
} from './GameContext';

export { default as GameContextProvider } from './GameContextProvider';

// Convenience function to get the active context
import GameContextProvider from './GameContextProvider';

/**
 * Get the currently active GameContext
 * Shorthand for GameContextProvider.getInstance().getActiveContext()
 */
export function getActiveGameContext() {
	return GameContextProvider.getInstance().getActiveContext();
}
