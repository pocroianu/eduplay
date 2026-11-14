import { describe, expect, it } from 'vitest';
import { resolveActivityHostRoute } from '../src/host/activityHostRoutes';

const catalog = {
	activities: [
		{
			activityId: 'fruits-01',
			version: 1,
			renderer: { id: 'multiple-choice', version: '^1.0.0' },
			gameId: 'fruits-01',
			basePath: '/activities/fruits-01/versions/1',
		},
	],
	renderers: [
		{
			rendererId: 'multiple-choice',
			defaultGameId: 'fruits-01',
			basePath: '/activities/fruits-01/versions/1',
		},
	],
} as const;

describe('activity host route resolution', () => {
	it('resolves a canonical activity URL to renderer mount options', () => {
		expect(resolveActivityHostRoute('/activities/fruits-01', catalog)).toEqual({
			kind: 'activity',
			activityId: 'fruits-01',
			version: 1,
			rendererId: 'multiple-choice',
			rendererVersionRange: '^1.0.0',
			mountOptions: {
				gameId: 'fruits-01',
				basePath: '/activities/fruits-01/versions/1',
			},
		});
	});

	it('resolves an exact immutable activity version URL', () => {
		expect(resolveActivityHostRoute('/activities/fruits-01@1', catalog)).toEqual(expect.objectContaining({
			kind: 'activity',
			activityId: 'fruits-01',
			version: 1,
			rendererId: 'multiple-choice',
		}));
	});

	it('resolves a template debug URL to the renderer default game', () => {
		expect(resolveActivityHostRoute('/templates/multiple-choice/', catalog)).toEqual({
			kind: 'template',
			templateId: 'multiple-choice',
			rendererId: 'multiple-choice',
			mountOptions: {
				gameId: 'fruits-01',
				basePath: '/activities/fruits-01/versions/1',
			},
		});
	});

	it('resolves proxied deployment URLs that include the Activity host storage prefix', () => {
		expect(
			resolveActivityHostRoute(
				'/api/v1/renderer-proxy/activity-renderers/activity-host/templates/multiple-choice',
				catalog
			)
		).toEqual({
			kind: 'template',
			templateId: 'multiple-choice',
			rendererId: 'multiple-choice',
			mountOptions: {
				gameId: 'fruits-01',
				basePath: '/activities/fruits-01/versions/1',
			},
		});
	});
});
