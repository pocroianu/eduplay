import GameManager from '../managers/GameManager';
import type {
	ActivityInitMessage,
	GameControlMessage,
	OutgoingMessage,
	ProgressUpdateMessage,
	GameCompleteMessage,
	ActivityReadyMessage,
	GameControlAction,
} from './types';
import {
	captureScreenshotDataUrl,
	type ScreenshotCanvas,
	type ScreenshotRenderer,
} from './ScreenshotCapture';
import { isTrustedParentOrigin, resolveParentOrigin } from './ParentOrigin';

export interface PostMessageBridgeOptions {
	gameManager: GameManager;
	gameId: string;
	targetOrigin?: string;
	controlHandlers?: Partial<Record<GameControlAction, () => void>>;
	/**
	 * Returns the canvas element used to capture a `screenshotDataUrl` on
	 * GAME_COMPLETE. If omitted, the bridge falls back to the first
	 * `<canvas>` in the document. Provide this when the document hosts more
	 * than one canvas to avoid grabbing the wrong one.
	 */
	getCanvas?: () => ScreenshotCanvas | null;
	/**
	 * Returns the active Phaser renderer. When available, screenshots are captured
	 * through Phaser's post-render snapshot API so WebGL games do not persist a
	 * blank back buffer.
	 */
	getRenderer?: () => ScreenshotRenderer | null;
}

const GAME_CONTROL_ACTIONS = new Set<GameControlAction>([
	'pause',
	'resume',
	'restart',
	'mute',
	'unmute',
	'repeatInstruction',
]);

function isGameControlAction(action: unknown): action is GameControlAction {
	return typeof action === 'string' && GAME_CONTROL_ACTIONS.has(action as GameControlAction);
}

type EventCleanup = { event: string; fn: (...args: unknown[]) => void };

type ActivityStepPayload = {
	currentStep?: number;
	completedSteps?: number;
	totalSteps?: number;
	rawScore?: number;
	maxScore?: number;
	scorePercent?: number;
};

type CompletionPayload = {
	score: number;
	rawScore?: number;
	maxScore?: number;
	scorePercent?: number;
	totalQuestions?: number;
	totalSteps?: number;
	completedSteps?: number;
	results?: unknown[];
	timeSpent: number;
	starRating?: number;
};

export class PostMessageBridge {
	private readonly gameManager: GameManager;
	private readonly gameId: string;
	private readonly targetOrigin: string;
	private readonly isIframe: boolean;
	private readonly listeners: EventCleanup[] = [];
	private readonly getCanvas: () => ScreenshotCanvas | null;
	private readonly getRenderer: () => ScreenshotRenderer | null;
	private readonly controlHandlers: Partial<Record<GameControlAction, () => void>>;
	private messageHandler: ((event: MessageEvent) => void) | null = null;

	// Track current question state for legacy SCORE_UPDATED (which only emits a number)
	private currentSet = 0;
	private totalSets = 0;
	private activityModeActive = false;

	constructor(options: PostMessageBridgeOptions) {
		this.gameManager = options.gameManager;
		this.gameId = options.gameId;
		this.targetOrigin = resolveParentOrigin({ explicitOrigin: options.targetOrigin }) ?? '';
		this.isIframe = typeof window !== 'undefined' && window !== window.parent;
		this.getCanvas = options.getCanvas ?? (() => {
			if (typeof document === 'undefined') return null;
			return document.querySelector<HTMLCanvasElement>('canvas');
		});
		this.getRenderer = options.getRenderer ?? (() => null);
		this.controlHandlers = options.controlHandlers ?? {};
	}

