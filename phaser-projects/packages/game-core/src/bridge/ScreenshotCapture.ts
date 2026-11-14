const SCREENSHOT_MIME = 'image/png';
const SCREENSHOT_DATA_URL_PREFIX = 'data:image/png;base64,';
const SNAPSHOT_TIMEOUT_MS = 1000;

export interface ScreenshotRenderer {
	snapshot(
		callback: (snapshot?: unknown) => void,
		type?: string,
		encoderOptions?: number,
	): unknown;
}

export interface ScreenshotCanvas {
	toDataURL(type?: string, encoderOptions?: number): string;
}

export interface CaptureScreenshotOptions {
	targetOrigin: string;
	getRenderer?: () => ScreenshotRenderer | null | undefined;
	getCanvas?: () => ScreenshotCanvas | null | undefined;
	timeoutMs?: number;
}

export function resolveDefaultTargetOrigin(href?: string): string {
	try {
		if (href) {
			return new URL(href).origin;
		}

		if (typeof window !== 'undefined' && window.location?.href) {
			return window.location.origin;
		}
	} catch {
		// Fall through to the legacy broadcast target when no concrete browser
		// origin is available, such as non-browser tests or SSR imports.
	}

	return '*';
}

export function normalizeTargetOrigin(targetOrigin?: string): string {
	const trimmed = targetOrigin?.trim();
	return trimmed || resolveDefaultTargetOrigin();
}

export function canSendScreenshotToTargetOrigin(targetOrigin: string): boolean {
	if (!targetOrigin || targetOrigin === '*' || targetOrigin === '/') {
		return false;
	}

	try {
		const url = new URL(targetOrigin);
		const normalized = targetOrigin.endsWith('/') ? targetOrigin.slice(0, -1) : targetOrigin;
		return (url.protocol === 'https:' || url.protocol === 'http:') && url.origin === normalized;
	} catch {
		return false;
	}
}

function dataUrlFromSnapshot(snapshot: unknown): string | undefined {
	if (!snapshot || typeof snapshot !== 'object') return undefined;

	const src = (snapshot as { src?: unknown }).src;
	if (typeof src !== 'string' || !src.startsWith(SCREENSHOT_DATA_URL_PREFIX)) {
		return undefined;
	}

	return src;
}

function dataUrlFromCanvas(canvas: ScreenshotCanvas | null | undefined): string | undefined {
	if (!canvas) return undefined;

	const url = canvas.toDataURL(SCREENSHOT_MIME);
	if (!url || !url.startsWith(SCREENSHOT_DATA_URL_PREFIX)) {
		return undefined;
	}

	return url;
}

function captureRendererSnapshot(renderer: ScreenshotRenderer, timeoutMs: number): Promise<string | undefined> {
	return new Promise((resolve) => {
		let settled = false;
		let timeout: ReturnType<typeof setTimeout> | undefined;

		const finish = (value: string | undefined) => {
			if (settled) return;
			settled = true;
			if (timeout) clearTimeout(timeout);
			resolve(value);
		};

		timeout = setTimeout(() => finish(undefined), timeoutMs);

		try {
			renderer.snapshot((snapshot?: unknown) => {
				finish(dataUrlFromSnapshot(snapshot));
			}, SCREENSHOT_MIME);
		} catch {
			finish(undefined);
		}
	});
}

export async function captureScreenshotDataUrl(
	options: CaptureScreenshotOptions,
): Promise<string | undefined> {
	if (!canSendScreenshotToTargetOrigin(options.targetOrigin)) {
		return undefined;
	}

	const renderer = options.getRenderer?.();
	if (renderer?.snapshot) {
		const snapshotDataUrl = await captureRendererSnapshot(
			renderer,
			options.timeoutMs ?? SNAPSHOT_TIMEOUT_MS,
		);
		if (snapshotDataUrl) return snapshotDataUrl;
	}

	try {
		return dataUrlFromCanvas(options.getCanvas?.());
	} catch {
		return undefined;
	}
}
