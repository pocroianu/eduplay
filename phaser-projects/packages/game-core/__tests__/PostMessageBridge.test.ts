import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/managers/GameManager', () => ({
	default: class GameManager {
		static readonly EVENTS = {
			QUESTION_STARTED: 'question-started',
			SCORE_UPDATED: 'score-updated',
			GAME_COMPLETE: 'game-complete',
			ACTIVITY_LOADED: 'activity-loaded',
			STEP_STARTED: 'step-started',
			STEP_COMPLETED: 'step-completed',
			ACTIVITY_COMPLETE: 'activity-complete',
			ACTIVITY_CAPABILITIES_UPDATED: 'activity-capabilities-updated',
			CONTROL_PAUSE: 'control-pause',
			CONTROL_REPEAT_INSTRUCTION: 'control-repeat-instruction',
		};
	},
}));

import { PostMessageBridge } from '../src/bridge/PostMessageBridge';

type Handler = (...args: any[]) => void;

function createGameManager() {
	const handlers = new Map<string, Handler[]>();
	return {
		on: vi.fn((event: string, handler: Handler) => {
			handlers.set(event, [...(handlers.get(event) ?? []), handler]);
		}),
		off: vi.fn(),
		emitForTest: (event: string, payload: unknown) => {
			for (const handler of handlers.get(event) ?? []) {
				handler(payload);
			}
		},
		emit: vi.fn((event: string, payload: unknown) => {
			for (const handler of handlers.get(event) ?? []) {
				handler(payload);
			}
		}),
		emitControl: vi.fn((action: string) => {
			const event = action === 'repeatInstruction' ? 'control-repeat-instruction' : `control-${action}`;
			for (const handler of handlers.get(event) ?? []) {
				handler({ action });
			}
		}),
		hasActivity: vi.fn(() => false),
		getActivityCapabilities: vi.fn(() => ({})),
		getTotalQuestions: vi.fn(() => 0),
		getCurrentQuestionIndex: vi.fn(() => 0),
		getTotalSteps: vi.fn(() => 0),
		getCompletedSteps: vi.fn(() => 0),
		getScorePercent: vi.fn(() => 0),
		getStarRating: vi.fn(() => 0),
	};
}

function setupIframe() {
	let messageHandler: ((event: MessageEvent) => void) | undefined;
	const parent = { postMessage: vi.fn() };
	const windowStub = {
		parent,
		location: {
			origin: 'https://game.eduplay.test',
			href: 'https://game.eduplay.test/index.html',
		},
		addEventListener: vi.fn((event: string, handler: (event: MessageEvent) => void) => {
			if (event === 'message') messageHandler = handler;
		}),
		removeEventListener: vi.fn(),
	};
	vi.stubGlobal('window', windowStub);
	vi.stubGlobal('document', { referrer: '', querySelector: vi.fn() });
	return { parent, getMessageHandler: () => messageHandler };
}