	start(): void {
		if (!this.isIframe) {
			console.log('PostMessageBridge: standalone mode, skipping');
			return;
		}

		const gm = this.gameManager;
		this.activityModeActive = gm.hasActivity();

		this.on(GameManager.EVENTS.ACTIVITY_LOADED, () => {
			this.activityModeActive = true;
		});

		this.on(GameManager.EVENTS.ACTIVITY_CAPABILITIES_UPDATED, () => {
			this.sendActivityReadyMessage();
		});

		this.on(GameManager.EVENTS.STEP_STARTED, () => {
			this.activityModeActive = true;
		});

		// STEP_COMPLETED → canonical completion-based ProgressUpdateMessage
		this.on(GameManager.EVENTS.STEP_COMPLETED, (data: ActivityStepPayload) => {
			this.activityModeActive = true;
			const totalSets = data.totalSteps ?? 0;
			const currentSet = data.completedSteps ?? data.currentStep ?? 0;

			const msg: ProgressUpdateMessage = {
				type: 'PROGRESS_UPDATE',
				currentSet,
				totalSets,
				progress: totalSets > 0 ? currentSet / totalSets : 0,
			};
			this.send(msg);
		});

		// ACTIVITY_COMPLETE → canonical GameCompleteMessage
		this.on(
			GameManager.EVENTS.ACTIVITY_COMPLETE,
			(data: CompletionPayload) => {
				this.activityModeActive = true;
				void this.sendGameCompleteMessage(data);
			},
		);

		// QUESTION_STARTED → legacy fallback ProgressUpdateMessage
		this.on(GameManager.EVENTS.QUESTION_STARTED, (data: { question: unknown; index: number; total: number }) => {
			if (this.activityModeActive) return;

			this.currentSet = data.index + 1;
			this.totalSets = data.total;

			const msg: ProgressUpdateMessage = {
				type: 'PROGRESS_UPDATE',
				currentSet: this.currentSet,
				totalSets: this.totalSets,
				progress: data.total > 0 ? data.index / data.total : 0,
			};
			this.send(msg);
		});

		// SCORE_UPDATED → legacy fallback ProgressUpdateMessage with score
		this.on(GameManager.EVENTS.SCORE_UPDATED, (score: number) => {
			if (this.activityModeActive) return;

			const total = gm.getTotalQuestions();
			const totalSets = total || this.totalSets;
			const currentSet = this.currentSet || (gm.getCurrentQuestionIndex() + 1);

			const msg: ProgressUpdateMessage = {
				type: 'PROGRESS_UPDATE',
				currentSet,
				totalSets,
				progress: totalSets > 0 ? currentSet / totalSets : 0,
			};
			this.send(msg);
		});

		// GAME_COMPLETE → legacy fallback/alias GameCompleteMessage
		this.on(
			GameManager.EVENTS.GAME_COMPLETE,
			(data: CompletionPayload) => {
				if (this.activityModeActive) return;
				void this.sendGameCompleteMessage(data);
			},
		);

		// Listen for incoming messages from parent
		this.messageHandler = (event: MessageEvent) => {
			if (!isTrustedParentOrigin(event.origin, this.targetOrigin)) return;

			const data = event.data;
			if (!data || typeof data.type !== 'string') return;

			switch (data.type) {
				case 'ACTIVITY_INIT':
					this.handleActivityInit(data as ActivityInitMessage);
					break;
				case 'GAME_CONTROL':
					this.handleGameControl(data as GameControlMessage);
					break;
			}
		};
		window.addEventListener('message', this.messageHandler);

		// Send ACTIVITY_READY to parent
		this.sendActivityReadyMessage();
	}

	private on(event: string, fn: (...args: any[]) => void): void {
		this.gameManager.on(event, fn);
		this.listeners.push({ event, fn });
	}

	private send(message: OutgoingMessage): void {
		if (!this.targetOrigin) return;
		window.parent.postMessage(message, this.targetOrigin);
	}

	private sendActivityReadyMessage(): void {
		const capabilities = this.gameManager.getActivityCapabilities();
		const readyMsg: ActivityReadyMessage = {
			type: 'ACTIVITY_READY',
			gameId: this.gameId,
			...(Object.keys(capabilities).length ? { capabilities } : {}),
		};
		this.send(readyMsg);
	}

	private resolveScorePercent(data: {
		scorePercent?: number;
		rawScore?: number;
		score?: number;
		maxScore?: number;
		totalQuestions?: number;
		totalSteps?: number;
	}): number {
		if (typeof data.scorePercent === 'number' && Number.isFinite(data.scorePercent)) {
			return this.clampScorePercent(data.scorePercent);
		}

		const rawScore = data.rawScore ?? data.score ?? 0;
		const fallbackQuestionMax = data.totalQuestions && data.totalQuestions > 0 ? data.totalQuestions : undefined;
		const fallbackStepMax = data.totalSteps && data.totalSteps > 0 ? data.totalSteps : undefined;
		const maxScore = data.maxScore ?? fallbackQuestionMax ?? fallbackStepMax ?? 0;
		return maxScore > 0 ? this.clampScorePercent((rawScore / maxScore) * 100) : 0;
	}

	private clampScorePercent(value: number): number {
		return Math.max(0, Math.min(100, Math.round(value)));
	}

	private calculateStarRating(scorePercent: number): number {
		if (scorePercent >= 90) return 3;
		if (scorePercent >= 70) return 2;
		if (scorePercent >= 50) return 1;
		return 0;
	}

	private async sendGameCompleteMessage(
		data: CompletionPayload,
	): Promise<void> {
		const screenshotDataUrl = await captureScreenshotDataUrl({
			targetOrigin: this.targetOrigin,
			getRenderer: this.getRenderer,
			getCanvas: this.getCanvas,
		});

		const totalSets = data.totalSteps ?? data.totalQuestions ?? 0;
		const scorePercent = this.resolveScorePercent(data);
		const msg: GameCompleteMessage = {
			type: 'GAME_COMPLETE',
			score: scorePercent,
			totalSets,
			timeSpent: data.timeSpent,
			starRating: data.starRating ?? this.calculateStarRating(scorePercent),
			reason: 'completed',
			...(screenshotDataUrl ? { screenshotDataUrl } : {}),
		};
		this.send(msg);
	}

	private handleActivityInit(_msg: ActivityInitMessage): void {
		// Store config from parent; games can listen for this via GameManager events
		console.log('PostMessageBridge: received ACTIVITY_INIT', _msg.gameId);
	}

	private handleGameControl(msg: GameControlMessage): void {
		if (!isGameControlAction(msg.action)) return;

		this.controlHandlers[msg.action]?.();
		this.gameManager.emitControl(msg.action);
	}

	destroy(): void {
		for (const { event, fn } of this.listeners) {
			this.gameManager.off(event, fn);
		}
		this.listeners.length = 0;

		if (this.messageHandler) {
			window.removeEventListener('message', this.messageHandler);
			this.messageHandler = null;
		}
	}
}
