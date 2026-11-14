// Messages FROM parent shell TO game
export interface ActivityInitMessage {
	type: 'ACTIVITY_INIT';
	gameId: string;
	language: 'en' | 'ro';
	studentId?: string;
	muted?: boolean;
	/**
	 * Optional same-origin URL the game should fetch its config from
	 * instead of the bundled static config (e.g. teacher-authored word
	 * lists). Templates that honor this also accept `?configUrl=…` on
	 * the iframe URL — the URL param is the synchronous source of truth
	 * for the Preload scene; this field is informational/forward-compat
	 * for any future dynamic-swap scenario.
	 */
	configUrl?: string;
}

export type GameControlAction = 'pause' | 'resume' | 'restart' | 'mute' | 'unmute' | 'repeatInstruction';

export interface GameControlMessage {
	type: 'GAME_CONTROL';
	action: GameControlAction;
}

// Messages FROM game TO parent shell
export interface ActivityCapabilities {
	repeatInstruction?: boolean;
}

export interface ActivityReadyMessage {
	type: 'ACTIVITY_READY';
	gameId: string;
	capabilities?: ActivityCapabilities;
}

export interface ProgressUpdateMessage {
	type: 'PROGRESS_UPDATE';
	currentSet: number;
	totalSets: number;
	progress: number;
}

export interface GameCompleteMessage {
	type: 'GAME_COMPLETE';
	score: number;
	totalSets: number;
	timeSpent: number;
	starRating: number;
	reason: 'completed';
	/**
	 * Optional PNG dataURL of the game canvas at completion. The host shell
	 * decodes this server-side and persists it as a draft `child_artifacts`
	 * entry for teacher review (EDU-273). Capture is best-effort — the field
	 * is omitted if no canvas is available or `toDataURL` throws (e.g. on a
	 * cross-origin tainted canvas).
	 */
	screenshotDataUrl?: string;
}

// Union types
export type IncomingMessage = ActivityInitMessage | GameControlMessage;
export type OutgoingMessage = ActivityReadyMessage | ProgressUpdateMessage | GameCompleteMessage;
export type BridgeMessage = IncomingMessage | OutgoingMessage;
