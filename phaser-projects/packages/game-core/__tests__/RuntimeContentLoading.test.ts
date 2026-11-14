import { afterEach, describe, expect, it, vi } from 'vitest';
import ConfigLoader from '../src/services/ConfigLoader';
import AssetResolver from '../src/services/AssetResolver';
import { clearPreviewRuntimeSettings, setPreviewRuntimeSettings } from '../src/previewRuntime';
import { getBootMascotAssets } from '../src/templates/BootMascotAssets';
import { resolveTemplateAudioAssets, resolveTemplateImageAssets } from '../src/templates/TemplateAssetPreload';

const configFixture = {
	meta: {
		gameId: 'fruits-01',
		version: '1.0.0',
		totalSteps: 1,
		gameType: 'multipleChoice',
		difficulty: 'easy',
		supportedLanguages: ['en'],
		themeName: 'ocean'
	},
	questions: [
		{
			id: 'q1',
			questionKey: 'q1.question',
			choices: [
				{ type: 'image', value: 'banana', isCorrect: false },
				{ type: 'image', value: 'apple', isCorrect: true }
			]
		}
	]
};

const stringsFixture = {
	meta: { title: 'Fruit Quiz' },
	questions: { q1: { question: 'Which one is an apple?' } },
	choices: { apple: 'Apple', banana: 'Banana' }
};

const assetRegistryFixture = {
	version: '1.0.0',
	baseUrl: 'assets',
	pinnedAssets: {
		apple: {
			type: 'image',
			assetId: 'sha256-0a827d9b4661d0a949ed5edd796de47170fdc3e1923aee592e70c40de2a29f28',
			sha256: '0a827d9b4661d0a949ed5edd796de47170fdc3e1923aee592e70c40de2a29f28',
			path: '/assets/library/images/apple.png'
		},
		question1: {
			type: 'audio',
			assetId: 'sha256-a76888f554c8eadd320f588754c13b94777cf042c7247e495e55cc3ac17a9dc4',
			sha256: 'a76888f554c8eadd320f588754c13b94777cf042c7247e495e55cc3ac17a9dc4',
			path: '/assets/library/audio/question1.mp3'
		}
	},
	games: {
		'fruits-01': {
			manifest: {
				images: ['apple'],
				audio: [],
				spritesheets: []
			}
		}
	}
};

