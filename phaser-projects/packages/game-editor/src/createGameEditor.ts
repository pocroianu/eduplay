import {
	CreateGameEditorOptions,
	EditorCatalog,
	EditorDiagnosticsSnapshot,
	EditorGameAdapter,
	EditorGameHandle,
	EditorLanguage
} from "./types";
import { createCustomDropdown, CustomDropdown, DropdownOption } from "./customDropdown";

interface EditorState {
	adapterId: string;
	gameId: string;
	language: EditorLanguage;
	muted: boolean;
	theme: string;
}

interface EditorRefs {
	adapterDropdown: CustomDropdown;
	gameDropdown: CustomDropdown;
	languageDropdown: CustomDropdown;
	themeDropdown: CustomDropdown;
	muteButton: HTMLButtonElement;
	restartButton: HTMLButtonElement;
	fullscreenButton: HTMLButtonElement;
	metricsToggle: HTMLButtonElement;
	metricsHud: HTMLElement;
	fpsValue: HTMLElement;
	sceneValue: HTMLElement;
	progressValue: HTMLElement;
	scoreValue: HTMLElement;
	viewport: HTMLElement;
	stageMount: HTMLElement;
}

const DEFAULT_STORAGE_KEY = "submerged-studio-editor-state";
const LANGUAGE_LABELS: Record<string, string> = {
	en: "English",
	ro: "Română"
};
// Must stay in sync with the ThemeRegistry built-in themes in packages/game-core/src/themes/index.ts
const THEME_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: 'nature',  label: 'Nature' },
	{ value: 'ocean',   label: 'Ocean' },
	{ value: 'space',   label: 'Space' },
	{ value: 'candy',   label: 'Candy' },
	{ value: 'forest',  label: 'Forest' },
	{ value: 'sunset',  label: 'Sunset' },
	{ value: 'default', label: 'Default' }
];

function resolveAdapterBasePath(adapter: EditorGameAdapter, gameId: string): string {
	return `${adapter.templateBasePath.replace(/\/+$/, '')}/${gameId}/versions/1`;
}

async function fetchGameTheme(adapter: EditorGameAdapter, gameId: string): Promise<string> {
	try {
		const basePath = resolveAdapterBasePath(adapter, gameId);
		const response = await fetch(`${basePath}/config.json`);
		if (!response.ok) return 'default';
		const config = await response.json() as { meta?: { themeName?: string } };
		return config.meta?.themeName ?? 'default';
	} catch {
		return 'default';
	}
}

