/**
 * ConfigLoader Service
 * Loads game configurations with language-specific strings.
 *
 * Supports both context-based usage (recommended) and legacy singleton pattern.
 */

import {
	BaseGameConfig,
	GameStrings,
	HydratedGameConfig,
	HydratedQuestion,
	ConfigLoadOptions,
	CONFIG_DEFAULTS,
	TemplateConfigBundle,
	TemplateGameConfig
} from '../types/ConfigSchema';
import {
	gameStringsSchema,
	hydratedGameConfigSchema,
	configLoadOptionsSchema,
	themeConfigSchema,
	parseGameConfig
} from '@edu-play/validation';
import type { GameConfig as ValidatedGameConfig } from '@edu-play/validation';
import { DEFAULT_THEME, ThemeConfig } from '../types/GameConfig';
import {
	GameWithAssets
} from '../types/AssetSchema';
import i18n, { Language } from '../i18n';
import ThemeRegistry from '../themes/ThemeRegistry';
import AssetResolver from './AssetResolver';
import { getPreviewRuntimeSettings, resolveConfigBasePath } from '../previewRuntime';

interface LoadedBaseConfig {
	config: TemplateGameConfig;
	configUrl?: string;
}

interface LoadedStrings {
	strings: GameStrings;
	language: Language;
}

interface ConfigLocation {
	url: string;
	cacheKey: string;
	configUrl?: string;
}

// Lazy getter to avoid circular dependency with GameContextProvider
// The provider is accessed through a getter function that resolves at runtime
function getContextProvider(): any {
	// Dynamic import at runtime to break circular dependency
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	return (globalThis as any).__CONTEXT_PROVIDER__;
}

class ConfigLoader {
	/** Legacy singleton instance for backward compatibility */
	private static legacyInstance: ConfigLoader | null = null;

	private cache: Map<string, TemplateGameConfig> = new Map();
	private stringsCache: Map<string, GameStrings> = new Map();

	/**
	 * Create a new ConfigLoader instance
	 * Prefer using GameContextProvider.createContext() for new code
	 */
	constructor() {}

	/**
	 * Get singleton instance
	 * @deprecated Use GameContextProvider.getActiveContext().configLoader instead
	 *
	 * Returns the active context's ConfigLoader if available,
	 * otherwise falls back to legacy singleton for backward compatibility.
	 */
	static getInstance(): ConfigLoader {
		// Try to get from active context first (via window global set by index.ts)
		const provider = getContextProvider();
		if (provider) {
			const context = provider.getActiveContext();
			if (context) {
				return context.configLoader;
			}
		}

		// Fallback to legacy singleton
		if (!ConfigLoader.legacyInstance) {
			ConfigLoader.legacyInstance = new ConfigLoader();
		}
		return ConfigLoader.legacyInstance;
	}

	private formatValidationErrors(issues: { path: (string | number)[]; message: string }[]): string {
		return issues
			.map(i => `  - ${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`)
			.join('\n');
	}

	/**
	 * Load a game configuration with language-specific strings.
	 * Backward-compatible multiple-choice API that returns a hydrated config.
	 */
	async loadGame(options: ConfigLoadOptions): Promise<HydratedGameConfig> {
		const bundle = await this.loadTemplateConfig(options);
		const baseConfig = this.requireMultipleChoiceConfig(bundle.config, 'loadGame');
		return this.hydrateConfig(baseConfig, bundle.strings, bundle.language);
	}

	/**
	 * Load a validated raw template/activity config and language strings.
	 */
	async loadTemplateConfig<TConfig extends TemplateGameConfig = TemplateGameConfig>(
		options: ConfigLoadOptions
	): Promise<TemplateConfigBundle<TConfig>> {
		const optionsResult = configLoadOptionsSchema.safeParse(options);
		if (!optionsResult.success) {
			throw new Error(
				`Invalid game load options:\n${this.formatValidationErrors(optionsResult.error.issues)}`
			);
		}

		const {
			gameId,
			language = i18n.getLanguage(),
			baseUrl = resolveConfigBasePath(),
			configUrl,
			useCache = true
		} = optionsResult.data as ConfigLoadOptions;

		const base = await this.loadBaseConfig(gameId, baseUrl, useCache, configUrl);
		const strings = await this.loadStrings(base.config.meta.gameId, language, baseUrl, useCache);

		return {
			config: base.config as TConfig,
			strings: strings.strings,
			language: strings.language,
			gameId: base.config.meta.gameId,
			baseUrl,
			configUrl: base.configUrl
		};
	}

	/**
	 * Alias for host/runtime code that thinks in Activity terms instead of template terms.
	 */
	async loadActivityConfig<TConfig extends TemplateGameConfig = TemplateGameConfig>(
		options: ConfigLoadOptions
	): Promise<TemplateConfigBundle<TConfig>> {
		return this.loadTemplateConfig<TConfig>(options);
	}

