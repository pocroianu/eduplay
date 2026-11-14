/**
 * Predefined Theme System
 * Easy-to-use themes for educational games
 *
 * This module now integrates with ThemeRegistry for runtime extensibility.
 * The legacy API is maintained for backward compatibility.
 */

import { ThemeConfig, BackgroundStyle } from '../types/GameConfig';
import ThemeRegistry, { ThemeDefinition as RegistryThemeDefinition } from './ThemeRegistry';

// Legacy type - kept for backward compatibility
export type ThemeName = 'nature' | 'ocean' | 'space' | 'candy' | 'forest' | 'sunset' | 'default';

// Legacy interface - kept for backward compatibility
export interface ThemeDefinition extends ThemeConfig {
	name: ThemeName;
	displayName: string;
	description: string;
}

// ============================================
// Predefined Themes
// ============================================

export const THEMES: Record<ThemeName, ThemeDefinition> = {
	nature: {
		name: 'nature',
		displayName: 'Nature',
		description: 'Green hills, blue sky, and floating clouds',
		backgroundStyle: 'hills',
		primary: 0x43A047,
		secondary: 0x66BB6A,
		background: 0x64B5F6,
		cardBg: 0x2E7D32,
		textColor: '#FFFFFF',
		containerBg: 0xFFFFFF,
		containerText: '#1B5E20',
		containerBorder: 0x43A047,
		correctColor: 0x4CAF50,
		incorrectColor: 0xFF9800,
		starColor: 0xFFD54F,
		mascotKey: 'mascot-bird',
		mascotDisplayName: 'Birdie',
	},

	ocean: {
		name: 'ocean',
		displayName: 'Ocean',
		description: 'Deep blue waters with coral accents',
		backgroundStyle: 'ocean',
		primary: 0x039BE5,
		secondary: 0x00BCD4,
		background: 0x0277BD,
		cardBg: 0x0288D1,
		textColor: '#FFFFFF',
		containerBg: 0xFFFFFF,
		containerText: '#01579B',
		containerBorder: 0x00BCD4,
		correctColor: 0x4CAF50,
		incorrectColor: 0xFF9800,
		starColor: 0xFFD54F,
		mascotKey: 'mascot-fish',
		mascotDisplayName: 'Bubbles',
	},

	space: {
		name: 'space',
		displayName: 'Space',
		description: 'Dark cosmos with purple nebula',
		backgroundStyle: 'space',
		primary: 0x7E57C2,
		secondary: 0xE040FB,
		background: 0x1A1A2E,
		cardBg: 0x16213E,
		textColor: '#FFFFFF',
		containerBg: 0x1A1A2E,
		containerText: '#FFFFFF',
		containerBorder: 0x7E57C2,
		correctColor: 0x4CAF50,
		incorrectColor: 0xFF9800,
		starColor: 0xFFD700,
		mascotKey: 'mascot-alien',
		mascotDisplayName: 'Zippy',
	},

	candy: {
		name: 'candy',
		displayName: 'Candy',
		description: 'Sweet pink and pastel colors',
		backgroundStyle: 'candy',
		primary: 0xEC407A,
		secondary: 0xF48FB1,
		background: 0xFCE4EC,
		cardBg: 0xF8BBD9,
		textColor: '#880E4F',
		containerBg: 0xFFFFFF,
		containerText: '#880E4F',
		containerBorder: 0xEC407A,
		correctColor: 0x4CAF50,
		incorrectColor: 0xFF9800,
		starColor: 0xFFC107,
		mascotKey: 'mascot-gingerbread',
		mascotDisplayName: 'Cookie',
	},

	forest: {
		name: 'forest',
		displayName: 'Forest',
		description: 'Deep woods with earthy tones',
		backgroundStyle: 'forest',
		primary: 0x388E3C,
		secondary: 0x689F38,
		background: 0x1B5E20,
		cardBg: 0x2E7D32,
		textColor: '#FFFFFF',
		containerBg: 0xF1F8E9,
		containerText: '#1B5E20',
		containerBorder: 0x689F38,
		correctColor: 0x4CAF50,
		incorrectColor: 0xFF9800,
		starColor: 0xFFD54F,
		mascotKey: 'mascot-fox',
		mascotDisplayName: 'Foxy',
	},

	sunset: {
		name: 'sunset',
		displayName: 'Sunset',
		description: 'Warm orange and purple gradient',
		backgroundStyle: 'sunset',
		primary: 0xFF5722,
		secondary: 0xFF9800,
		background: 0x4A148C,
		cardBg: 0x6A1B9A,
		textColor: '#FFFFFF',
		containerBg: 0xFFF3E0,
		containerText: '#4A148C',
		containerBorder: 0xFF5722,
		correctColor: 0x4CAF50,
		incorrectColor: 0xFF9800,
		starColor: 0xFFD54F,
		mascotKey: 'mascot-firefly',
		mascotDisplayName: 'Sparky',
	},

	default: {
		name: 'default',
		displayName: 'Default',
		description: 'Classic blue and friendly owl',
		backgroundStyle: 'default',
		primary: 0x5C6BC0,
		secondary: 0x26A69A,
		background: 0x283593,
		cardBg: 0x3949AB,
		textColor: '#FFFFFF',
		containerBg: 0xFFFFFF,
		containerText: '#1A237E',
		containerBorder: 0x5C6BC0,
		correctColor: 0x4CAF50,
		incorrectColor: 0xFF9800,
		starColor: 0xFFD54F,
		mascotKey: 'mascot-owl',
		mascotDisplayName: 'Ollie',
	}
};

// ============================================
// Theme Utilities
// ============================================

/**
 * Get a theme by name
 */
export function getTheme(name: ThemeName): ThemeDefinition {
	return THEMES[name] || THEMES.default;
}

/**
 * Get all available themes
 */
export function getAllThemes(): ThemeDefinition[] {
	return Object.values(THEMES);
}

/**
 * Get theme names for selection UI
 */
export function getThemeOptions(): { value: ThemeName; label: string }[] {
	return Object.values(THEMES).map(t => ({
		value: t.name,
		label: t.displayName
	}));
}

/**
 * Convert theme name to ThemeConfig (strips metadata)
 */
export function themeToConfig(theme: ThemeDefinition): ThemeConfig {
	const { name, displayName, description, ...config } = theme;
	return config;
}

/**
 * Merge a partial theme with a base theme
 */
export function mergeTheme(
	base: ThemeName | ThemeConfig,
	overrides?: Partial<ThemeConfig>
): ThemeConfig {
	const baseTheme = typeof base === 'string' ? getTheme(base) : base;
	return {
		...themeToConfig(baseTheme as ThemeDefinition),
		...overrides
	};
}

// ============================================
// Registry Integration
// ============================================

/**
 * Initialize the ThemeRegistry with all built-in themes
 * This is called automatically when the module loads
 */
function initializeThemeRegistry(): void {
	const registry = ThemeRegistry.getInstance();

	// Register all built-in themes
	Object.values(THEMES).forEach(theme => {
		registry.register(theme as RegistryThemeDefinition);
	});

	// Set 'default' as the default theme
	registry.setDefault('default');
}

// Auto-initialize registry on module load
initializeThemeRegistry();

// ============================================
// Exports
// ============================================

export { ThemeRegistry };
export type { RegistryThemeDefinition };
export default THEMES;
