/**
 * BackgroundRegistry - Runtime-extensible background factory system
 *
 * Enables background styles to be registered at runtime without TypeScript recompilation.
 * Uses factory pattern to create background containers on demand.
 *
 * Benefits:
 * - Add new background styles without modifying AnimatedBackground.ts
 * - Load background factories dynamically
 * - Create game-specific custom backgrounds
 * - Better testing (mock background factories)
 */

import { ThemeConfig } from '../types/GameConfig';

/**
 * Background factory function signature
 * @param scene - Phaser scene to add background to
 * @param width - Screen width
 * @param height - Screen height
 * @param theme - Theme configuration for colors
 * @returns Container with background elements
 */
export type BackgroundFactory = (
	scene: Phaser.Scene,
	width: number,
	height: number,
	theme: ThemeConfig
) => Phaser.GameObjects.Container;

/**
 * Background metadata for registry
 */
export interface BackgroundDefinition {
	name: string;
	displayName: string;
	description?: string;
	factory: BackgroundFactory;
	tags?: string[];  // e.g., ['nature', 'animated', 'complex']
}

/**
 * Singleton registry for managing background factories
 */
export class BackgroundRegistry {
	private static instance: BackgroundRegistry;
	private backgrounds: Map<string, BackgroundDefinition>;
	private defaultBackgroundName: string = 'default';

	private constructor() {
		this.backgrounds = new Map();
	}

	/**
	 * Get the singleton instance
	 */
	public static getInstance(): BackgroundRegistry {
		if (!BackgroundRegistry.instance) {
			BackgroundRegistry.instance = new BackgroundRegistry();
		}
		return BackgroundRegistry.instance;
	}

	/**
	 * Register a new background factory
	 * @param definition - Background definition with factory function
	 * @throws Error if background name is empty or factory is not a function
	 */
	public register(definition: BackgroundDefinition): void {
		if (!definition.name || definition.name.trim() === '') {
			throw new Error('Background name cannot be empty');
		}

		if (typeof definition.factory !== 'function') {
			throw new Error('Background factory must be a function');
		}

		const normalizedName = definition.name.toLowerCase().trim();

		if (this.backgrounds.has(normalizedName)) {
			console.warn(`Background '${normalizedName}' already registered. Overwriting...`);
		}

		this.backgrounds.set(normalizedName, {
			...definition,
			name: normalizedName
		});
	}

	/**
	 * Register a background factory with minimal configuration
	 * @param name - Background style name
	 * @param factory - Factory function
	 * @param displayName - Optional display name (defaults to capitalized name)
	 */
	public registerFactory(
		name: string,
		factory: BackgroundFactory,
		displayName?: string
	): void {
		this.register({
			name,
			factory,
			displayName: displayName || this.capitalizeFirst(name),
			description: `${this.capitalizeFirst(name)} background style`
		});
	}

	/**
	 * Register multiple backgrounds at once
	 * @param definitions - Array of background definitions
	 */
	public registerBatch(definitions: BackgroundDefinition[]): void {
		definitions.forEach(def => this.register(def));
	}

	/**
	 * Create a background using registered factory
	 * @param styleName - Background style name (case-insensitive)
	 * @param scene - Phaser scene
	 * @param width - Screen width
	 * @param height - Screen height
	 * @param theme - Theme configuration
	 * @returns Container with background elements
	 */
	public create(
		styleName: string,
		scene: Phaser.Scene,
		width: number,
		height: number,
		theme: ThemeConfig
	): Phaser.GameObjects.Container {
		const normalizedName = styleName.toLowerCase().trim();
		const definition = this.backgrounds.get(normalizedName);

		if (!definition) {
			console.warn(`Background style '${normalizedName}' not found. Using default.`);
			return this.createDefault(scene, width, height, theme);
		}

		try {
			return definition.factory(scene, width, height, theme);
		} catch (error) {
			console.error(`Error creating background '${normalizedName}':`, error);
			return this.createFallback(scene, width, height, theme);
		}
	}

