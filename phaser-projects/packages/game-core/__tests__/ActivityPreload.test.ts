import { EventEmitter } from 'node:events';
import type Phaser from 'phaser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { preloadActivity } from '../src/templates/ActivityPreload';
import ConfigLoader from '../src/services/ConfigLoader';
import { resolveTemplateImageAssets } from '../src/templates/TemplateAssetPreload';

vi.mock('../src/services/ConfigLoader', () => ({
  default: {
    getInstance: () => ({ loadTemplateConfig: load }),
    getGameIdFromUrl: () => null,
    getLanguageFromUrl: () => null,
  },
}));
const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('../src/templates/TemplateAssetPreload', () => ({
  resolveTemplateImageAssets: vi.fn(async () => []),
  resolveTemplateAudioAssets: vi.fn(async () => []),
}));
function fixture(cached = false) {
  const events = new EventEmitter(),
    loader = new EventEmitter();
  const start = vi.fn(),
    image = vi.fn(),
    begin = vi.fn(),
    destroy = vi.fn();
  const text = { destroy, setOrigin: vi.fn().mockReturnThis() };
  const scene = {
    events,
    load: Object.assign(loader, { image, audio: vi.fn(), start: begin }),
    textures: { exists: () => cached },
    cache: { audio: { exists: () => cached } },
    cameras: { main: { width: 800, height: 600 } },
    add: { text: vi.fn(() => text) },
    scene: { start },
  };
  return {
    scene: scene as unknown as Phaser.Scene,
    events,
    loader,
    start,
    image,
    begin,
    destroy,
  };
}
const options = {
  gameId: 'animals',
  language: 'en' as const,
  nextScene: 'Level',
  label: 'Test',
  discoverAssets: () => ({ images: ['apple'] }),
};
beforeEach(() => {
  vi.clearAllMocks();
  load.mockResolvedValue({ config: {} });
  vi.mocked(resolveTemplateImageAssets).mockResolvedValue([
    { type: 'image', key: 'apple', url: '/apple.png' },
  ]);
});
describe('Activity preload lifecycle interface', () => {
  it('starts immediately with cached assets and never starts an empty loader', async () => {
    const e = fixture(true);
    await preloadActivity(e.scene, options);
    expect(e.start).toHaveBeenCalledWith('Level');
    expect(e.begin).not.toHaveBeenCalled();
    expect(e.loader.listenerCount('complete')).toBe(0);
  });
  it('queues missing assets, tolerates load errors, and hands off once', async () => {
    const e = fixture(),
      warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await preloadActivity(e.scene, options);
    expect(e.image).toHaveBeenCalledWith('apple', '/apple.png');
    expect(e.start).not.toHaveBeenCalled();
    e.loader.emit('loaderror', { key: 'apple', src: '/apple.png' });
    e.loader.emit('complete');
    e.loader.emit('complete');
    expect(warn).toHaveBeenCalled();
    expect(e.start).toHaveBeenCalledTimes(1);
    expect(e.destroy).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
  it('ignores asynchronous work after scene shutdown', async () => {
    const e = fixture();
    let resolve!: (value: { config: object }) => void;
    load.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const pending = preloadActivity(e.scene, options);
    e.events.emit('shutdown');
    resolve({ config: {} });
    await pending;
    expect(e.image).not.toHaveBeenCalled();
    expect(e.start).not.toHaveBeenCalled();
    expect(e.loader.listenerCount('loaderror')).toBe(0);
  });
  it('removes completion callbacks when interrupted during loading', async () => {
    const e = fixture();
    await preloadActivity(e.scene, options);
    e.events.emit('shutdown');
    e.loader.emit('complete');
    expect(e.start).not.toHaveBeenCalled();
    expect(e.destroy).toHaveBeenCalledTimes(1);
  });
  it('shows config errors instead of starting the playable scene', async () => {
    const e = fixture(),
      log = vi.spyOn(console, 'error').mockImplementation(() => {});
    load.mockRejectedValue(new Error('missing pin'));
    await preloadActivity(e.scene, options);
    expect(e.start).not.toHaveBeenCalled();
    expect(e.loader.listenerCount('loaderror')).toBe(0);
    log.mockRestore();
  });
});
