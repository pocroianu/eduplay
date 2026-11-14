/**
 * Background System
 * Registry-based background management with built-in factories
 *
 * This module initializes the BackgroundRegistry with all built-in background styles.
 * Custom backgrounds can be registered at runtime.
 */

import BackgroundRegistry, { BackgroundDefinition } from './BackgroundRegistry';
import {
	createDefaultBackground,
	createHillsBackground,
	createOceanBackground,
	createSpaceBackground,
	createCandyBackground,
	createForestBackground,
	createSunsetBackground
} from './factories';

/**
 * Initialize the BackgroundRegistry with all built-in backgrounds
 * This is called automatically when the module loads
 */
function initializeBackgroundRegistry(): void {
	const registry = BackgroundRegistry.getInstance();

	// Register all built-in backgrounds
	const builtInBackgrounds: BackgroundDefinition[] = [
		{
			name: 'default',
			displayName: 'Default',
			description: 'Classic gradient background with floating sparkles',
			factory: createDefaultBackground,
			tags: ['simple', 'minimal']
		},
		{
			name: 'hills',
			displayName: 'Hills',
			description: 'Green hills, blue sky, and floating clouds',
			factory: createHillsBackground,
			tags: ['nature', 'animated', 'complex']
		},
		{
			name: 'ocean',
			displayName: 'Ocean',
			description: 'Deep blue waters with animated wave lines',
			factory: createOceanBackground,
			tags: ['water', 'animated', 'complex']
		},
		{
			name: 'space',
			displayName: 'Space',
			description: 'Dark cosmos with twinkling stars and nebula',
			factory: createSpaceBackground,
			tags: ['space', 'dark', 'animated']
		},
		{
			name: 'candy',
			displayName: 'Candy',
			description: 'Sweet pink theme with candy stripes',
			factory: createCandyBackground,
			tags: ['sweet', 'colorful', 'simple']
		},
		{
			name: 'forest',
			displayName: 'Forest',
			description: 'Deep woods with layered canopy',
			factory: createForestBackground,
			tags: ['nature', 'dark', 'complex']
		},
		{
			name: 'sunset',
			displayName: 'Sunset',
			description: 'Warm orange and purple gradient with sun',
			factory: createSunsetBackground,
			tags: ['warm', 'colorful', 'animated']
		}
	];

	registry.registerBatch(builtInBackgrounds);

	// Set 'default' as the default background
	registry.setDefault('default');
}

// Auto-initialize registry on module load
initializeBackgroundRegistry();

// ============================================
// Exports
// ============================================

export { BackgroundRegistry };
export type { BackgroundDefinition, BackgroundFactory } from './BackgroundRegistry';
export { getBackgroundRegistry, registerBackground, createBackground } from './BackgroundRegistry';
export * from './factories';
export default BackgroundRegistry;