	/**
	 * Create default background
	 * @private
	 */
	private createDefault(
		scene: Phaser.Scene,
		width: number,
		height: number,
		theme: ThemeConfig
	): Phaser.GameObjects.Container {
		const defaultDef = this.backgrounds.get(this.defaultBackgroundName);
		if (defaultDef) {
			return defaultDef.factory(scene, width, height, theme);
		}
		return this.createFallback(scene, width, height, theme);
	}

	/**
	 * Create emergency fallback background (solid color)
	 * @private
	 */
	private createFallback(
		scene: Phaser.Scene,
		width: number,
		height: number,
		theme: ThemeConfig
	): Phaser.GameObjects.Container {
		const container = scene.add.container(0, 0);
		const bg = scene.add.rectangle(
			0,
			0,
			width,
			height,
			theme.background || 0x1F2937
		);
		bg.setOrigin(0, 0);
		container.add(bg);
		return container;
	}

	/**
	 * Check if a background style is registered
	 * @param styleName - Background style name (case-insensitive)
	 */
	public has(styleName: string): boolean {
		return this.backgrounds.has(styleName.toLowerCase().trim());
	}

	/**
	 * Get all registered background definitions
	 */
	public getAll(): BackgroundDefinition[] {
		return Array.from(this.backgrounds.values());
	}

	/**
	 * Get background names for selection UI
	 */
	public getOptions(): Array<{ value: string; label: string }> {
		return Array.from(this.backgrounds.values()).map(bg => ({
			value: bg.name,
			label: bg.displayName
		}));
	}

	/**
	 * Get available background style names
	 */
	public getAvailableStyles(): string[] {
		return Array.from(this.backgrounds.keys());
	}

	/**
	 * Get background count
	 */
	public count(): number {
		return this.backgrounds.size;
	}

	/**
	 * Set the default background style
	 * @param styleName - Background style name
	 */
	public setDefault(styleName: string): void {
		const normalizedName = styleName.toLowerCase().trim();
		if (!this.backgrounds.has(normalizedName)) {
			throw new Error(`Cannot set default: '${normalizedName}' is not registered`);
		}
		this.defaultBackgroundName = normalizedName;
	}

	/**
	 * Get the default background style name
	 */
	public getDefaultName(): string {
		return this.defaultBackgroundName;
	}

	/**
	 * Remove a background from the registry
	 * @param styleName - Background style name
	 * @returns true if removed, false if not found
	 */
	public unregister(styleName: string): boolean {
		const normalizedName = styleName.toLowerCase().trim();

		if (normalizedName === this.defaultBackgroundName) {
			throw new Error('Cannot unregister the default background');
		}

		return this.backgrounds.delete(normalizedName);
	}

	/**
	 * Clear all backgrounds
	 * Warning: This will remove all registered backgrounds including built-ins
	 */
	public clear(): void {
		this.backgrounds.clear();
	}

	/**
	 * Get backgrounds by tag
	 * @param tag - Tag to filter by (e.g., 'nature', 'animated')
	 */
	public getByTag(tag: string): BackgroundDefinition[] {
		return Array.from(this.backgrounds.values()).filter(
			bg => bg.tags && bg.tags.includes(tag)
		);
	}

	/**
	 * Capitalize first letter of string
	 * @private
	 */
	private capitalizeFirst(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
}

// ============================================
// Convenience Functions
// ============================================

/**
 * Get the singleton registry instance
 */
export function getBackgroundRegistry(): BackgroundRegistry {
	return BackgroundRegistry.getInstance();
}

/**
 * Register a background (convenience function)
 */
export function registerBackground(definition: BackgroundDefinition): void {
	BackgroundRegistry.getInstance().register(definition);
}

/**
 * Register a background factory (convenience function)
 */
export function registerBackgroundFactory(
	name: string,
	factory: BackgroundFactory,
	displayName?: string
): void {
	BackgroundRegistry.getInstance().registerFactory(name, factory, displayName);
}

/**
 * Create a background (convenience function)
 */
export function createBackground(
	styleName: string,
	scene: Phaser.Scene,
	width: number,
	height: number,
	theme: ThemeConfig
): Phaser.GameObjects.Container {
	return BackgroundRegistry.getInstance().create(styleName, scene, width, height, theme);
}

export default BackgroundRegistry;
