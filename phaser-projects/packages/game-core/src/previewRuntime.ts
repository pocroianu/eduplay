import { Language } from "./i18n";

export interface PreviewRuntimeSettings {
	gameId?: string;
	language?: Language;
	muted?: boolean;
	basePath?: string;
	configUrl?: string;
	theme?: string;
}

declare global {
	interface Window {
		__MULTIPLE_CHOICE_PREVIEW__?: PreviewRuntimeSettings;
	}
}

function normalizeBasePath(basePath?: string): string {
	if (!basePath || basePath === ".") {
		return ".";
	}

	if (basePath === "/") {
		return "/";
	}

	return rebaseActivityHostContentPath(basePath.replace(/\/+$/, ""));
}

export function setPreviewRuntimeSettings(settings: PreviewRuntimeSettings): void {
	if (typeof window === "undefined") {
		return;
	}
	window.__MULTIPLE_CHOICE_PREVIEW__ = {
		...settings,
		basePath: normalizeBasePath(settings.basePath),
		configUrl: settings.configUrl?.trim() || undefined
	};
}

export function getPreviewRuntimeSettings(): PreviewRuntimeSettings {
	if (typeof window === "undefined") {
		return {};
	}
	return window.__MULTIPLE_CHOICE_PREVIEW__ ?? {};
}

export function clearPreviewRuntimeSettings(): void {
	if (typeof window === "undefined") {
		return;
	}
	delete window.__MULTIPLE_CHOICE_PREVIEW__;
}

export function resolvePreviewPath(path: string, basePath?: string): string {
	if (/^(?:[a-z]+:)?\/\//i.test(path)) {
		return path;
	}

	if (path.startsWith("/")) {
		return rebaseActivityHostContentPath(path);
	}

	const normalizedBasePath = normalizeBasePath(basePath ?? getPreviewRuntimeSettings().basePath);
	const normalizedPath = path.replace(/^\.?\//, "");

	if (normalizedPath === "." || normalizedPath.length === 0) {
		return normalizedBasePath;
	}

	if (normalizedBasePath === ".") {
		return `./${normalizedPath}`;
	}

	if (normalizedBasePath === "/") {
		return `/${normalizedPath}`;
	}

	return `${normalizedBasePath}/${normalizedPath}`;
}

export function resolveConfigBasePath(): string {
	return resolvePreviewPath(".");
}

export function resolveRegistryBasePath(): string {
	return resolvePreviewPath(".");
}

export function resolveAssetRegistryUrl(baseUrl: string = resolveRegistryBasePath()): string {
	return `${baseUrl.replace(/\/+$/, '')}/assets.json`;
}

function rebaseActivityHostContentPath(path: string): string {
	const publicBasePath = getActivityHostPublicBasePath();
	if (!publicBasePath || path.startsWith(`${publicBasePath}/`)) {
		return path;
	}

	if (path.startsWith('/activities/') || path.startsWith('/templates/') || path.startsWith('/assets/')) {
		return `${publicBasePath}${path}`;
	}

	return path;
}

function getActivityHostPublicBasePath(): string | undefined {
	if (typeof window === 'undefined' || !window.location?.pathname) {
		return undefined;
	}

	const marker = '/activity-renderers/activity-host';
	const pathname = window.location.pathname.replace(/\/+$/, '');
	const markerIndex = pathname.indexOf(marker);
	if (markerIndex === -1) {
		return undefined;
	}

	return pathname.slice(0, markerIndex + marker.length);
}
