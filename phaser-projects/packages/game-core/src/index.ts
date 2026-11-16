// packages/game-core/src/index.ts

// Side-effect registrations — must run before any theme/background is used
import './themes';
import './backgrounds';

// Scenes
export { default as Preload } from './scenes/Preload';
export { default as Results } from './scenes/Results';

// Managers
export { default as GameManager } from './managers/GameManager';
export type {
	ActivityConfig,
	SyntheticActivityConfig,
	ActivityResultsData,
	CreateResultsDataOptions,
	CompleteActivityOptions,
	CompleteStepOptions,
	ActivityProgressPayload,
	ActivityCompletePayload,
} from './managers/GameManager';
export { default as AudioManager } from './managers/AudioManager';
export { default as AccessibilityManager } from './managers/AccessibilityManager';

// Services
export { default as ConfigLoader } from './services/ConfigLoader';
export { default as AssetResolver } from './services/AssetResolver';

// Prefabs
export { default as AnimatedBackground } from './prefabs/AnimatedBackground';
export { default as AudioControls } from './prefabs/AudioControls';
export { default as BottomNavbar } from './prefabs/BottomNavbar';
export { default as FeedbackOverlay } from './prefabs/FeedbackOverlay';
export { default as LanguageSelector } from './prefabs/LanguageSelector';
export { default as ProgressIndicator } from './prefabs/ProgressIndicator';

// Themes
export * from './themes';

// Backgrounds
export * from './backgrounds';

// Context
export { GameContextProvider, getActiveGameContext } from './context';
export type { GameContext, GameContextId, GameContextOptions, GameContextData } from './context';

// Types
export * from './types/GameConfig';
// ConfigSchema re-exported explicitly to avoid duplicate 'ChoiceType' (also in GameConfig)
export type {
	BaseChoice,
	BaseQuestion,
	BaseGameConfig,
	GameStrings,
	HydratedQuestion,
	HydratedGameConfig,
	GameCatalogEntry,
	GameCatalog,
	ConfigLoadOptions,
	TemplateGameConfig,
	TemplateConfigBundle,
} from './types/ConfigSchema';
export { CONFIG_DEFAULTS } from './types/ConfigSchema';
export * from './types/AssetSchema';

// Utils
export * from './utils/GraphicsUtils';
// FontLoader has no default export — use named exports only
export * from './utils/FontLoader';

// i18n
export * from './i18n';

// Templates
export {
	defineGameTemplate,
	mountGameTemplate,
} from './templates/GameTemplateRuntime';
export {
	resolveTemplateAudioAssets,
	resolveTemplateImageAssets,
} from './templates/TemplateAssetPreload';
export type {
	GameTemplateDefinition,
	GameTemplateMountOptions,
	GameTemplateHandle,
	GameDiagnosticsSnapshot,
} from './templates/GameTemplateRuntime';

// Bridge
export { PostMessageBridge } from './bridge';
export type { PostMessageBridgeOptions } from './bridge';
export type {
	ActivityInitMessage,
	GameControlMessage,
	ProgressUpdateMessage,
	GameCompleteMessage,
	ActivityReadyMessage,
	IncomingMessage,
	OutgoingMessage,
	BridgeMessage,
} from './bridge/types';

// Preview runtime
export * from './previewRuntime';

// Runtime config URL
export * from './runtimeConfig';
export { preloadActivity, type ActivityPreloadOptions } from './templates/ActivityPreload';
