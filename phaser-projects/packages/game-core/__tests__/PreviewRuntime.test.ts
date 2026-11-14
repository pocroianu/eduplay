import { afterEach, describe, expect, it } from 'vitest';
import {
	clearPreviewRuntimeSettings,
	resolveAssetRegistryUrl,
	resolveConfigBasePath,
	resolvePreviewPath,
	resolveRegistryBasePath,
	setPreviewRuntimeSettings
} from '../src/previewRuntime';

describe('preview runtime path resolution', () => {
	afterEach(() => {
		clearPreviewRuntimeSettings();
		delete (globalThis as { window?: unknown }).window;
	});

	it('keeps root base paths absolute for activity routes', () => {
		(globalThis as { window?: { __MULTIPLE_CHOICE_PREVIEW__?: unknown } }).window = {};

		setPreviewRuntimeSettings({ basePath: '/' });

		expect(resolvePreviewPath('configs/games')).toBe('/configs/games');
		expect(resolvePreviewPath('assets/guapen.png')).toBe('/assets/guapen.png');
	});

	it('uses versioned activity folders as the default config and asset registry root', () => {
		(globalThis as { window?: { __MULTIPLE_CHOICE_PREVIEW__?: unknown } }).window = {};

		setPreviewRuntimeSettings({
			basePath: '/activities/fruits-01/versions/1'
		});

		expect(resolveConfigBasePath()).toBe('/activities/fruits-01/versions/1');
		expect(resolveRegistryBasePath()).toBe('/activities/fruits-01/versions/1');
		expect(resolveAssetRegistryUrl()).toBe('/activities/fruits-01/versions/1/assets.json');
		expect(resolvePreviewPath('assets/apple.png')).toBe('/activities/fruits-01/versions/1/assets/apple.png');
	});

	it('rebases Activity host content paths when embedded under the renderer proxy', () => {
		(globalThis as { window?: { __MULTIPLE_CHOICE_PREVIEW__?: unknown; location?: { pathname: string } } }).window = {
			location: {
				pathname: '/api/v1/renderer-proxy/activity-renderers/activity-host/templates/multiple-choice'
			}
		};

		setPreviewRuntimeSettings({
			basePath: '/activities/fruits-01/versions/1'
		});

		expect(resolveAssetRegistryUrl()).toBe(
			'/api/v1/renderer-proxy/activity-renderers/activity-host/activities/fruits-01/versions/1/assets.json'
		);
		expect(resolvePreviewPath('/assets/library/images/apple.png')).toBe(
			'/api/v1/renderer-proxy/activity-renderers/activity-host/assets/library/images/apple.png'
		);
	});
});
