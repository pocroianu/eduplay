import Phaser from 'phaser';
import Results from '../scenes/Results';
import GameManager from '../managers/GameManager';
import AudioManager from '../managers/AudioManager';
import AccessibilityManager from '../managers/AccessibilityManager';
import AssetResolver from '../services/AssetResolver';
import { GameContext, GameContextProvider } from '../context';
import { Language } from '../i18n';
import { ThemeRegistry } from '../themes';
import { BackgroundRegistry } from '../backgrounds';
import {
	clearPreviewRuntimeSettings,
	setPreviewRuntimeSettings
} from '../previewRuntime';
import { PostMessageBridge } from '../bridge';
import { resolveParentOrigin } from '../bridge/ParentOrigin';
import { getBootMascotAssets } from './BootMascotAssets';

declare global {
	interface Window {
		__PHASER_GAME__?: Phaser.Game;
		__GAME_MANAGER__?: GameManager;
		__AUDIO_MANAGER__?: AudioManager;
		__A11Y_MANAGER__?: AccessibilityManager;
		__THEME_REGISTRY__?: ThemeRegistry;
		__BACKGROUND_REGISTRY__?: BackgroundRegistry;
		__GAME_CONTEXT__?: GameContext;
		__CONTEXT_PROVIDER__?: GameContextProvider;
	}
}

export interface GameTemplateMountOptions {
	gameId?: string;
	language?: Language;
	muted?: boolean;
	basePath?: string;
	configUrl?: string;
	contextId?: string;
	width?: number;
	height?: number;
	theme?: string;
}

export interface GameDiagnosticsSnapshot {
	activeScene: string | null;
	activeScenes: string[];
	fps: number | null;
	gameId: string | null;
	language: Language | null;
	totalQuestions: number;
	currentQuestion: number;
	totalSteps: number;
	currentStep: number;
	score: number;
	isComplete: boolean;
	muted: boolean;
}

export interface GameTemplateHandle<MountOptions extends GameTemplateMountOptions = GameTemplateMountOptions> {
	readonly contextId: string;
	readonly game: Phaser.Game;
	readonly container: HTMLElement;
	getDiagnostics(): GameDiagnosticsSnapshot;
	restart(nextOptions?: MountOptions): Promise<void>;
	setMuted(muted: boolean): void;
	destroy(): void;
}

export interface GameTemplateDefinition<MountOptions extends GameTemplateMountOptions = GameTemplateMountOptions> {
	id: string;
	defaultGameId: string;
	rootElementId?: string;
	width?: number;
	height?: number;
	backgroundColor?: string;
	scenes: Phaser.Types.Scenes.SceneType[];
	resultsScene?: Phaser.Types.Scenes.SceneType;
	resolveGameId?: (options: MountOptions) => string;
}

interface RuntimeInstance<MountOptions extends GameTemplateMountOptions> {
	contextId: string;
	game: Phaser.Game;
	container: HTMLElement;
	context: GameContext;
	options: MountOptions;
	bridge: PostMessageBridge;
}

class TemplateBoot extends Phaser.Scene {
	constructor() {
		super('Boot');
	}

	preload(): void {
		for (const asset of getBootMascotAssets()) {
			this.load.image(asset.key, asset.url);
		}

		this.load.on('loaderror', (file: { key?: string }) => {
			console.warn(`[Boot] Failed to load loading-shell asset: ${file.key}`);
		});
	}

	create(): void {
		this.scene.start('Preload');
	}
}

export function defineGameTemplate<MountOptions extends GameTemplateMountOptions = GameTemplateMountOptions>(
	definition: GameTemplateDefinition<MountOptions>
): GameTemplateDefinition<MountOptions> {
	return definition;
}

