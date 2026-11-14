import { EventEmitter } from 'events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReadStream, existsSync } from 'fs';
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'fs/promises';

const { wsConstructorMock } = vi.hoisted(() => ({
  wsConstructorMock: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  copyFile: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
  readdir: vi.fn(),
  rm: vi.fn(),
  stat: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  createReadStream: vi.fn(),
}));

vi.mock('ws', () => ({
  default: wsConstructorMock,
}));

import { LoRATrainer, TRAINER_EVENTS } from '../LoRATrainer';
import type { LoRATrainingConfig } from '../types';

class MockWebSocket extends EventEmitter {
  public readyState = 1;
  public url: string;

  constructor(url: string) {
    super();
    this.url = url;

    setTimeout(() => {
      this.emit('open');
    }, 0);
  }

  close(): void {
    this.readyState = 3;
    this.emit('close');
  }
}

const mockConfig: LoRATrainingConfig = {
  name: 'animals-smoke',
  datasetPath: './training-data/datasets/image/train.jsonl',
  baseModel: 'sdxl-1.0',
  resolution: 512,
  epochs: 5,
  batchSize: 1,
  learningRate: 1e-4,
  loraRank: 16,
  loraAlpha: 32,
  optimizer: 'AdamW8bit',
  lrScheduler: 'cosine',
  mixedPrecision: 'fp16',
  saveEveryNEpochs: 5,
  keepNCheckpoints: 1,
  validationEpochs: [5],
  validationPrompts: ['friendly cartoon fox'],
  outputDir: './loras',
};

const datasetEntries = [
  {
    id: 'animals-bat',
    imagePath: './training-data/raw/assets/images/animals/bat.png',
    prompt: 'friendly bat, preschool flashcard style',
  },
  {
    id: 'animals-bee',
    imagePath: './training-data/raw/assets/images/animals/bee.png',
    prompt: 'friendly bee, preschool flashcard style',
  },
];

describe('LoRATrainer', () => {
  let trainer: LoRATrainer;
  let wsFactory: ReturnType<typeof vi.fn>;
  let mockWs: MockWebSocket;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();

    mockWs = new MockWebSocket('ws://localhost:8188/ws?clientId=test');
    wsFactory = vi.fn().mockImplementation((url: string) => {
      mockWs = new MockWebSocket(url);
      return mockWs;
    });
    wsConstructorMock.mockImplementation(wsFactory);

    (existsSync as unknown as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (path.includes('training-progress.json')) {
        return false;
      }

      return !path.includes('missing');
    });

    (createReadStream as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const stream = new EventEmitter();
      setTimeout(() => {
        stream.emit('data', Buffer.from('trained-model'));
        stream.emit('end');
      }, 0);
      return stream;
    });

    (readFile as unknown as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (path.includes('lora-training-base.json')) {
        return Promise.resolve(JSON.stringify({
          metadata: { title: 'Workflow' },
          nodes: { '1': { class_type: 'SDXLLoraTrainer', inputs: {} } },
        }));
      }

      if (path.includes('train.jsonl')) {
        return Promise.resolve(datasetEntries.map((entry) => JSON.stringify(entry)).join('\n'));
      }

      if (path.includes('training-progress.json')) {
        return Promise.reject(new Error('ENOENT'));
      }

      return Promise.resolve('{}');
    });

    (mkdir as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (writeFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (copyFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (rm as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (readdir as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (stat as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      size: 1024,
      mtimeMs: Date.now(),
    });

    global.fetch = vi.fn().mockImplementation((input: string) => {
      if (input.endsWith('/system_stats')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ devices: [] }),
        });
      }

      if (input.endsWith('/object_info')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            SDXLLoraTrainer: {
              input: {
                required: {
                  ckpt_name: [['sd_xl_base_1.0.safetensors']],
                },
              },
            },
          }),
        });
      }

      if (input.endsWith('/prompt')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ prompt_id: 'prompt-123' }),
        });
      }

      if (input.endsWith('/interrupt')) {
        return Promise.resolve({ ok: true });
      }

      throw new Error(`Unexpected fetch: ${input}`);
    }) as any;

    trainer = new LoRATrainer({
      comfyuiUrl: 'http://localhost:8188',
      comfyuiWsUrl: 'ws://localhost:8188/ws',
      timeout: 1000,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('preflight validates dataset paths and required nodes', async () => {
    await trainer.init();

    const result = await trainer.preflight(mockConfig);

    expect(result.datasetEntries).toBe(2);
    expect(result.imageCount).toBe(2);
    expect(result.requiredNodes).toEqual(['SDXLLoraTrainer']);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8188/object_info',
      expect.any(Object),
    );
  });

  it('builds an SDXL trainer workflow and stages caption files', async () => {
    await trainer.init();

    await trainer.train(mockConfig);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(copyFile).toHaveBeenCalledWith(
      expect.stringContaining('bat.png'),
      expect.stringContaining('000.png'),
    );
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('000.txt'),
      datasetEntries[0].prompt,
      'utf-8',
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8188/prompt',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('SDXLLoraTrainer'),
      }),
    );

    await trainer.cancel();
  });

  it('fails preflight when required training node is missing', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((input: string) => {
      if (input.endsWith('/system_stats')) {
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }

      if (input.endsWith('/object_info')) {
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }

      throw new Error(`Unexpected fetch: ${input}`);
    });

    await trainer.init();

    await expect(trainer.preflight(mockConfig)).rejects.toThrow('Missing required ComfyUI training nodes');
  });

  it('resolves the final LoRA artifact from the host output directory on completion', async () => {
    await trainer.init();

    (readdir as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ isFile: () => true, name: 'animals-smoke_1.safetensors' }])
      .mockResolvedValue([]);

    const completedSpy = vi.fn();
    trainer.on(TRAINER_EVENTS.JOB_COMPLETED, completedSpy);

    await trainer.train(mockConfig);
    await new Promise((resolve) => setTimeout(resolve, 10));

    mockWs.emit('message', JSON.stringify({
      type: 'executed',
      data: {
        node: '1',
        output: {},
      },
    }));

    mockWs.emit('message', JSON.stringify({
      type: 'executing',
      data: {
        node: null,
        prompt_id: 'prompt-123',
      },
    }));

    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(completedSpy).toHaveBeenCalled();
    const completedJob = completedSpy.mock.calls[0][0];
    expect(completedJob.result?.loraPath).toContain('animals-smoke_1.safetensors');
  });

  it('cancels an active job through the interrupt endpoint', async () => {
    await trainer.init();
    await trainer.train(mockConfig);
    await new Promise((resolve) => setTimeout(resolve, 10));

    await trainer.cancel();

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8188/interrupt',
      { method: 'POST' },
    );
  });
});
