import { describe, expect, it } from 'vitest';
import {
  resolveTrustedGameOrigin,
  resolveTrustedParentOrigin,
  toHttpOrigin,
} from '@edu-play/activity-protocol';

describe('activity protocol origin helpers', () => {
  it('extracts only http and https origins', () => {
    expect(toHttpOrigin('https://app.example.test/play/1')).toBe('https://app.example.test');
    expect(toHttpOrigin('http://localhost:3000/play/1')).toBe('http://localhost:3000');
    expect(toHttpOrigin('ftp://example.test/file')).toBeUndefined();
    expect(toHttpOrigin('not a url')).toBeUndefined();
    expect(toHttpOrigin(null)).toBeUndefined();
    expect(toHttpOrigin(undefined)).toBeUndefined();
  });

  it('resolves parent origin from origin query, then referrer, then renderer URL', () => {
    expect(
      resolveTrustedParentOrigin({
        originParam: 'https://shell.example.test/play/1',
        referrer: 'https://referrer.example.test/play/1',
        locationHref: 'https://renderer.example.test/index.html',
      }),
    ).toBe('https://shell.example.test');

    expect(
      resolveTrustedParentOrigin({
        originParam: 'bad',
        referrer: 'https://referrer.example.test/play/1',
        locationHref: 'https://renderer.example.test/index.html',
      }),
    ).toBe('https://referrer.example.test');

    expect(
      resolveTrustedParentOrigin({
        originParam: null,
        referrer: '',
        locationHref: 'https://renderer.example.test/index.html',
      }),
    ).toBe('https://renderer.example.test');
  });

  it('throws when no trusted parent origin can be resolved', () => {
    expect(() =>
      resolveTrustedParentOrigin({
        originParam: 'bad',
        referrer: 'bad',
        locationHref: 'bad',
      }),
    ).toThrow('Unable to resolve a trusted parent origin');
  });

  it('resolves trusted game origin for shell outbound messages', () => {
    expect(
      resolveTrustedGameOrigin('/games/demo/index.html', 'https://shell.example.test'),
    ).toBe('https://shell.example.test');

    expect(
      resolveTrustedGameOrigin(
        'https://renderer.example.test/index.html?game=fruits-01',
        'https://shell.example.test',
      ),
    ).toBe('https://renderer.example.test');

    expect(
      resolveTrustedGameOrigin(
        '//cdn.example.test/renderers/mock/index.html',
        'https://shell.example.test',
      ),
    ).toBe('https://cdn.example.test');

    expect(
      resolveTrustedGameOrigin('data:text/html,hello', 'https://shell.example.test'),
    ).toBe('https://shell.example.test');

    expect(
      resolveTrustedGameOrigin('javascript:alert(1)', 'https://shell.example.test'),
    ).toBe('https://shell.example.test');

    expect(
      resolveTrustedGameOrigin('ftp://cdn.example.test/file', 'https://shell.example.test'),
    ).toBe('https://shell.example.test');
    expect(
      resolveTrustedGameOrigin('not a url', 'https://shell.example.test'),
    ).toBe('https://shell.example.test');
  });
});
