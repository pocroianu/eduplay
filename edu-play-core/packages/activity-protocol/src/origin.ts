export interface TrustedParentOriginInput {
  originParam?: string | null;
  referrer?: string | null;
  locationHref: string;
}

export function toHttpOrigin(value: string | null | undefined): string | undefined {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.origin
      : undefined;
  } catch {
    return undefined;
  }
}

export function resolveTrustedParentOrigin({
  originParam,
  referrer,
  locationHref,
}: TrustedParentOriginInput): string {
  const origin =
    toHttpOrigin(originParam) ??
    toHttpOrigin(referrer) ??
    toHttpOrigin(locationHref);

  if (!origin) {
    throw new Error('Unable to resolve a trusted parent origin');
  }

  return origin;
}

export function resolveTrustedGameOrigin(
  gameUrl: string,
  shellOrigin: string,
): string {
  try {
    if (gameUrl.startsWith('/') && !gameUrl.startsWith('//')) {
      return shellOrigin;
    }

    return toHttpOrigin(new URL(gameUrl, shellOrigin).href) ?? shellOrigin;
  } catch {
    return shellOrigin;
  }
}
