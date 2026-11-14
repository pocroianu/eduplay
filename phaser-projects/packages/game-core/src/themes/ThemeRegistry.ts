/**
 * ThemeRegistry - Runtime-extensible theme management system
 *
 * Enables themes to be registered at runtime without TypeScript recompilation.
 * Supports both built-in themes and external theme definitions from JSON.
 *
 * Benefits:
 * - Add new themes without code changes
 * - Load themes from external sources (JSON, CMS)
 * - Create game-specific custom themes
 * - Maintain backward compatibility with existing theme system
 */

import { ThemeConfig } from '../types/GameConfig';

/**
 * Extended theme definition with metadata
 */
export interface ThemeDefinition extends ThemeConfig {
	name: string;
	displayName: string;
	description?: string;
}

/**
 * Singleton registry for managing themes
 */
export class ThemeRegistry {
	private static instance: ThemeRegistry;
	private themes: Map<string, ThemeDefinition>;
	private defaultThemeName: string = 'default';

	private constructor() {
		this.themes = new Map();
	}

	/**
	 * Get the singleton instance
	 */
	public static getInstance(): ThemeRegistry {
		if (!ThemeRegistry.instance) {
			ThemeRegistry.instance = new ThemeRegistry();
		}
		return ThemeRegistry.instance;
	}

	/**
	 * Register a new theme
	 * @param theme - Theme definition to register
	 * @throws Error if theme name is empty or theme already exists
	 */
	public register(theme: ThemeDefinition): void {
		if (!theme.name || theme.name.trim() === '') {
			throw new Error('Theme name cannot be empty');
		}

		const normalizedName = theme.name.toLowerCase().trim();

		if (this.themes.has(normalizedName)) {
			console.warn(`Theme '${normalizedName}' already registered. Overwriting...`);
		}

		this.themes.set(normalizedName, {
			...theme,
			name: normalizedName
		});
	}

	/**
	 * Register multiple themes at once
	 * @param themes - Array of theme definitions
	 */
	public registerBatch(themes: ThemeDefinition[]): void {
		themes.forEach(theme => this.register(theme));
	}

	/**
	 * Get a theme by name
	 * @param name - Theme name (case-insensitive)
	 * @returns Theme definition, or default theme if not found
	 */
	public get(name: string): ThemeDefinition {
		const normalizedName = name.toLowerCase().trim();
		const theme = this.themes.get(normalizedName);

		if (!theme) {
			console.warn(`Theme '${normalizedName}' not found. Using default theme.`);
			return this.themes.get(this.defaultThemeName) || this.createFallbackTheme();
		}

		return theme;
	}

	/**
	 * Check if a theme is registered
	 * @param name - Theme name (case-insensitive)
	 */
	public has(name: string): boolean {
		return this.themes.has(name.toLowerCase().trim());
	}

	/**
	 * Get all registered themes
	 * @returns Array of all theme definitions
	 */
	public getAll(): ThemeDefinition[] {
		return Array.from(this.themes.values());
	}

	/**
	 * Get theme names for selection UI
	 * @returns Array of {value, label} objects for dropdowns
	 */
	public getOptions(): Array<{ value: string; label: string }> {
		return Array.from(this.themes.values()).map(theme => ({
			value: theme.name,
			label: theme.displayName
		}));
	}

	/**
	 * Get theme count
	 */
	public count(): number {
		return this.themes.size;
	}

	/**
	 * Set the default theme name
	 * @param name - Theme name to use as default
	 */
	public setDefault(name: string): void {
		const normalizedName = name.toLowerCase().trim();
		if (!this.themes.has(normalizedName)) {
			throw new Error(`Cannot set default theme: '${normalizedName}' is not registered`);
		}
		this.defaultThemeName = normalizedName;
	}

	/**
	 * Get the default theme
	 */
	public getDefault(): ThemeDefinition {
		return this.themes.get(this.defaultThemeName) || this.createFallbackTheme();
	}

