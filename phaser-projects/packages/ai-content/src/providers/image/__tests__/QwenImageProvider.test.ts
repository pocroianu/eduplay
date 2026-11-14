import { EventEmitter } from 'events';
import { readFile, writeFile } from 'fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderError } from '../../base/errors';
import { QwenImageProvider } from '../QwenImageProvider';

vi.mock('child_process', () => ({
  spawn: vi.fn()
}));

import { spawn } from 'child_process';

const transparentPixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

class MockChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn();
}

function createProvider(overrides: Record<string, unknown> = {}) {
  return new QwenImageProvider({
    name: 'qwen-test',
    baseUrl: 'http://localhost/qwen-runtime',
    timeout: 5000,
    retries: 0,
    healthCheckInterval: 30000,
    pythonPath: 'C:/fake/python.exe',
    bridgeScriptPath: 'C:/fake/qwen-image-provider.py',
    ...overrides
  } as any);
}

describe('QwenImageProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps provider requests into the bridge request file and returns image bytes', async () => {
    const spawnMock = vi.mocked(spawn);
    let observedRequest: any;
    let observedArgs: string[] = [];

    spawnMock.mockImplementation((command, args) => {
      observedArgs = [command as string, ...(args as string[])];
      const child = new MockChildProcess();

      void (async () => {
        const requestFile = observedArgs[observedArgs.indexOf('--request-file') + 1];
        observedRequest = JSON.parse(await readFile(requestFile, 'utf-8'));
        await writeFile(observedRequest.outputPath, transparentPixel);
        child.stdout.emit('data', Buffer.from(JSON.stringify({
          status: 'completed',
          filePath: observedRequest.outputPath,
          width: observedRequest.width,
          height: observedRequest.height,
          seed: observedRequest.seed,
          device: 'cuda',
          diffusersVersion: '0.38.0.dev0',
          diffusersModuleFile: 'diffusers/__init__.py',
          model: 'Qwen/Qwen-Image',
          memoryMode: 'sequential-offload'
        })));
        child.emit('close', 0);
      })();

      return child as any;
    });

    const provider = createProvider();
    const result = await provider.generate({
      prompt: 'friendly cartoon fox on white background',
      negativePrompt: 'watermark',
      width: 640,
      height: 480,
      steps: 14,
      cfgScale: 4,
      seed: 42
    });

    expect(observedArgs).toContain('--generate');
    expect(observedArgs).toContain('--memory-mode');
    expect(observedRequest).toMatchObject({
      prompt: 'friendly cartoon fox on white background',
      negativePrompt: 'watermark',
      width: 640,
      height: 480,
      steps: 14,
      trueCfgScale: 4,
      seed: 42
    });
    expect(result.data.buffer.equals(transparentPixel)).toBe(true);
    expect(result.provider).toBe('qwen-test');
    expect(result.data.seed).toBe(42);
  });

  it('surfaces bridge failures as provider errors', async () => {
    const spawnMock = vi.mocked(spawn);

    spawnMock.mockImplementation(() => {
      const child = new MockChildProcess();
      setTimeout(() => {
        child.stderr.emit('data', Buffer.from('boom'));
        child.emit('close', 1);
      }, 0);
      return child as any;
    });

    const provider = createProvider();

    await expect(
      provider.generate({
        prompt: 'friendly cartoon fox',
        width: 512,
        height: 512
      })
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it('reports missing runtime paths as unhealthy', async () => {
    const provider = createProvider({
      pythonPath: 'C:/missing/python.exe'
    });

    const health = await provider.isHealthy();

    expect(health.healthy).toBe(false);
    expect(health.message).toContain('Qwen Python runtime not found');
  });

  it('marks LoRA requests as unsupported during preflight', () => {
    const provider = createProvider();

    expect(
      provider.supportsRequest({
        prompt: 'friendly cartoon fox',
        width: 512,
        height: 512,
        lora: 'animals-lora.safetensors'
      })
    ).toEqual({
      supported: false,
      reason: 'Qwen base production mode does not support LoRA selection.'
    });
  });
});
