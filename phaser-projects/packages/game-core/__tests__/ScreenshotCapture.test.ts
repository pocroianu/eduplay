import { describe, expect, it, vi } from 'vitest';
import {
	captureScreenshotDataUrl,
	canSendScreenshotToTargetOrigin,
	resolveDefaultTargetOrigin,
} from '../src/bridge/ScreenshotCapture';

const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

describe('ScreenshotCapture', () => {
	it('uses the current page origin as the default target origin', () => {
		expect(resolveDefaultTargetOrigin('https://app.eduplay.test/games/fruits/index.html')).toBe(
			'https://app.eduplay.test',
		);
	});

	it('does not allow screenshot payloads for wildcard target origins', async () => {
		const snapshot = vi.fn();

		const screenshotDataUrl = await captureScreenshotDataUrl({
			targetOrigin: '*',
			getRenderer: () => ({ snapshot }),
		});

		expect(screenshotDataUrl).toBeUndefined();
		expect(snapshot).not.toHaveBeenCalled();
		expect(canSendScreenshotToTargetOrigin('*')).toBe(false);
	});

	it('captures through Phaser renderer snapshots for concrete target origins', async () => {
		const snapshot = vi.fn((callback: (image: { src: string }) => void) => {
			callback({ src: PNG_DATA_URL });
		});

		await expect(
			captureScreenshotDataUrl({
				targetOrigin: 'https://app.eduplay.test',
				getRenderer: () => ({ snapshot }),
			}),
		).resolves.toBe(PNG_DATA_URL);

		expect(snapshot).toHaveBeenCalledWith(expect.any(Function), 'image/png');
	});
});
