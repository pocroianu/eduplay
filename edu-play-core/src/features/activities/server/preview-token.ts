import { randomUUID, createHmac, timingSafeEqual } from 'crypto';

import { ApiError } from '@/lib/api';

export interface PreviewTokenPayload {
  activityId: string;
  typeId: string;
  configData: unknown;
  exp: number;
  iat: number;
  nonce: string;
}

export function buildPreviewToken(input: {
  activityId: string;
  typeId: string;
  configData: unknown;
}): { token: string; expiresAt: string } {
  const secret = getPreviewTokenSecret();

  const expiresAtMs = Date.now() + 15 * 60 * 1000;
  const payload = {
    ...input,
    exp: Math.floor(expiresAtMs / 1000),
    iat: Math.floor(Date.now() / 1000),
    nonce: randomUUID(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = signPreviewPayload(encodedPayload, secret);

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

export function verifyPreviewToken(
  token: string | undefined,
  expected?: { activityId?: string },
): PreviewTokenPayload {
  if (!token) {
    throw ApiError.forbidden('Preview token is required');
  }

  const [encodedPayload, signature, extra] = token.split('.');
  if (!encodedPayload || !signature || extra !== undefined) {
    throw ApiError.forbidden('Preview token is invalid');
  }

  const expectedSignature = signPreviewPayload(
    encodedPayload,
    getPreviewTokenSecret(),
  );

  if (!safeEqualBase64Url(signature, expectedSignature)) {
    throw ApiError.forbidden('Preview token is invalid');
  }

  const payload = parsePreviewPayload(encodedPayload);
  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    throw ApiError.forbidden('Preview token has expired');
  }

  if (expected?.activityId && payload.activityId !== expected.activityId) {
    throw ApiError.forbidden('Preview token is not valid for this activity');
  }

  return payload;
}

function getPreviewTokenSecret(): string {
  const secret =
    process.env.CMS_PREVIEW_TOKEN_SECRET ??
    process.env.JWT_SECRET ??
    process.env.SECRET_KEY_BASE;

  if (!secret) {
    throw new ApiError(
      'INTERNAL_ERROR',
      'Preview token secret is not configured',
    );
  }

  return secret;
}

function signPreviewPayload(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');
}

function safeEqualBase64Url(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.byteLength === rightBuffer.byteLength &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function parsePreviewPayload(encodedPayload: string): PreviewTokenPayload {
  let parsed: unknown;

  try {
    parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    throw ApiError.forbidden('Preview token payload is invalid');
  }

  if (!isPreviewTokenPayload(parsed)) {
    throw ApiError.forbidden('Preview token payload is invalid');
  }

  return parsed;
}

function isPreviewTokenPayload(value: unknown): value is PreviewTokenPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;

  return (
    typeof payload.activityId === 'string' &&
    typeof payload.typeId === 'string' &&
    typeof payload.exp === 'number' &&
    Number.isInteger(payload.exp) &&
    typeof payload.iat === 'number' &&
    Number.isInteger(payload.iat) &&
    typeof payload.nonce === 'string' &&
    Object.hasOwn(payload, 'configData')
  );
}
