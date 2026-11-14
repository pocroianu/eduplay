import { EventEmitter } from 'events';
import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
	default: {
		Events: { EventEmitter },
		Scene: class Scene {},
		Math: { Between: () => 0 },
	},
}));

import { normalizeResultsData } from '../src/scenes/Results';

describe('normalizeResultsData', () => {
	it('uses explicit raw/max score semantics instead of dividing by total steps', () => {
		expect(normalizeResultsData({
			score: 50,
			totalQuestions: 5,
			results: [],
			starRating: 3,
			rawScore: 50,
			maxScore: 50,
			scorePercent: 100,
			totalSteps: 5,
			completedSteps: 5,
		})).toEqual(expect.objectContaining({
			rawScore: 50,
			maxScore: 50,
			scorePercent: 100,
			totalSteps: 5,
			completedSteps: 5,
			scoreDisplayText: '100%',
		}));
	});

	it('keeps old score/totalQuestions payloads compatible', () => {
		expect(normalizeResultsData({
			score: 3,
			totalQuestions: 5,
			results: [],
			starRating: 2,
		})).toEqual(expect.objectContaining({
			rawScore: 3,
			maxScore: 5,
			scorePercent: 60,
			totalSteps: 5,
			completedSteps: 5,
			scoreDisplayText: '60%',
		}));
	});
});
