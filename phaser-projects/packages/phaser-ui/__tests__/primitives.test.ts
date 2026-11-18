import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => {
  class Container {
    scene: any;
    constructor(scene: any) { this.scene = scene; }
    add() { return this; }
    setAlpha() { return this; }
    setPosition() { return this; }
  }
  return {
    default: {
      GameObjects: { Container },
      Geom: { Rectangle: class { constructor(public x: number, public y: number, public width: number, public height: number) {} static Contains() { return true; } } },
    },
  };
});

import { ChunkyButton, computeHitSize, MIN_TAP_TARGET } from '../src/primitives/ChunkyButton';
import { prefersReducedMotion } from '../src/primitives/reducedMotion';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('computeHitSize', () => {
  it.each([
    ['sm', 64, 19 + 16, 3],
    ['md', 80, 23 + 24, 4],
    ['lg', 120, 27 + 32, 5],
  ])('expands %s button to at least the minimum tap target', (_n, w, h, depth) => {
    const hit = computeHitSize(w, h, depth);
    expect(hit.width).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
    expect(hit.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
  });

  it('never shrinks a larger visual', () => {
    expect(computeHitSize(200, 100, 5)).toEqual({ width: 200, height: 105 });
  });
});

describe('prefersReducedMotion', () => {
  it('uses the game-core accessibility manager flag', () => {
    vi.stubGlobal('window', { __A11Y_MANAGER__: { isReducedMotion: () => true } });
    expect(prefersReducedMotion()).toBe(true);
  });

  it('falls back to matchMedia', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    expect(prefersReducedMotion()).toBe(true);
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('ChunkyButton.pulse', () => {
  function makeButton() {
    const add = vi.fn();
    const button = Object.create(ChunkyButton.prototype);
    button.scene = { tweens: { add } };
    button.faceGfx = {};
    return { button: button as ChunkyButton, add };
  }

  it('does not animate scale under reduced motion', () => {
    vi.stubGlobal('window', { __A11Y_MANAGER__: { isReducedMotion: () => true } });
    const { button, add } = makeButton();
    button.pulse();
    const cfg = add.mock.calls[0][0];
    expect(cfg.scaleX).toBeUndefined();
    expect(cfg.scaleY).toBeUndefined();
  });

  it('animates scale otherwise', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    const { button, add } = makeButton();
    button.pulse();
    expect(add.mock.calls[0][0].scaleX).toBe(0.96);
  });
});
