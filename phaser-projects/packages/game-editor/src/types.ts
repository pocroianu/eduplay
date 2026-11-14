export type EditorLanguage = string;

export interface EditorCatalogEntry {
	id: string;
	name: Record<string, string>;
	description?: Record<string, string>;
	thumbnail?: string;
	languages: EditorLanguage[];
	difficulty: string;
	questionCount?: number;
	pairCount?: number;
	itemCount?: number;
	roundCount?: number;
	tags?: string[];
}

export interface EditorCatalog {
	version: string;
	games: EditorCatalogEntry[];
}

export interface EditorMountOptions {
	gameId?: string;
	language?: EditorLanguage;
	muted?: boolean;
	theme?: string;
	contextId?: string;
	width?: number;
	height?: number;
	basePath?: string;
}

export interface EditorDiagnosticsSnapshot {
	activeScene: string | null;
	activeScenes: string[];
	fps: number | null;
	gameId: string | null;
	language: EditorLanguage | null;
	totalQuestions: number;
	currentQuestion: number;
	totalSteps?: number;
	currentStep?: number;
	score: number;
	isComplete: boolean;
	muted: boolean;
}

export interface EditorGameHandle {
	readonly contextId: string;
	readonly container: HTMLElement;
	getDiagnostics(): EditorDiagnosticsSnapshot;
	restart(nextOptions?: EditorMountOptions): Promise<void>;
	setMuted(muted: boolean): void;
	destroy(): void;
}

export interface EditorDefaultState {
	gameId: string;
	language: EditorLanguage;
	muted: boolean;
	theme?: string;
}

export interface EditorGameAdapter {
	id: string;
	label: string;
	description: string;
	templateBasePath: string;
	catalogUrl: string;
	defaultState: EditorDefaultState;
	mount(container: HTMLElement, options: EditorMountOptions): EditorGameHandle;
}

export interface CreateGameEditorOptions {
	root: HTMLElement;
	adapters: EditorGameAdapter[];
	storageKey?: string;
}
