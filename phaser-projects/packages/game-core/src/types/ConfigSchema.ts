/**
 * Scalable Game Configuration Schema
 * Designed for 30-40+ games with separate language files
 */

import { ThemeConfig, DEFAULT_THEME } from './GameConfig';
import { Language } from '../i18n';
import type { GameConfig as ValidatedGameConfig } from '@edu-play/validation';

// ============================================
// Base Config (Language-Agnostic)
// ============================================

export type ChoiceType = 'text' | 'image' | 'audio';

export interface BaseChoice {
	type: ChoiceType;
	value: string;           // Asset key (e.g., "apple", "banana")
	isCorrect: boolean;
}

export interface BaseQuestion {
	id: string;
	questionKey: string;     // Key to lookup in language file (e.g., "q1.question")
	audioKey?: string;       // Key for audio asset (e.g., "q1.audio")
	imageKey?: string;       // Optional image key
	choices: BaseChoice[];
	timeLimit?: number;
	points?: number;
}

export interface BaseGameConfig {
	meta: {
		gameId: string;
		version: string;
		totalSteps: number;
		themeName?: string;                 // Theme name (built-in or custom)
		theme?: Partial<ThemeConfig>;    // Or custom theme overrides
		difficulty?: 'easy' | 'medium' | 'hard';
		shuffleQuestions?: boolean;
		shuffleChoices?: boolean;
		supportedLanguages: Language[];
	};
	questions: BaseQuestion[];
}

// ============================================
// Language-Specific Strings
// ============================================

export interface GameStrings {
	meta: {
		title: string;
		description?: string;
	};
	questions: Record<string, {
		question: string;
		audio?: string;        // Audio asset path for this language
	}>;
	choices?: Record<string, string>;  // Optional choice labels
}

// ============================================
// Hydrated Config (Ready for Game Use)
// ============================================

export interface HydratedQuestion {
	id: string;
	question: {
		text: string;
		audio?: string;
		image?: string;
	};
	choices: {
		type: ChoiceType;
		value: string;
		isCorrect: boolean;
		label?: string;
	}[];
	timeLimit?: number;
	points?: number;
}

export interface HydratedGameConfig {
	meta: {
		gameId: string;
		version: string;
		totalSteps: number;
		title: string;
		description?: string;
		theme: ThemeConfig;
		difficulty: 'easy' | 'medium' | 'hard';
		shuffleQuestions: boolean;
		shuffleChoices: boolean;
		language: Language;
	};
	questions: HydratedQuestion[];
}

// ============================================
// Game Catalog (Manifest)
// ============================================

export interface GameCatalogEntry {
	id: string;
	name: Record<Language, string>;
	description?: Record<Language, string>;
	thumbnail?: string;
	languages: Language[];
	difficulty: 'easy' | 'medium' | 'hard';
	questionCount: number;
	tags?: string[];
}

export interface GameCatalog {
	version: string;
	games: GameCatalogEntry[];
}

// ============================================
// Config Loading Options
// ============================================

export interface ConfigLoadOptions {
	gameId: string;
	language?: Language;      // Defaults to current i18n language
	baseUrl?: string;         // Base URL for Activity-version content
	configUrl?: string;       // Same-origin /api/v1 exact config document override
	useCache?: boolean;       // Cache loaded configs (default: true)
}

export type TemplateGameConfig = ValidatedGameConfig;

export interface TemplateConfigBundle<TConfig = TemplateGameConfig> {
	config: TConfig;
	strings: GameStrings;
	language: Language;
	gameId: string;
	baseUrl: string;
	configUrl?: string;
}

// ============================================
// Default Values
// ============================================

export const CONFIG_DEFAULTS = {
	baseUrl: '.',
	difficulty: 'easy' as const,
	shuffleQuestions: false,
	shuffleChoices: false,
	version: '1.0.0'
};
