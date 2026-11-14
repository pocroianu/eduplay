import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
	default: {
		Events: { EventEmitter },
	},
}));

import GameManager from '../src/managers/GameManager';
import type { GameConfig } from '../src/types/GameConfig';

const theme = {
	primary: 0x111111,
	secondary: 0x222222,
	background: 0x333333,
	cardBg: 0x444444,
	textColor: '#ffffff',
};

describe('GameManager activity progress', () => {
	let manager: GameManager;

	beforeEach(() => {
		manager = new GameManager();
	});

	it('loads a generic activity and reports safe progress and score percentages', () => {
		const loaded = vi.fn();
		manager.on(GameManager.EVENTS.ACTIVITY_LOADED, loaded);

		manager.loadActivity({ gameId: 'listen-tap-1', totalSteps: 5, maxScore: 50, title: 'Listen & Tap' });

		expect(manager.getTotalSteps()).toBe(5);
		expect(manager.getCurrentStep()).toBe(0);
		expect(manager.getCompletedSteps()).toBe(0);
		expect(manager.getMaxScore()).toBe(50);
		expect(manager.getScorePercent()).toBe(0);
		expect(loaded).toHaveBeenCalledWith(expect.objectContaining({
			gameId: 'listen-tap-1',
			totalSteps: 5,
			maxScore: 50,
		}));
	});

	it('loads a synthetic config and activity together for non-question templates', () => {
		manager.loadSyntheticActivityConfig({
			gameId: 'round-template',
			title: 'Round Template',
			totalSteps: 5,
			maxScore: 50,
			theme,
			meta: { pointsPerRound: 10, totalSteps: 99 },
		});

		expect(manager.getConfig()).toEqual(expect.objectContaining({
			meta: expect.objectContaining({
				gameId: 'round-template',
				title: 'Round Template',
				totalSteps: 5,
				pointsPerRound: 10,
			}),
			questions: [],
		}));
		expect(manager.hasActivity()).toBe(true);
		expect(manager.getTotalSteps()).toBe(5);
		expect(manager.getMaxScore()).toBe(50);
	});

	it('completes each step once and scores from raw score over max score', () => {
		const completed = vi.fn();
		manager.loadActivity({ gameId: 'listen-tap-1', totalSteps: 2, maxScore: 20 });
		manager.on(GameManager.EVENTS.STEP_COMPLETED, completed);

		manager.completeStep(0, { scoreDelta: 10, correct: true });
		manager.completeStep(0, { scoreDelta: 10, correct: true });

		expect(manager.getScore()).toBe(10);
		expect(manager.getCompletedSteps()).toBe(1);
		expect(manager.getScorePercent()).toBe(50);
		expect(completed).toHaveBeenCalledTimes(1);
		expect(completed).toHaveBeenCalledWith(expect.objectContaining({
			stepIndex: 0,
			currentStep: 1,
			completedSteps: 1,
			totalSteps: 2,
			rawScore: 10,
			maxScore: 20,
			scorePercent: 50,
		}));
	});

	it('ignores invalid step indexes instead of clamping them into scored progress', () => {
		const completed = vi.fn();
		manager.loadActivity({ gameId: 'listen-tap-1', totalSteps: 2, maxScore: 20 });
		manager.on(GameManager.EVENTS.STEP_COMPLETED, completed);

		manager.completeStep(-1, { scoreDelta: 10, correct: true });
		manager.completeStep(2, { scoreDelta: 10, correct: true });
		manager.completeStep(Number.NaN, { scoreDelta: 10, correct: true });

		expect(manager.getScore()).toBe(0);
		expect(manager.getCompletedSteps()).toBe(0);
		expect(manager.getCurrentStep()).toBe(0);
		expect(completed).not.toHaveBeenCalled();
	});

	it('completes an activity with rich payload and legacy game-complete alias', () => {
		const activityComplete = vi.fn();
		const legacyComplete = vi.fn();
		manager.loadActivity({ gameId: 'listen-tap-1', totalSteps: 2, maxScore: 20 });
		manager.completeStep(0, { scoreDelta: 10, correct: true });
		manager.on(GameManager.EVENTS.ACTIVITY_COMPLETE, activityComplete);
		manager.on(GameManager.EVENTS.GAME_COMPLETE, legacyComplete);

		manager.completeActivity();

		const expected = expect.objectContaining({
			score: 10,
			rawScore: 10,
			maxScore: 20,
			scorePercent: 50,
			totalSteps: 2,
			completedSteps: 1,
			totalQuestions: 0,
			starRating: 1,
		});
		expect(activityComplete).toHaveBeenCalledWith(expected);
		expect(legacyComplete).toHaveBeenCalledWith(expected);
	});

	it('creates explicit results scene data from activity state', () => {
		manager.loadActivity({ gameId: 'listen-tap-1', totalSteps: 2, maxScore: 20 });
		manager.completeStep(0, { scoreDelta: 10, correct: true });

		expect(manager.createResultsData({ restartScene: 'ListenTapLevel' })).toEqual(expect.objectContaining({
			score: 10,
			totalQuestions: 2,
			results: [],
			starRating: 1,
			restartScene: 'ListenTapLevel',
			rawScore: 10,
			maxScore: 20,
			scorePercent: 50,
			totalSteps: 2,
			completedSteps: 1,
		}));
	});

	it('keeps empty activities safe from divide-by-zero progress and star ratings', () => {
		const activityComplete = vi.fn();
		manager.loadActivity({ gameId: 'empty', totalSteps: 0, maxScore: 0 });
		manager.on(GameManager.EVENTS.ACTIVITY_COMPLETE, activityComplete);

		manager.completeStep(0, { scoreDelta: 10, correct: true });
		manager.completeActivity();

		expect(manager.getCompletedSteps()).toBe(0);
		expect(manager.getScore()).toBe(0);
		expect(manager.getScorePercent()).toBe(0);
		expect(manager.getStarRating()).toBe(0);
		expect(activityComplete).toHaveBeenCalledWith(expect.objectContaining({
			scorePercent: 0,
			starRating: 0,
			totalSteps: 0,
		}));
	});

	it('initializes activity progress from question configs without trusting stale totalSteps metadata', () => {
		const config: GameConfig = {
			meta: {
				gameId: 'mc-1',
				totalSteps: 99,
				theme,
			},
			questions: [
				{
					id: 'q1',
					question: { text: 'First?' },
					choices: [{ type: 'text', value: 'A', isCorrect: true }],
					points: 2,
				},
				{
					id: 'q2',
					question: { text: 'Second?' },
					choices: [{ type: 'text', value: 'B', isCorrect: true }],
				},
			],
		};

		manager.loadConfig(config);

		expect(manager.getTotalQuestions()).toBe(2);
		expect(manager.hasActivity()).toBe(true);
		expect(manager.getTotalSteps()).toBe(2);
		expect(manager.getMaxScore()).toBe(3);
	});

	it('does not activate the activity seam for transitional non-question configs', () => {
		const legacyComplete = vi.fn();
		manager.loadConfig({
			meta: {
				gameId: 'round-template',
				totalSteps: 5,
				theme,
			},
			questions: [],
		});
		manager.addPoints(10);
		manager.on(GameManager.EVENTS.GAME_COMPLETE, legacyComplete);

		manager.completeGame();

		expect(manager.hasActivity()).toBe(false);
		expect(legacyComplete).toHaveBeenCalledWith(expect.objectContaining({
			score: 10,
			totalQuestions: 0,
			totalSteps: 5,
		}));
	});
});