export function mountGameTemplate<MountOptions extends GameTemplateMountOptions = GameTemplateMountOptions>(
	definition: GameTemplateDefinition<MountOptions>,
	container?: HTMLElement,
	initialOptions: MountOptions = {} as MountOptions
): GameTemplateHandle<MountOptions> {
	const mountTarget = ensureContainer(definition, container);
	let runtime = createRuntime(definition, mountTarget, initialOptions);

	return {
		get contextId() {
			return runtime.contextId;
		},
		get game() {
			return runtime.game;
		},
		get container() {
			return runtime.container;
		},
		getDiagnostics() {
			return getDiagnostics(runtime);
		},
		async restart(nextOptions = {} as MountOptions) {
			const mergedOptions = {
				...runtime.options,
				...nextOptions,
				contextId: undefined
			} as MountOptions;
			destroyRuntime(runtime);
			runtime = createRuntime(definition, mountTarget, mergedOptions);
		},
		setMuted(muted: boolean) {
			runtime.context.audioManager.setMusicEnabled(!muted);
			runtime.context.audioManager.setSfxEnabled(!muted);
		},
		destroy() {
			destroyRuntime(runtime);
		}
	};
}

function ensureContainer<MountOptions extends GameTemplateMountOptions>(
	definition: GameTemplateDefinition<MountOptions>,
	container?: HTMLElement
): HTMLElement {
	if (container) {
		container.innerHTML = '';
		return container;
	}

	const fallback = document.createElement('div');
	fallback.id = definition.rootElementId ?? `${definition.id}-root`;
	document.body.appendChild(fallback);
	return fallback;
}

