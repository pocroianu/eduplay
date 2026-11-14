export interface ResolveParentOriginOptions {
	explicitOrigin?: string | null;
	referrer?: string | null;
	locationOrigin?: string | null;
	locationHref?: string | null;
}

function browserReferrer(): string | undefined {
	return typeof document !== 'undefined' ? document.referrer : undefined;
}

function browserLocationOrigin(): string | undefined {
	return typeof window !== 'undefined' ? window.location?.origin : undefined;
}

function browserLocationHref(): string | undefined {
	return typeof window !== 'undefined' ? window.location?.href : undefined;
}

function normalizeHttpOrigin(value?: string | null): string | undefined {
	const trimmed = value?.trim();
	if (!trimmed || trimmed === '*') return undefined;

	try {
		const url = new URL(trimmed);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
		if (!url.origin || url.origin === 'null') return undefined;
		return url.origin;
	} catch {
		return undefined;
	}
}

export function resolveParentOrigin(options: ResolveParentOriginOptions = {}): string | undefined {
	return (
		normalizeHttpOrigin(options.explicitOrigin)
		?? normalizeHttpOrigin(options.referrer ?? browserReferrer())
		?? normalizeHttpOrigin(options.locationOrigin ?? browserLocationOrigin())
		?? normalizeHttpOrigin(options.locationHref ?? browserLocationHref())
	);
}

export function isTrustedParentOrigin(eventOrigin: string, parentOrigin?: string): boolean {
	const normalizedEventOrigin = normalizeHttpOrigin(eventOrigin);
	const normalizedParentOrigin = normalizeHttpOrigin(parentOrigin);
	return !!normalizedEventOrigin && normalizedEventOrigin === normalizedParentOrigin;
}