function renderShell(root: HTMLElement, dropdowns: {
	adapter: CustomDropdown;
	game: CustomDropdown;
	language: CustomDropdown;
	theme: CustomDropdown;
}): EditorRefs {
	root.innerHTML = `
		<div class="editor-shell">
			<div class="editor-toolbar" role="toolbar" aria-label="Game preview controls">
				<div class="editor-toolbar__dropdowns"></div>
				<div class="editor-toolbar__actions">
					<button type="button" class="toolbar-action" data-role="mute-button" aria-label="Mute audio" title="Mute audio" tabindex="-1">
						<span class="material-symbols-outlined" aria-hidden="true">volume_up</span>
					</button>
					<button type="button" class="toolbar-action" data-role="restart-button" aria-label="Restart game" title="Restart game" tabindex="-1">
						<span class="material-symbols-outlined" aria-hidden="true">replay</span>
					</button>
					<button type="button" class="toolbar-action" data-role="fullscreen-button" aria-label="Toggle fullscreen" title="Toggle fullscreen" tabindex="-1">
						<span class="material-symbols-outlined" aria-hidden="true">fullscreen</span>
					</button>
					<button type="button" class="toolbar-action" data-role="metrics-toggle" aria-label="Toggle metrics" title="Toggle metrics" tabindex="-1">
						<span class="material-symbols-outlined" aria-hidden="true">monitoring</span>
					</button>
				</div>
			</div>

			<div class="editor-viewport">
				<div class="editor-viewport__frame">
					<div class="editor-viewport__mount" data-role="stage-mount"></div>
				</div>

				<div class="metrics-hud" data-role="metrics-hud" aria-label="Game diagnostics" hidden>
					<div class="metrics-hud__item">
						<span class="metrics-hud__label">FPS</span>
						<span class="metrics-hud__value" data-role="fps-value">--</span>
					</div>
					<div class="metrics-hud__item">
						<span class="metrics-hud__label">Scene</span>
						<span class="metrics-hud__value" data-role="scene-value">--</span>
					</div>
					<div class="metrics-hud__item">
						<span class="metrics-hud__label">Progress</span>
						<span class="metrics-hud__value" data-role="progress-value">--</span>
					</div>
					<div class="metrics-hud__item">
						<span class="metrics-hud__label">Score</span>
						<span class="metrics-hud__value" data-role="score-value">--</span>
					</div>
				</div>
			</div>
		</div>
	`;

	const query = <T extends Element>(selector: string): T => {
		const element = root.querySelector<T>(selector);
		if (!element) {
			throw new Error(`Missing required element: ${selector}`);
		}
		return element;
	};

	// Mount dropdown containers into toolbar
	const dropdownsContainer = query<HTMLElement>(".editor-toolbar__dropdowns");
	dropdownsContainer.append(
		dropdowns.adapter.container,
		dropdowns.game.container,
		dropdowns.language.container,
		dropdowns.theme.container
	);

	return {
		adapterDropdown: dropdowns.adapter,
		gameDropdown: dropdowns.game,
		languageDropdown: dropdowns.language,
		themeDropdown: dropdowns.theme,
		muteButton: query("[data-role='mute-button']"),
		restartButton: query("[data-role='restart-button']"),
		fullscreenButton: query("[data-role='fullscreen-button']"),
		metricsToggle: query("[data-role='metrics-toggle']"),
		metricsHud: query("[data-role='metrics-hud']"),
		fpsValue: query("[data-role='fps-value']"),
		sceneValue: query("[data-role='scene-value']"),
		progressValue: query("[data-role='progress-value']"),
		scoreValue: query("[data-role='score-value']"),
		viewport: query(".editor-viewport"),
		stageMount: query("[data-role='stage-mount']")
	};
}

function getAdapter(adapters: EditorGameAdapter[], adapterId: string): EditorGameAdapter {
	return adapters.find((adapter) => adapter.id === adapterId) ?? adapters[0];
}

function readStateFromUrl(): Partial<EditorState> {
	const params = new URLSearchParams(window.location.search);
	const adapterId = params.get("adapter") ?? undefined;
	const gameId = params.get("game") ?? undefined;
	const language = params.get("lang") ?? undefined;
	const muted = params.get("muted");
	const theme = params.get("theme") ?? undefined;

	return {
		adapterId,
		gameId,
		language,
		muted: muted === "1" ? true : muted === "0" ? false : undefined,
		theme
	};
}

function readStateFromSession(storageKey: string): Partial<EditorState> {
	try {
		const raw = window.sessionStorage.getItem(storageKey);
		return raw ? JSON.parse(raw) as Partial<EditorState> : {};
	} catch {
		return {};
	}
}

function writeState(storageKey: string, state: EditorState): void {
	const url = new URL(window.location.href);
	url.searchParams.set("adapter", state.adapterId);
	url.searchParams.set("game", state.gameId);
	url.searchParams.set("lang", state.language);
	url.searchParams.set("muted", state.muted ? "1" : "0");
	url.searchParams.set("theme", state.theme);
	window.history.replaceState({}, "", url);
	window.sessionStorage.setItem(storageKey, JSON.stringify(state));
}

