import { describe, expect, it } from 'vitest';
import {
	isTrustedParentOrigin,
	resolveParentOrigin,
} from '../src/bridge/ParentOrigin';

describe('ParentOrigin', () => {
	it('prefers a valid explicit origin query value', () => {
		expect(
			resolveParentOrigin({
				explicitOrigin: 'https://parent.eduplay.test/ignored/path?x=1',
				referrer: 'https://referrer.eduplay.test/shell',
				locationHref: 'https://renderer.eduplay.test/game/index.html',
				locationOrigin: 'https://renderer.eduplay.test',
			}),
		).toBe('https://parent.eduplay.test');
	});

	it('uses document referrer origin when the explicit origin is missing or invalid', () => {
		expect(
			resolveParentOrigin({
				explicitOrigin: '*',
				referrer: 'https://app.eduplay.test/play/activity-1',
				locationHref: 'https://app.eduplay.test/api/v1/renderer-proxy/activity-renderers/multiple-choice/index.html',
			}),
		).toBe('https://app.eduplay.test');
	});

	it('falls back to the renderer page origin for same-origin proxied launches', () => {
		expect(
			resolveParentOrigin({
				explicitOrigin: '',
				referrer: '',
				locationOrigin: 'https://app.eduplay.test',
				locationHref: 'https://app.eduplay.test/api/v1/renderer-proxy/activity-renderers/multiple-choice/index.html',
			}),
		).toBe('https://app.eduplay.test');
	});

	it('can derive the renderer fallback origin from href when location.origin is unavailable', () => {
		expect(
			resolveParentOrigin({
				explicitOrigin: 'not-a-url',
				referrer: 'notaurl',
				locationOrigin: '',
				locationHref: 'https://app.eduplay.test/api/v1/renderer-proxy/activity-renderers/multiple-choice/index.html',
			}),
		).toBe('https://app.eduplay.test');
	});

	it('does not return a wildcard for invalid or empty inputs', () => {
		expect(
			resolveParentOrigin({
				explicitOrigin: '*',
				referrer: 'notaurl',
				locationOrigin: '',
				locationHref: 'about:blank',
			}),
		).toBeUndefined();
	});

	it('compares inbound message origins against the trusted parent origin', () => {
		expect(isTrustedParentOrigin('https://evil.eduplay.test', 'https://app.eduplay.test')).toBe(false);
		expect(isTrustedParentOrigin('https://app.eduplay.test', 'https://app.eduplay.test')).toBe(true);
	});
});