describe('runtime activity content loading', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		clearPreviewRuntimeSettings();
		delete (globalThis as { window?: unknown }).window;
		delete (globalThis as { fetch?: unknown }).fetch;
	});

	it('preloads loading-shell mascots from stable shared asset paths', () => {
		expect(getBootMascotAssets()).toEqual([
			{ key: 'guapen', url: '/assets/shared/mascots/guapen.png' },
			{ key: 'FufuSuperDino', url: '/assets/shared/mascots/FufuSuperDino.png' },
			{ key: 'mascot-owl', url: '/assets/shared/mascots/guapen.png' }
		]);
	});

	it('preloads loading-shell mascots through the renderer proxy when embedded there', () => {
		(globalThis as { window?: { __MULTIPLE_CHOICE_PREVIEW__?: unknown; location?: { pathname: string } } }).window = {
			location: {
				pathname: '/api/v1/renderer-proxy/activity-renderers/activity-host/templates/pattern-game'
			}
		};

		expect(getBootMascotAssets()).toEqual([
			{ key: 'guapen', url: '/api/v1/renderer-proxy/activity-renderers/activity-host/assets/shared/mascots/guapen.png' },
			{ key: 'FufuSuperDino', url: '/api/v1/renderer-proxy/activity-renderers/activity-host/assets/shared/mascots/FufuSuperDino.png' },
			{ key: 'mascot-owl', url: '/api/v1/renderer-proxy/activity-renderers/activity-host/assets/shared/mascots/guapen.png' }
		]);
	});

	it('loads config and strings from the Activity version folder', async () => {
		(globalThis as { window?: { __MULTIPLE_CHOICE_PREVIEW__?: unknown; location: { search: string; href: string; origin: string } } }).window = {
			location: { search: '', href: 'http://localhost/', origin: 'http://localhost' }
		};
		setPreviewRuntimeSettings({ basePath: '/activities/fruits-01/versions/1' });
		const fetchMock = vi.fn(async (url: string) => ({
			ok: true,
			json: async () => url.endsWith('/config.json') ? configFixture : stringsFixture
		}));
		(globalThis as { fetch: typeof fetchMock }).fetch = fetchMock;

		await new ConfigLoader().loadTemplateConfig({ gameId: 'fruits-01', language: 'en', useCache: false });

		expect(fetchMock).toHaveBeenCalledWith('/activities/fruits-01/versions/1/config.json');
		expect(fetchMock).toHaveBeenCalledWith('/activities/fruits-01/versions/1/strings/en.json');
		expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toEqual(
			expect.arrayContaining([
				'/configs/games/fruits-01/config.json',
				'/activities/fruits-01/versions/1/fruits-01/config.json',
				'/activities/fruits-01/versions/1/fruits-01/en.json'
			])
		);
	});

	it('loads the Activity asset manifest instead of an old asset registry file', async () => {
		(globalThis as { window?: { __MULTIPLE_CHOICE_PREVIEW__?: unknown; location: { search: string; href: string; origin: string } } }).window = {
			location: { search: '', href: 'http://localhost/', origin: 'http://localhost' }
		};
		setPreviewRuntimeSettings({ basePath: '/activities/fruits-01/versions/1' });
		const fetchMock = vi.fn(async () => ({
			ok: true,
			json: async () => assetRegistryFixture
		}));
		(globalThis as { fetch: typeof fetchMock }).fetch = fetchMock;

		await new AssetResolver().loadRegistry();

		expect(fetchMock).toHaveBeenCalledWith('/activities/fruits-01/versions/1/assets.json');
		expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContain('/activities/fruits-01/versions/1/asset-registry.json');
	});

	it('resolves pinned Activity assets through the shared immutable asset library', async () => {
		(globalThis as { window?: { __MULTIPLE_CHOICE_PREVIEW__?: unknown; location: { search: string; href: string; origin: string } } }).window = {
			location: { search: '', href: 'http://localhost/', origin: 'http://localhost' }
		};
		setPreviewRuntimeSettings({ basePath: '/activities/fruits-01/versions/1' });
		const fetchMock = vi.fn(async () => ({
			ok: true,
			json: async () => assetRegistryFixture
		}));
		(globalThis as { fetch: typeof fetchMock }).fetch = fetchMock;

		const resolver = new AssetResolver();
		const assets = await resolver.resolveAssets({ images: ['apple'], audio: ['question1'], spritesheets: [] });

		expect(assets).toContainEqual({
			key: 'apple',
			type: 'image',
			url: '/assets/library/images/apple.png'
		});
		expect(assets).toContainEqual({
			key: 'question1',
			type: 'audio',
			url: '/assets/library/audio/question1.mp3'
		});

		resolver.setSpritesheetMode(true);
		const spritesheetModeAssets = await resolver.resolveAssets({ images: ['apple'], audio: [], spritesheets: [] });
		expect(spritesheetModeAssets).toContainEqual({
			key: 'apple',
			type: 'image',
			url: '/assets/library/images/apple.png'
		});
	});

	it('resolves template preload assets through pinned library paths when embedded in the renderer proxy', async () => {
		(globalThis as { window?: { __MULTIPLE_CHOICE_PREVIEW__?: unknown; location: { search: string; href: string; origin: string; pathname: string } } }).window = {
			location: {
				search: '',
				href: 'http://localhost/api/v1/renderer-proxy/activity-renderers/activity-host/templates/categorize-game',
				origin: 'http://localhost',
				pathname: '/api/v1/renderer-proxy/activity-renderers/activity-host/templates/categorize-game'
			}
		};
		setPreviewRuntimeSettings({ basePath: '/activities/fruits-01/versions/1' });
		const fetchMock = vi.fn(async () => ({
			ok: true,
			json: async () => assetRegistryFixture
		}));
		(globalThis as { fetch: typeof fetchMock }).fetch = fetchMock;

		await expect(resolveTemplateImageAssets(['apple'])).resolves.toContainEqual({
			key: 'apple',
			type: 'image',
			url: '/api/v1/renderer-proxy/activity-renderers/activity-host/assets/library/images/apple.png'
		});
		await expect(resolveTemplateAudioAssets(['question1'])).resolves.toContainEqual({
			key: 'question1',
			type: 'audio',
			url: '/api/v1/renderer-proxy/activity-renderers/activity-host/assets/library/audio/question1.mp3'
		});
	});

	it('throws instead of fabricating local URLs for unpinned keys in pruned Activity registries', async () => {
		(globalThis as { window?: { __MULTIPLE_CHOICE_PREVIEW__?: unknown; location: { search: string; href: string; origin: string } } }).window = {
			location: { search: '', href: 'http://localhost/', origin: 'http://localhost' }
		};
		setPreviewRuntimeSettings({ basePath: '/activities/fruits-01/versions/1' });
		const fetchMock = vi.fn(async () => ({
			ok: true,
			json: async () => assetRegistryFixture
		}));
		(globalThis as { fetch: typeof fetchMock }).fetch = fetchMock;

		await expect(new AssetResolver().resolveAssets({ images: ['banana'], audio: [], spritesheets: [] }))
			.rejects.toThrow('Unable to resolve image asset "banana" from Activity asset manifest pins');
	});
});