async function loadCatalog(url: string): Promise<EditorCatalog> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to load catalog from ${url}`);
	}

	return response.json() as Promise<EditorCatalog>;
}

function updateDiagnostics(refs: EditorRefs, snapshot: EditorDiagnosticsSnapshot): void {
	refs.fpsValue.textContent = snapshot.fps ? snapshot.fps.toFixed(1) : "--";
	refs.sceneValue.textContent = snapshot.activeScene ?? "Launching";
	const totalProgress = snapshot.totalSteps ?? snapshot.totalQuestions;
	const currentProgress = snapshot.currentStep ?? snapshot.currentQuestion;
	refs.progressValue.textContent = totalProgress > 0
		? `${Math.min(currentProgress, totalProgress)} / ${totalProgress}`
		: "--";
	refs.scoreValue.textContent = String(snapshot.score);
}

function toggleFullscreen(target: HTMLElement): void {
	if (document.fullscreenElement) {
		void document.exitFullscreen();
		return;
	}

	void target.requestFullscreen();
}

function formatLanguageLabel(language: EditorLanguage | null | undefined): string {
	if (!language) {
		return "--";
	}

	const normalizedLanguage = language.toLowerCase();
	const knownLabel = LANGUAGE_LABELS[normalizedLanguage];

	if (knownLabel) {
		return knownLabel;
	}

	try {
		const locales = [document.documentElement.lang || "en", "en"];
		const displayNames = new Intl.DisplayNames(locales, { type: "language" });
		const label = displayNames.of(normalizedLanguage);
		if (label) {
			return label.charAt(0).toUpperCase() + label.slice(1);
		}
	} catch {
		// Fallback below when Intl.DisplayNames is unavailable.
	}

	return language.toUpperCase();
}

function formatDifficultyLabel(difficulty: string): string {
	return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}

function formatCatalogCount(entry: EditorCatalog["games"][number]): string {
	if (typeof entry.questionCount === "number") {
		return `${entry.questionCount} ${entry.questionCount === 1 ? "question" : "questions"}`;
	}
	if (typeof entry.pairCount === "number") {
		return `${entry.pairCount} ${entry.pairCount === 1 ? "pair" : "pairs"}`;
	}
	if (typeof entry.itemCount === "number") {
		return `${entry.itemCount} ${entry.itemCount === 1 ? "item" : "items"}`;
	}
	if (typeof entry.roundCount === "number") {
		return `${entry.roundCount} ${entry.roundCount === 1 ? "round" : "rounds"}`;
	}
	return "--";
}

function setActionButtonState(button: HTMLButtonElement, icon: string, label: string): void {
	button.setAttribute("aria-label", label);
	button.title = label;
	button.innerHTML = `
		<span class="material-symbols-outlined" aria-hidden="true">${icon}</span>
	`;
}

export async function createGameEditor(options: CreateGameEditorOptions): Promise<void> {
	const { root, adapters, storageKey = DEFAULT_STORAGE_KEY } = options;
	if (adapters.length === 0) {
		throw new Error("createGameEditor requires at least one adapter");
	}

	const fromUrl = readStateFromUrl();
	const fromSession = readStateFromSession(storageKey);
	let adapter = getAdapter(adapters, fromUrl.adapterId ?? fromSession.adapterId ?? adapters[0].id);
	let state: EditorState = {
		adapterId: adapter.id,
		gameId: fromUrl.gameId ?? fromSession.gameId ?? adapter.defaultState.gameId,
		language: fromUrl.language ?? fromSession.language ?? adapter.defaultState.language,
		muted: fromUrl.muted ?? fromSession.muted ?? adapter.defaultState.muted,
		theme: 'default'
	};
	let catalog = await loadCatalog(adapter.catalogUrl);
	// Restore persisted theme or auto-detect from config
	state.theme = fromUrl.theme ?? (fromSession as Partial<EditorState>).theme
		?? await fetchGameTheme(adapter, state.gameId);
	let gameHandle: EditorGameHandle | null = null;
	let diagnosticsTimer: number | null = null;

	// Create custom dropdowns
	const adapterDropdown = createCustomDropdown({
		icon: "list_alt",
		label: "Template",
		ariaLabel: "Select game template",
		onChange: async (value) => {
			try {
				adapter = getAdapter(adapters, value);
				state = {
					adapterId: adapter.id,
					...adapter.defaultState,
					theme: adapter.defaultState.theme ?? ''
				};
				catalog = await loadCatalog(adapter.catalogUrl);
				state.theme = await fetchGameTheme(adapter, state.gameId);
				syncUi();
				await remount(true);
			} catch (err) {
				console.error("Failed to switch template:", err);
			}
		}
	});

	const gameDropdown = createCustomDropdown({
		icon: "quiz",
		label: "Scenario",
		ariaLabel: "Select game scenario",
		wide: true,
		onChange: async (value) => {
			try {
				state.gameId = value;
				state.theme = await fetchGameTheme(adapter, value);
				syncUi();
				await remount(true);
			} catch (err) {
				console.error("Failed to switch scenario:", err);
			}
		}
	});

	const languageDropdown = createCustomDropdown({
		icon: "language",
		label: "Language",
		ariaLabel: "Select language",
		onChange: async (value) => {
			try {
				state.language = value;
				syncUi();
				await remount(true);
			} catch (err) {
				console.error("Failed to switch language:", err);
			}
		}
	});

	const themeDropdown = createCustomDropdown({
		icon: "palette",
		label: "Theme",
		ariaLabel: "Select theme",
		onChange: async (value) => {
			try {
				state.theme = value;
				syncUi();
				await remount(true);
			} catch (err) {
				console.error("Failed to switch theme:", err);
			}
		}
	});

	const refs = renderShell(root, {
		adapter: adapterDropdown,
		game: gameDropdown,
		language: languageDropdown,
		theme: themeDropdown
	});

	// Metrics HUD toggle
	let metricsVisible = sessionStorage.getItem("editor-metrics-visible") === "1";
	function applyMetricsVisibility(): void {
		refs.metricsHud.hidden = !metricsVisible;
		sessionStorage.setItem("editor-metrics-visible", metricsVisible ? "1" : "0");
	}
	applyMetricsVisibility();

	refs.metricsToggle.addEventListener("click", () => {
		metricsVisible = !metricsVisible;
		applyMetricsVisibility();
	});

	const remount = async (forceNewHandle = false): Promise<void> => {
		if (forceNewHandle && gameHandle) {
			gameHandle.destroy();
			gameHandle = null;
		}

		const mountOptions = {
			gameId: state.gameId,
			language: state.language,
			muted: state.muted,
			basePath: resolveAdapterBasePath(adapter, state.gameId),
			theme: state.theme || undefined
		};

		if (!gameHandle) {
			gameHandle = adapter.mount(refs.stageMount, mountOptions);
		} else {
			await gameHandle.restart(mountOptions);
		}

		gameHandle.setMuted(state.muted);
		updateDiagnostics(refs, gameHandle.getDiagnostics());

		if (diagnosticsTimer !== null) {
			window.clearInterval(diagnosticsTimer);
		}

		diagnosticsTimer = window.setInterval(() => {
			if (gameHandle) {
				updateDiagnostics(refs, gameHandle.getDiagnostics());
			}
		}, 500);
	};

	const syncUi = (): void => {
		const currentEntry = catalog.games.find((entry) => entry.id === state.gameId) ?? catalog.games[0];
		if (currentEntry) {
			state.gameId = currentEntry.id;
			if (!currentEntry.languages.includes(state.language)) {
				state.language = currentEntry.languages[0];
			}
		}

		// Update adapter dropdown
		const adapterOptions: DropdownOption[] = adapters.map((a) => ({
			value: a.id,
			label: a.label
		}));
		refs.adapterDropdown.setOptions(adapterOptions, state.adapterId);

		// Update game dropdown with secondary text
		const gameOptions: DropdownOption[] = catalog.games.map((entry) => ({
			value: entry.id,
			label: entry.name[state.language] ?? entry.name.en ?? entry.id,
			secondaryText: `${formatCatalogCount(entry)} \u00b7 ${formatDifficultyLabel(entry.difficulty)}`
		}));
		refs.gameDropdown.setOptions(gameOptions, state.gameId);

		// Update language dropdown
		const languages = currentEntry?.languages ?? ["en", "ro"];
		const languageOptions: DropdownOption[] = languages.map((lang) => ({
			value: lang,
			label: formatLanguageLabel(lang)
		}));
		refs.languageDropdown.setOptions(languageOptions, state.language);

		// Update theme dropdown
		refs.themeDropdown.setOptions(THEME_OPTIONS, state.theme || 'default');

		setActionButtonState(
			refs.muteButton,
			state.muted ? "volume_off" : "volume_up",
			state.muted ? "Unmute audio" : "Mute audio"
		);

		writeState(storageKey, state);
	};

	refs.muteButton.addEventListener("click", () => {
		state.muted = !state.muted;
		gameHandle?.setMuted(state.muted);
		syncUi();
		if (gameHandle) {
			updateDiagnostics(refs, gameHandle.getDiagnostics());
		}
	});

	refs.restartButton.addEventListener("click", async () => {
		await remount();
	});

	refs.fullscreenButton.addEventListener("click", () => {
		toggleFullscreen(refs.viewport);
	});

	window.addEventListener("beforeunload", () => {
		if (diagnosticsTimer !== null) {
			window.clearInterval(diagnosticsTimer);
		}
		gameHandle?.destroy();
	});

	syncUi();
	await remount();
}