	/**
	 * Remove a theme from the registry
	 * @param name - Theme name to remove
	 * @returns true if theme was removed, false if not found
	 */
	public unregister(name: string): boolean {
		const normalizedName = name.toLowerCase().trim();

		if (normalizedName === this.defaultThemeName) {
			throw new Error('Cannot unregister the default theme');
		}

		return this.themes.delete(normalizedName);
	}

	/**
	 * Clear all themes
	 * Warning: This will remove all registered themes including built-ins
	 */
	public clear(): void {
		this.themes.clear();
	}

	/**
	 * Convert theme definition to ThemeConfig (strips metadata)
	 * @param theme - Theme definition
	 * @returns ThemeConfig without metadata fields
	 */
	public toConfig(theme: ThemeDefinition): ThemeConfig {
		const { name, displayName, description, ...config } = theme;
		return config;
	}

	/**
	 * Merge a partial theme override with a base theme
	 * @param baseName - Base theme name
	 * @param overrides - Partial theme config to override
	 * @returns Merged theme config
	 */
	public merge(baseName: string, overrides?: Partial<ThemeConfig>): ThemeConfig {
		const baseTheme = this.get(baseName);
		const baseConfig = this.toConfig(baseTheme);

		return {
			...baseConfig,
			...overrides
		};
	}

	/**
	 * Load themes from JSON array
	 * @param themesJson - Array of theme definitions
	 * @returns Number of themes loaded
	 */
	public loadFromJSON(themesJson: ThemeDefinition[]): number {
		if (!Array.isArray(themesJson)) {
			throw new Error('Themes JSON must be an array');
		}

		let loadedCount = 0;
		for (const theme of themesJson) {
			try {
				this.register(theme);
				loadedCount++;
			} catch (error) {
				console.error(`Failed to load theme '${theme.name}':`, error);
			}
		}

		return loadedCount;
	}

	/**
	 * Load themes from a remote URL
	 * @param url - URL to fetch themes from
	 * @returns Number of themes loaded
	 */
	public async loadFromURL(url: string): Promise<number> {
		try {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();

			// Support both array format and {themes: [...]} format
			const themesArray = Array.isArray(data) ? data : data.themes;

			if (!themesArray) {
				throw new Error('Invalid theme data format');
			}

			return this.loadFromJSON(themesArray);
		} catch (error) {
			console.error(`Failed to load themes from ${url}:`, error);
			return 0;
		}
	}

	/**
	 * Export all themes as JSON
	 * @returns Array of theme definitions
	 */
	public exportToJSON(): ThemeDefinition[] {
		return this.getAll();
	}

	/**
	 * Create a hardcoded fallback theme for emergencies
	 * @private
	 */
	private createFallbackTheme(): ThemeDefinition {
		return {
			name: 'fallback',
			displayName: 'Fallback',
			description: 'Emergency fallback theme',
			backgroundStyle: 'default',
			primary: 0x4F46E5,
			secondary: 0x10B981,
			background: 0x1F2937,
			cardBg: 0x374151,
			textColor: '#FFFFFF',
			containerBg: 0xFFFFFF,
			containerText: '#1F2937',
			containerBorder: 0x4F46E5,
			correctColor: 0x22C55E,
			incorrectColor: 0xEF4444,
			starColor: 0xFBBF24
		};
	}
}

// ============================================
// Convenience Functions
// ============================================

/**
 * Get the singleton registry instance
 */
export function getThemeRegistry(): ThemeRegistry {
	return ThemeRegistry.getInstance();
}

/**
 * Register a theme (convenience function)
 */
export function registerTheme(theme: ThemeDefinition): void {
	ThemeRegistry.getInstance().register(theme);
}

/**
 * Get a theme by name (convenience function)
 */
export function getRegisteredTheme(name: string): ThemeDefinition {
	return ThemeRegistry.getInstance().get(name);
}

export default ThemeRegistry;