describe('PostMessageBridge', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('ignores parent-to-game messages from untrusted origins', () => {
		const { getMessageHandler } = setupIframe();
		const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const bridge = new PostMessageBridge({
			gameManager: createGameManager() as any,
			gameId: 'activity-1',
			targetOrigin: 'https://parent.eduplay.test',
		});

		bridge.start();
		const messageHandler = getMessageHandler();
		expect(messageHandler).toBeDefined();

		messageHandler?.({
			origin: 'https://evil.eduplay.test',
			data: { type: 'ACTIVITY_INIT', gameId: 'activity-1', language: 'en' },
		} as MessageEvent);
		expect(log).not.toHaveBeenCalledWith('PostMessageBridge: received ACTIVITY_INIT', 'activity-1');

		messageHandler?.({
			origin: 'https://parent.eduplay.test',
			data: { type: 'ACTIVITY_INIT', gameId: 'activity-1', language: 'en' },
		} as MessageEvent);
		expect(log).toHaveBeenCalledWith('PostMessageBridge: received ACTIVITY_INIT', 'activity-1');
	});

	it('dispatches trusted host control messages through GameManager events', () => {
		const { getMessageHandler } = setupIframe();
		const gameManager = createGameManager();
		const bridge = new PostMessageBridge({
			gameManager: gameManager as any,
			gameId: 'activity-1',
			targetOrigin: 'https://parent.eduplay.test',
		});

		bridge.start();
		getMessageHandler()?.({
			origin: 'https://parent.eduplay.test',
			data: { type: 'GAME_CONTROL', action: 'repeatInstruction' },
		} as MessageEvent);
		getMessageHandler()?.({
			origin: 'https://parent.eduplay.test',
			data: { type: 'GAME_CONTROL', action: 'pause' },
		} as MessageEvent);

		expect(gameManager.emitControl).toHaveBeenCalledWith('repeatInstruction');
		expect(gameManager.emitControl).toHaveBeenCalledWith('pause');
	});

	it('ignores trusted host control messages with unknown actions', () => {
		const { getMessageHandler } = setupIframe();
		const gameManager = createGameManager();
		const bridge = new PostMessageBridge({
			gameManager: gameManager as any,
			gameId: 'activity-1',
			targetOrigin: 'https://parent.eduplay.test',
		});

		bridge.start();
		getMessageHandler()?.({
			origin: 'https://parent.eduplay.test',
			data: { type: 'GAME_CONTROL', action: 'dance' },
		} as MessageEvent);

		expect(gameManager.emitControl).not.toHaveBeenCalled();
	});

	it('announces updated activity capabilities to the parent shell', () => {
		const { parent } = setupIframe();
		const gameManager = createGameManager();
		gameManager.getActivityCapabilities.mockReturnValue({ repeatInstruction: true });
		const bridge = new PostMessageBridge({
			gameManager: gameManager as any,
			gameId: 'activity-1',
			targetOrigin: 'https://parent.eduplay.test',
		});

		bridge.start();
		gameManager.emitForTest('activity-capabilities-updated', { repeatInstruction: true });

		expect(parent.postMessage).toHaveBeenLastCalledWith({
			type: 'ACTIVITY_READY',
			gameId: 'activity-1',
			capabilities: { repeatInstruction: true },
		}, 'https://parent.eduplay.test');
	});

	it('sends activity-protocol progress from completed activity steps without non-protocol score fields', () => {
		const { parent } = setupIframe();
		const gameManager = createGameManager();
		const bridge = new PostMessageBridge({
			gameManager: gameManager as any,
			gameId: 'listen-tap-1',
			targetOrigin: 'https://parent.eduplay.test',
		});

		bridge.start();
		gameManager.emitForTest('activity-loaded', { totalSteps: 5, maxScore: 50 });
		gameManager.emitForTest('score-updated', 20);
		gameManager.emitForTest('step-completed', {
			stepIndex: 1,
			currentStep: 2,
			completedSteps: 2,
			totalSteps: 5,
			rawScore: 20,
			maxScore: 50,
		});

		const progressMessages = parent.postMessage.mock.calls.filter(([message]) => message.type === 'PROGRESS_UPDATE');
		expect(progressMessages).toHaveLength(1);
		expect(progressMessages[0]).toEqual([{
			type: 'PROGRESS_UPDATE',
			currentSet: 2,
			totalSets: 5,
			progress: 2 / 5,
		}, 'https://parent.eduplay.test']);
	});

	it('keeps legacy completion fallback score safe when only total steps are known', async () => {
		const { parent } = setupIframe();
		const gameManager = createGameManager();
		const bridge = new PostMessageBridge({
			gameManager: gameManager as any,
			gameId: 'legacy-round-template',
			targetOrigin: 'https://parent.eduplay.test',
			getCanvas: () => null,
			getRenderer: () => null,
		});

		bridge.start();
		gameManager.emitForTest('game-complete', {
			score: 50,
			totalQuestions: 0,
			totalSteps: 5,
			results: [],
			timeSpent: 1234,
		});
		await Promise.resolve();

		expect(parent.postMessage).toHaveBeenLastCalledWith({
			type: 'GAME_COMPLETE',
			score: 100,
			totalSets: 5,
			timeSpent: 1234,
			starRating: 3,
			reason: 'completed',
		}, 'https://parent.eduplay.test');
	});

	it('sends parent completion from activity payload and ignores the legacy alias duplicate', async () => {
		const { parent } = setupIframe();
		const gameManager = createGameManager();
		const bridge = new PostMessageBridge({
			gameManager: gameManager as any,
			gameId: 'listen-tap-1',
			targetOrigin: 'https://parent.eduplay.test',
			getCanvas: () => null,
			getRenderer: () => null,
		});
		const payload = {
			score: 40,
			rawScore: 40,
			maxScore: 50,
			scorePercent: 80,
			totalSteps: 5,
			completedSteps: 5,
			totalQuestions: 0,
			results: [],
			timeSpent: 1234,
			starRating: 2,
		};

		bridge.start();
		gameManager.emitForTest('activity-complete', payload);
		gameManager.emitForTest('game-complete', payload);
		await Promise.resolve();

		const completeMessages = parent.postMessage.mock.calls.filter(([message]) => message.type === 'GAME_COMPLETE');
		expect(completeMessages).toHaveLength(1);
		expect(completeMessages[0]).toEqual([{
			type: 'GAME_COMPLETE',
			score: 80,
			totalSets: 5,
			timeSpent: 1234,
			starRating: 2,
			reason: 'completed',
		}, 'https://parent.eduplay.test']);
	});
});