	/**
	 * Load a game configuration with resolved assets.
	 * Returns the hydrated multiple-choice config plus a Phaser asset pack for dynamic loading.
	 */
	async loadGameWithAssets(options: ConfigLoadOptions): Promise<GameWithAssets> {
		const optionsResult = configLoadOptionsSchema.safeParse(options);
		if (!optionsResult.success) {
			throw new Error(
				`Invalid game load options:\n${this.formatValidationErrors(optionsResult.error.issues)}`
			);
		}

		const {
			gameId,
			language = i18n.getLanguage(),
			baseUrl = resolveConfigBasePath(),
			configUrl,
			useCache = true
		} = optionsResult.data as ConfigLoadOptions;

		// Load base config first (needed to derive assets)
		const base = await this.loadBaseConfig(gameId, baseUrl, useCache, configUrl);
		const baseConfig = this.requireMultipleChoiceConfig(base.config, 'loadGameWithAssets');

		// Get asset resolver
		const assetResolver = AssetResolver.getInstance();

		// Get asset manifest (explicit from config or derived from questions)
		const manifestResolution = await assetResolver.getManifest(baseConfig);
		const manifest = manifestResolution.manifest;

		// Resolve asset URLs
		const assets = await assetResolver.resolveAssets(manifest);

		// Generate Phaser asset pack
		const assetPack = await assetResolver.generateAssetPack(manifest);

		// Load language strings
		const loadedStrings = await this.loadStrings(baseConfig.meta.gameId, language, baseUrl, useCache);

		// Hydrate the config
		const config = this.hydrateConfig(baseConfig, loadedStrings.strings, loadedStrings.language);

		return {
			config,
			manifest,
			manifestSource: manifestResolution.source,
			assets,
			assetPack
		};
	}

	/**
	 * Load base config (language-agnostic structure)
	 */
	private async loadBaseConfig(
		gameId: string,
		baseUrl: string,
		useCache: boolean,
		configUrl?: string
	): Promise<LoadedBaseConfig> {
		const location = this.resolveConfigLocation(gameId, baseUrl, configUrl);

		if (useCache && this.cache.has(location.cacheKey)) {
			return {
				config: this.cache.get(location.cacheKey)!,
				configUrl: location.configUrl
			};
		}

		const response = await fetch(location.url);

		if (!response.ok) {
			throw new Error(`Failed to load game config: ${gameId} (${response.status})`);
		}

		const raw = await response.json();
		const result = parseGameConfig(raw);
		if (!result.success) {
			throw new Error(
				`Invalid config for game "${gameId}":\n${this.formatValidationErrors(result.error.issues)}`
			);
		}
		const config = result.data as TemplateGameConfig;

		if (useCache) {
			this.cache.set(location.cacheKey, config);
		}

		return {
			config,
			configUrl: location.configUrl
		};
	}

	private resolveConfigLocation(gameId: string, baseUrl: string, configUrl?: string): ConfigLocation {
		const overrideUrl = this.resolveConfigUrlOverride(configUrl);
		if (overrideUrl) {
			return {
				url: overrideUrl,
				cacheKey: `base:url:${overrideUrl}`,
				configUrl: overrideUrl
			};
		}

		return {
			url: `${baseUrl}/config.json`,
			cacheKey: `base:activity-version:${baseUrl}`
		};
	}

	private resolveConfigUrlOverride(optionConfigUrl?: string): string | undefined {
		const raw = optionConfigUrl
			?? this.getPreviewConfigUrl()
			?? ConfigLoader.getConfigUrlFromUrl();

		const trimmed = raw?.trim();
		if (!trimmed) {
			return undefined;
		}

		let resolved: URL;
		try {
			resolved = new URL(trimmed, this.getCurrentHref());
		} catch {
			throw new Error(`Invalid configUrl: "${trimmed}"`);
		}

		const currentOrigin = this.getCurrentOrigin();
		if (resolved.origin !== currentOrigin) {
			throw new Error('Invalid configUrl: configUrl must be same-origin');
		}

		if (!resolved.pathname.startsWith('/api/v1/')) {
			throw new Error('Invalid configUrl: configUrl must point to a /api/v1/ path');
		}

		return resolved.href;
	}

	private getPreviewConfigUrl(): string | undefined {
		if (typeof window === 'undefined') {
			return undefined;
		}
		return getPreviewRuntimeSettings().configUrl;
	}

	private getCurrentHref(): string {
		if (typeof window !== 'undefined' && window.location?.href) {
			return window.location.href;
		}
		return 'http://localhost/';
	}

	private getCurrentOrigin(): string {
		if (typeof window !== 'undefined' && window.location?.origin) {
			return window.location.origin;
		}
		return 'http://localhost';
	}

	private requireMultipleChoiceConfig(config: ValidatedGameConfig, caller: string): BaseGameConfig {
		if ('questions' in config && Array.isArray(config.questions)) {
			return config as BaseGameConfig;
		}
		throw new Error(`${caller} only supports multiple-choice configs. Use loadTemplateConfig/loadActivityConfig for other templates.`);
	}

