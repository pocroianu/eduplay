/**
 * Resolve the optional config URL supplied by the EduPlay host shell.
 *
 * The iframe accepts only same-origin absolute paths so the existing session
 * cookie can authorize CMS-backed config requests without opening cross-origin
 * fetches from a kid-facing runtime.
 */
export function resolveSafeSameOriginConfigUrl(value: string): string | null {
	if (!value) return null;
	if (value.includes('\\') || /%5c/i.test(value)) return null;

	const origin =
		typeof window === 'undefined' ? 'http://localhost' : window.location.origin;

	try {
		const resolved = new URL(value, origin);
		if (resolved.origin !== origin) return null;
		return `${resolved.pathname}${resolved.search}${resolved.hash}`;
	} catch {
		return null;
	}
}

export function isSafeSameOriginConfigUrl(value: string): boolean {
	return resolveSafeSameOriginConfigUrl(value) !== null;
}

export function getRuntimeConfigUrlFromSearch(search?: string): string | null {
	const source = search ?? (typeof window === 'undefined' ? '' : window.location.search);
	const explicitConfigUrl = new URLSearchParams(source).get('configUrl');
	if (!explicitConfigUrl) return null;
	return resolveSafeSameOriginConfigUrl(explicitConfigUrl);
}

export function resolveRuntimeConfigUrl(fallbackUrl: string): string {
	return getRuntimeConfigUrlFromSearch() ?? fallbackUrl;
}
