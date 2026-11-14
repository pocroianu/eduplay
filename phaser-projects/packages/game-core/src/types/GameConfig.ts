/**
 * Game Configuration Types for Multiple-Choice Educational Game
 */

// ============================================
// Theme Configuration
// ============================================

/**
 * Background style name (extensible)
 * Built-in styles: 'hills', 'ocean', 'space', 'candy', 'forest', 'sunset', 'default'
 * Custom styles can be registered at runtime via BackgroundRegistry
 */
export type BackgroundStyle = string;

export interface ThemeConfig {
	primary: number;
	secondary: number;
	background: number;
	cardBg: number;
	textColor: string;
	// Container colors (for question display and choice cards)
	containerBg?: number;        // Background for containers (default: white)
	containerText?: string;      // Text color in containers (default: dark)
	containerBorder?: number;    // Border color for containers
	// Background style
	backgroundStyle?: BackgroundStyle;
	// Optional extended theme colors for feedback
	correctColor?: number;
	incorrectColor?: number;
	starColor?: number;
	// Theme mascot
	mascotKey?: string;
	mascotDisplayName?: string;
}

// ============================================
// Question & Choice Types
// ============================================

export type ChoiceType = 'text' | 'image' | 'audio';

export interface QuestionChoice {
	type: ChoiceType;
	value: string;
	isCorrect: boolean;
	label?: string;        // Optional label for accessibility
}

export interface QuestionContent {
	text: string;
	audio?: string;        // Audio key for question narration
	image?: string;        // Optional image to accompany question
}

export interface Question {
	id: string;
	question: QuestionContent;
	choices: QuestionChoice[];
	timeLimit?: number;    // Optional time limit in seconds
	points?: number;       // Points for correct answer (default: 1)
}

// ============================================
// Game Metadata
// ============================================

export interface GameMeta {
	gameId: string;
	totalSteps: number;
	theme: ThemeConfig;
	title?: string;
	description?: string;
	difficulty?: 'easy' | 'medium' | 'hard';
	shuffleQuestions?: boolean;
	shuffleChoices?: boolean;
}

// ============================================
// Main Game Configuration
// ============================================

export interface GameConfig {
	meta: GameMeta;
	questions: Question[];
}

// ============================================
// Game State Types
// ============================================

export interface QuestionResult {
	questionId: string;
	selectedChoiceIndex: number;
	isCorrect: boolean;
	timeSpent?: number;
	attempts: number;
}

export interface GameState {
	currentQuestionIndex: number;
	score: number;
	results: QuestionResult[];
	startTime: number;
	isComplete: boolean;
}

// ============================================
// Feedback Types for Visual Responses
// ============================================

export type FeedbackType = 'correct' | 'incorrect' | 'timeout' | 'hint';

export interface FeedbackConfig {
	type: FeedbackType;
	message?: string;
	duration?: number;
	showParticles?: boolean;
	playSound?: boolean;
}

// ============================================
// Animation Presets for Kid-Friendly Feedback
// ============================================

export interface AnimationPreset {
	scale?: { from: number; to: number };
	duration?: number;
	ease?: string;
	yoyo?: boolean;
	repeat?: number;
}

export const ANIMATION_PRESETS = {
	bounce: {
		scale: { from: 1, to: 1.15 },
		duration: 150,
		ease: 'Back.easeOut',
		yoyo: true,
		repeat: 0
	},
	wiggle: {
		duration: 100,
		ease: 'Sine.easeInOut',
		yoyo: true,
		repeat: 2
	},
	pop: {
		scale: { from: 0, to: 1 },
		duration: 300,
		ease: 'Back.easeOut'
	},
	celebrate: {
		scale: { from: 1, to: 1.3 },
		duration: 200,
		ease: 'Bounce.easeOut',
		yoyo: true,
		repeat: 1
	},
	shake: {
		duration: 50,
		ease: 'Sine.easeInOut',
		yoyo: true,
		repeat: 3
	}
} as const;

// ============================================
// Default Theme
// ============================================

export const DEFAULT_THEME: ThemeConfig = {
	primary: 0x4F46E5,
	secondary: 0x10B981,
	background: 0x1F2937,
	cardBg: 0x374151,
	textColor: '#FFFFFF',
	correctColor: 0x22C55E,
	incorrectColor: 0xEF4444,
	starColor: 0xFBBF24
};