	/**
	 * Load language-specific strings
	 */
	private async loadStrings(
		gameId: string,
		language: Language,
		baseUrl: string,
		useCache: boolean
	): Promise<LoadedStrings> {
		const cacheKey = `strings:${baseUrl}:${gameId}:${language}`;

		if (useCache && this.stringsCache.has(cacheKey)) {
			return {
				strings: this.stringsCache.get(cacheKey)!,
				language
			};
		}

		const url = `${baseUrl}/strings/${language}.json`;
		let strings: GameStrings;

		try {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`Language file not found: ${language}`);
			}
			const raw = await response.json();
			const result = gameStringsSchema.safeParse(raw);
			if (!result.success) {
				throw new Error(
					`Invalid strings file "${language}.json" for game "${gameId}":\n${this.formatValidationErrors(result.error.issues)}`
				);
			}
			strings = result.data as GameStrings;
		} catch {
			// Fallback to English if requested language not available
			if (language !== 'en') {
				console.warn(`Language ${language} not found for ${gameId}, falling back to English`);
				return this.loadStrings(gameId, 'en', baseUrl, useCache);
			}
			throw new Error(`No language files found for game: ${gameId}`);
		}

		if (useCache) {
			this.stringsCache.set(cacheKey, strings);
		}

		return { strings, language };
	}

	/**
	 * Combine base config with language strings to create hydrated config
	 */
	private hydrateConfig(
		base: BaseGameConfig,
		strings: GameStrings,
		language: Language
	): HydratedGameConfig {
		// Resolve theme: use themeName if provided, then apply any overrides
		const themeRegistry = ThemeRegistry.getInstance();
		let theme: ThemeConfig;

		if (base.meta.themeName) {
			// Get theme from registry (supports both built-in and custom themes)
			const themeDefinition = themeRegistry.get(base.meta.themeName);
			theme = {
				...themeRegistry.toConfig(themeDefinition),
				...base.meta.theme  // Allow overrides on top of registered theme
			};
		} else {
			theme = {
				...DEFAULT_THEME,
				...base.meta.theme
			};
		}

		const themeResult = themeConfigSchema.safeParse(theme);
		if (!themeResult.success) {
			throw new Error(
				`Invalid resolved theme for game "${base.meta.gameId}":\n${this.formatValidationErrors(themeResult.error.issues)}`
			);
		}

		const questions: HydratedQuestion[] = base.questions.map((q) => {
			const questionStrings = strings.questions?.[q.id] || {};

			return {
				id: q.id,
				question: {
					text: questionStrings.question || q.questionKey,
					audio: questionStrings.audio || q.audioKey,
					image: q.imageKey
				},
				choices: q.choices.map((c) => ({
					type: c.type,
					value: c.value,
					isCorrect: c.isCorrect,
					label: strings.choices?.[c.value]
				})),
				timeLimit: q.timeLimit,
				points: q.points
			};
		});

		const hydrated = {
			meta: {
				gameId: base.meta.gameId,
				version: base.meta.version || CONFIG_DEFAULTS.version,
				totalSteps: base.meta.totalSteps,
				title: strings.meta.title,
				description: strings.meta.description,
				theme,
				difficulty: base.meta.difficulty || CONFIG_DEFAULTS.difficulty,
				shuffleQuestions: base.meta.shuffleQuestions ?? CONFIG_DEFAULTS.shuffleQuestions,
				shuffleChoices: base.meta.shuffleChoices ?? CONFIG_DEFAULTS.shuffleChoices,
				language
			},
			questions
		};

		const hydratedResult = hydratedGameConfigSchema.safeParse(hydrated);
		if (!hydratedResult.success) {
			throw new Error(
				`Invalid hydrated config for game "${base.meta.gameId}":\n${this.formatValidationErrors(hydratedResult.error.issues)}`
			);
		}

		return hydratedResult.data as HydratedGameConfig;
	}

	/**
	 * Clear all cached configs
	 */
	clearCache(): void {
		this.cache.clear();
		this.stringsCache.clear();
	}

	/**
	 * Clear cache for a specific game
	 */
	clearGameCache(gameId: string): void {
		for (const key of this.cache.keys()) {
			if (key.includes(gameId)) {
				this.cache.delete(key);
			}
		}
		for (const key of this.stringsCache.keys()) {
			if (key.includes(gameId)) {
				this.stringsCache.delete(key);
			}
		}
	}

	/**
	 * Get game ID from URL query params (for editor preview)
	 */
	static getGameIdFromUrl(): string | null {
		if (typeof window === 'undefined') {
			return null;
		}
		const params = new URLSearchParams(window.location.search);
		return params.get('game') || params.get('gameId');
	}

	/**
	 * Get config URL override from URL query params.
	 */
	static getConfigUrlFromUrl(): string | null {
		if (typeof window === 'undefined') {
			return null;
		}
		const params = new URLSearchParams(window.location.search);
		return params.get('configUrl');
	}

	/**
	 * Get language from URL query params
	 */
	static getLanguageFromUrl(): Language | null {
		if (typeof window === 'undefined') {
			return null;
		}
		const params = new URLSearchParams(window.location.search);
		const lang = params.get('lang') || params.get('language');
		if (lang === 'en' || lang === 'ro') {
			return lang;
		}
		return null;
	}
}

export default ConfigLoader;