function createContextId<MountOptions extends GameTemplateMountOptions>(
	definition: GameTemplateDefinition<MountOptions>,
	seed?: string
): string {
	if (seed) {
		return seed;
	}

	return `${definition.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function resolveGameId<MountOptions extends GameTemplateMountOptions>(
	definition: GameTemplateDefinition<MountOptions>,
	options: MountOptions
): string {
	return definition.resolveGameId?.(options)
		?? options.gameId
		?? new URLSearchParams(window.location.search).get('game')
		?? definition.defaultGameId;
}

function syncPreviewState<MountOptions extends GameTemplateMountOptions>(
	_definition: GameTemplateDefinition<MountOptions>,
	options: MountOptions,
	resolvedGameId: string
): void {
	const url = new URL(window.location.href);

	url.searchParams.set('game', resolvedGameId);

	if (options.language) {
		url.searchParams.set('lang', options.language);
	}

	window.history.replaceState({}, '', url);
}

function exposeGlobals(context: GameContext, game: Phaser.Game): void {
	window.__CONTEXT_PROVIDER__ = GameContextProvider.getInstance();
	window.__GAME_CONTEXT__ = context;
	window.__GAME_MANAGER__ = context.gameManager;
	window.__AUDIO_MANAGER__ = context.audioManager;
	window.__A11Y_MANAGER__ = context.accessibilityManager;
	window.__THEME_REGISTRY__ = ThemeRegistry.getInstance();
	window.__BACKGROUND_REGISTRY__ = BackgroundRegistry.getInstance();
	window.__PHASER_GAME__ = game;
}

function createRuntime<MountOptions extends GameTemplateMountOptions>(
	definition: GameTemplateDefinition<MountOptions>,
	container: HTMLElement,
	options: MountOptions
): RuntimeInstance<MountOptions> {
	const provider = GameContextProvider.getInstance();
	const contextId = createContextId(definition, options.contextId);
	const context = provider.createContext({ id: contextId });
	const gameId = resolveGameId(definition, options);
	provider.setActiveContext(contextId);
	AssetResolver.getInstance().clearCache();
	setPreviewRuntimeSettings({
		gameId,
		language: options.language,
		muted: options.muted,
		basePath: options.basePath,
		configUrl: options.configUrl,
		theme: options.theme
	});

	if (typeof options.muted === 'boolean') {
		context.audioManager.setMusicEnabled(!options.muted);
		context.audioManager.setSfxEnabled(!options.muted);
	}

	syncPreviewState(definition, options, gameId);

	const game = new Phaser.Game({
		type: Phaser.AUTO,
		parent: container,
		width: options.width ?? definition.width ?? 1280,
		height: options.height ?? definition.height ?? 720,
		backgroundColor: definition.backgroundColor ?? '#2f2f2f',
		scale: {
			mode: Phaser.Scale.ScaleModes.FIT,
			autoCenter: Phaser.Scale.Center.CENTER_BOTH
		},
		scene: [
			TemplateBoot,
			...definition.scenes,
			definition.resultsScene ?? Results
		]
	});

	game.scene.start('Boot');
	exposeGlobals(context, game);

	const urlParams = new URLSearchParams(window.location.search);
	const bridge = new PostMessageBridge({
		gameManager: context.gameManager,
		gameId,
		targetOrigin: resolveParentOrigin({ explicitOrigin: urlParams.get('origin') }),
		controlHandlers: {
			pause: () => pauseActiveScenes(game),
			resume: () => resumeActiveScenes(game),
			mute: () => {
				context.audioManager.setMusicEnabled(false);
				context.audioManager.setSfxEnabled(false);
			},
			unmute: () => {
				context.audioManager.setMusicEnabled(true);
				context.audioManager.setSfxEnabled(true);
			},
		}
	});
	bridge.start();

	return {
		contextId,
		game,
		container,
		context,
		options: { ...options },
		bridge
	};
}

function pauseActiveScenes(game: Phaser.Game): void {
	for (const scene of game.scene.getScenes(true)) {
		scene.tweens?.pauseAll();
	}
}

function resumeActiveScenes(game: Phaser.Game): void {
	for (const scene of game.scene.getScenes(true)) {
		scene.tweens?.resumeAll();
	}
}

function destroyRuntime<MountOptions extends GameTemplateMountOptions>(runtime: RuntimeInstance<MountOptions>): void {
	runtime.bridge.destroy();
	runtime.game.destroy(true);

	const provider = GameContextProvider.getInstance();
	provider.destroyContext(runtime.contextId);

	if (window.__PHASER_GAME__ === runtime.game) {
		delete window.__PHASER_GAME__;
		delete window.__GAME_MANAGER__;
		delete window.__AUDIO_MANAGER__;
		delete window.__A11Y_MANAGER__;
		delete window.__GAME_CONTEXT__;
	}
	clearPreviewRuntimeSettings();

	runtime.container.innerHTML = '';
}

function getDiagnostics<MountOptions extends GameTemplateMountOptions>(
	runtime: RuntimeInstance<MountOptions>
): GameDiagnosticsSnapshot {
	const activeScenes = runtime.game.scene
		.getScenes(true)
		.map((scene) => scene.scene.key);
	const state = runtime.context.gameManager.getState();
	const config = runtime.context.gameManager.getConfig();
	const totalQuestions = runtime.context.gameManager.getTotalQuestions();
	const totalSteps = config?.meta.totalSteps ?? totalQuestions;
	const currentQuestion = totalQuestions > 0 ? state.currentQuestionIndex + 1 : 0;
	const currentStep = totalQuestions > 0
		? currentQuestion
		: runtime.context.gameManager.isGameComplete()
			? totalSteps
			: 0;

	return {
		activeScene: activeScenes[0] ?? null,
		activeScenes,
		fps: runtime.game.loop?.actualFps ?? null,
		gameId: config?.meta.gameId ?? runtime.options.gameId ?? new URLSearchParams(window.location.search).get('game'),
		language: (new URLSearchParams(window.location.search).get('lang') as Language | null) ?? null,
		totalQuestions,
		currentQuestion,
		totalSteps,
		currentStep,
		score: state.score,
		isComplete: runtime.context.gameManager.isGameComplete(),
		muted: runtime.context.audioManager.isMuted()
	};
}
