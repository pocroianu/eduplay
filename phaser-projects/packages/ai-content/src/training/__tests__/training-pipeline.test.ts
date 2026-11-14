/**
 * Training Pipeline Integration Tests
 *
 * End-to-end tests for the complete LoRA training pipeline
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LoRATrainer, TRAINER_EVENTS } from '../LoRATrainer';
import { TrainingProgressTracker, PROGRESS_EVENTS } from '../TrainingProgressTracker';
import { ModelManager } from '../ModelManager';
import { applyPreset, CHILDREN_BOOK_PRESET } from '../TrainingConfig';
import type { LoRATrainingConfig, TrainingJob, TrainingResult } from '../types';
import { EventEmitter } from 'events';
import { readFile, writeFile, mkdir, copyFile } from 'fs/promises';
import { existsSync } from 'fs';

// Mock modules
vi.mock('fs/promises');
vi.mock('fs');
vi.mock('ws');
global.fetch = vi.fn();

// =============================================================================
// Mock WebSocket for Integration Tests
// =============================================================================

class IntegrationMockWebSocket extends EventEmitter {
  public readyState: number = 1;
  public url: string;
  private trainingSteps: number = 0;
  private totalSteps: number = 100;
  private interval: NodeJS.Timeout | null = null;

  constructor(url: string) {
    super();
    this.url = url;

    setTimeout(() => this.emit('open'), 10);
  }

  /**
   * Simulate full training lifecycle
   */
  simulateTraining() {
    // Execution start
    setTimeout(() => {
      this.emit('message', JSON.stringify({
        type: 'execution_start',
        data: { prompt_id: 'test-123' },
      }));
    }, 50);

    // Progress updates
    this.interval = setInterval(() => {
      this.trainingSteps += 10;

      this.emit('message', JSON.stringify({
        type: 'progress',
        data: { value: this.trainingSteps, max: this.totalSteps },
      }));

      // Checkpoint at step 50
      if (this.trainingSteps === 50) {
        this.emit('message', JSON.stringify({
          type: 'executed',
          data: {
            node: '6',
            output: { checkpoint: './loras/checkpoint-5.safetensors' },
          },
        }));
      }

      // Validation at step 50
      if (this.trainingSteps === 50) {
        setTimeout(() => {
          this.emit('message', JSON.stringify({
            type: 'executed',
            data: {
              node: '7',
              output: { samples: ['./validation/sample-1.png'] },
            },
          }));
        }, 10);
      }

      // Completion at step 100
      if (this.trainingSteps >= this.totalSteps) {
        if (this.interval) {
          clearInterval(this.interval);
          this.interval = null;
        }

        setTimeout(() => {
          this.emit('message', JSON.stringify({
            type: 'executed',
            data: {
              node: '4',
              output: {
                lora_path: './loras/test-model.safetensors',
                model_size: 500000000,
                checkpoints: [
                  './loras/checkpoint-5.safetensors',
                  './loras/checkpoint-10.safetensors',
                ],
              },
            },
          }));
        }, 10);
      }
    }, 100);
  }

  /**
   * Simulate training failure
   */
  simulateFailure() {
    setTimeout(() => {
      this.emit('message', JSON.stringify({
        type: 'execution_error',
        data: {
          exception_message: 'CUDA out of memory',
          traceback: 'Stack trace...',
        },
      }));
    }, 100);
  }

  close() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.readyState = 3;
    this.emit('close');
  }
}

// =============================================================================
// Test Fixtures
// =============================================================================

const mockDataset = Array.from({ length: 10 }, (_, i) => ({
  id: `img-${i}`,
  prompt: `Training prompt ${i}`,
  imagePath: `./images/img-${i}.png`,
  negativePrompt: 'bad quality',
  category: 'test',
  style: 'children-book',
}));

const mockWorkflowTemplate = {
  nodes: {
    '1': { class_type: 'CheckpointLoader', inputs: { ckpt_name: '{{BASE_MODEL}}' } },
    '2': { class_type: 'DataLoader', inputs: { path: '{{DATASET_PATH}}' } },
    '4': { class_type: 'Trainer', inputs: {} },
    '6': { class_type: 'CheckpointSaver', inputs: {} },
    '7': { class_type: 'Validator', inputs: {} },
  },
};

// =============================================================================
// Integration Tests
// =============================================================================

describe('Training Pipeline Integration', () => {
  let trainer: LoRATrainer;
  let tracker: TrainingProgressTracker;
  let modelManager: ModelManager;
  let mockWs: IntegrationMockWebSocket;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create components
    tracker = new TrainingProgressTracker({ stateDir: './test-state', autoSave: false });
    modelManager = new ModelManager({ lorasDir: './test-loras' });

    trainer = new LoRATrainer({
      comfyuiUrl: 'http://localhost:8188',
      comfyuiWsUrl: 'ws://localhost:8188/ws',
      progressTracker: tracker,
      modelManager: modelManager,
      timeout: 10000,
    });

    // Mock file operations
    (existsSync as any).mockReturnValue(true);
    (readFile as any).mockImplementation((path: string) => {
      if (path.includes('lora-training-base.json')) {
        return Promise.resolve(JSON.stringify(mockWorkflowTemplate));
      }
      if (path.includes('.jsonl')) {
        return Promise.resolve(mockDataset.map((d) => JSON.stringify(d)).join('\n'));
      }
      if (path.includes('training-progress.json')) {
        return Promise.reject(new Error('Not found'));
      }
      return Promise.resolve('{}');
    });
    (writeFile as any).mockResolvedValue(undefined);
    (mkdir as any).mockResolvedValue(undefined);
    (copyFile as any).mockResolvedValue(undefined);

    // Mock WebSocket
    const WebSocketMock = vi.fn().mockImplementation((url: string) => {
      mockWs = new IntegrationMockWebSocket(url);
      return mockWs;
    });
    vi.doMock('ws', () => ({ default: WebSocketMock }));

    // Mock fetch
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ prompt_id: 'test-prompt-123' }),
    });
  });

  afterEach(() => {
    if (mockWs) {
      mockWs.close();
    }
  });

  // ===========================================================================
  // Full Pipeline Tests
  // ===========================================================================

  describe('complete training flow', () => {
    it('should complete full training pipeline', async () => {
      await trainer.init();
      await tracker.init();
      await modelManager.init();

      const config = applyPreset('children-book', {
        name: 'integration-test',
        datasetPath: './datasets/test.jsonl',
        epochs: 10,
        batchSize: 2,
      });

      // Track events
      const events: string[] = [];

      trainer.on(TRAINER_EVENTS.JOB_QUEUED, () => events.push('queued'));
      trainer.on(TRAINER_EVENTS.JOB_PREPARING, () => events.push('preparing'));
      trainer.on(TRAINER_EVENTS.JOB_STARTED, () => events.push('started'));
      trainer.on(TRAINER_EVENTS.PROGRESS_UPDATE, () => events.push('progress'));
      trainer.on(TRAINER_EVENTS.CHECKPOINT_SAVED, () => events.push('checkpoint'));
      trainer.on(TRAINER_EVENTS.VALIDATION_COMPLETED, () => events.push('validation'));
      trainer.on(TRAINER_EVENTS.JOB_COMPLETED, () => events.push('completed'));

      // Start training
      const trainPromise = trainer.train(config);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate training
      mockWs.simulateTraining();

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Verify event sequence
      expect(events).toContain('queued');
      expect(events).toContain('preparing');
      expect(events).toContain('started');
      expect(events).toContain('progress');
      expect(events).toContain('checkpoint');
      expect(events).toContain('validation');
      expect(events).toContain('completed');
    }, 10000);

    it('should track progress throughout training', async () => {
      await trainer.init();

      const config = applyPreset('children-book', {
        name: 'progress-test',
        datasetPath: './datasets/test.jsonl',
      });

      const progressUpdates: number[] = [];

      trainer.on(TRAINER_EVENTS.PROGRESS_UPDATE, () => {
        const progress = trainer.getProgress();
        if (progress) {
          progressUpdates.push(progress.percentage);
        }
      });

      trainer.train(config);

      await new Promise((resolve) => setTimeout(resolve, 100));
      mockWs.simulateTraining();
      await new Promise((resolve) => setTimeout(resolve, 1500));

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(Math.max(...progressUpdates)).toBeGreaterThan(50);
    }, 10000);

    it('should save checkpoints during training', async () => {
      await trainer.init();

      const config = applyPreset('children-book', {
        name: 'checkpoint-test',
        datasetPath: './datasets/test.jsonl',
        saveEveryNEpochs: 5,
      });

      const checkpoints: any[] = [];

      trainer.on(TRAINER_EVENTS.CHECKPOINT_SAVED, (data) => {
        checkpoints.push(data);
      });

      trainer.train(config);

      await new Promise((resolve) => setTimeout(resolve, 100));
      mockWs.simulateTraining();
      await new Promise((resolve) => setTimeout(resolve, 1500));

      expect(checkpoints.length).toBeGreaterThan(0);
      expect(checkpoints[0]).toHaveProperty('path');
    }, 10000);

    it('should run validation at specified epochs', async () => {
      await trainer.init();

      const config = applyPreset('children-book', {
        name: 'validation-test',
        datasetPath: './datasets/test.jsonl',
        validationEpochs: [5, 10],
        validationPrompts: ['A test prompt'],
      });

      const validations: any[] = [];

      trainer.on(TRAINER_EVENTS.VALIDATION_COMPLETED, (data) => {
        validations.push(data);
      });

      trainer.train(config);

      await new Promise((resolve) => setTimeout(resolve, 100));
      mockWs.simulateTraining();
      await new Promise((resolve) => setTimeout(resolve, 1500));

      expect(validations.length).toBeGreaterThan(0);
    }, 10000);
  });

  // ===========================================================================
  // Progress Tracker Integration
  // ===========================================================================

  describe('progress tracker integration', () => {
    it('should persist job state during training', async () => {
      await trainer.init();
      await tracker.init();

      const config = applyPreset('fast-iteration', {
        name: 'persist-test',
        datasetPath: './datasets/test.jsonl',
      });

      trainer.train(config);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const job = trainer.getCurrentJob();
      expect(job).toBeDefined();

      const trackedJob = tracker.getJobState(job!.id);
      expect(trackedJob).toBeDefined();
      expect(trackedJob?.name).toBe('persist-test');

      await trainer.cancel();
    });

    it('should update tracker on progress changes', async () => {
      await trainer.init();
      await tracker.init();

      const config = applyPreset('fast-iteration', {
        name: 'tracker-test',
        datasetPath: './datasets/test.jsonl',
      });

      const trackerUpdates: any[] = [];

      tracker.on(PROGRESS_EVENTS.JOB_PROGRESS, (job, progress) => {
        trackerUpdates.push({ job, progress });
      });

      trainer.train(config);

      await new Promise((resolve) => setTimeout(resolve, 100));
      mockWs.simulateTraining();
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(trackerUpdates.length).toBeGreaterThan(0);

      await trainer.cancel();
    }, 10000);

    it('should mark job as completed in tracker', async () => {
      await trainer.init();
      await tracker.init();

      const config = applyPreset('fast-iteration', {
        name: 'completion-test',
        datasetPath: './datasets/test.jsonl',
      });

      trainer.train(config);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const jobId = trainer.getCurrentJob()!.id;

      mockWs.simulateTraining();
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const job = tracker.getJobState(jobId);
      expect(job?.status).toBe('completed');
      expect(job?.result).toBeDefined();
    }, 10000);
  });

  // ===========================================================================
  // Model Manager Integration
  // ===========================================================================

  describe('model manager integration', () => {
    it('should save model after training completes', async () => {
      await trainer.init();
      await modelManager.init();

      const config = applyPreset('children-book', {
        name: 'model-save-test',
        datasetPath: './datasets/test.jsonl',
      });

      const saveModelSpy = vi.spyOn(modelManager, 'saveModel');

      trainer.train(config);

      await new Promise((resolve) => setTimeout(resolve, 100));
      mockWs.simulateTraining();
      await new Promise((resolve) => setTimeout(resolve, 1500));

      expect(saveModelSpy).toHaveBeenCalled();
      expect(saveModelSpy).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'model-save-test' }),
        expect.objectContaining({ loraPath: expect.any(String) }),
        expect.any(Array)
      );
    }, 10000);
  });

  // ===========================================================================
  // Error Scenarios
  // ===========================================================================

  describe('error handling integration', () => {
    it('should handle training failure gracefully', async () => {
      await trainer.init();
      await tracker.init();

      const config = applyPreset('children-book', {
        name: 'failure-test',
        datasetPath: './datasets/test.jsonl',
      });

      const failedEvents: any[] = [];

      trainer.on(TRAINER_EVENTS.JOB_FAILED, (job, error) => {
        failedEvents.push({ job, error });
      });

      tracker.on(PROGRESS_EVENTS.JOB_FAILED, (job, error) => {
        failedEvents.push({ job, error });
      });

      trainer.train(config);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const jobId = trainer.getCurrentJob()!.id;

      mockWs.simulateFailure();
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(failedEvents.length).toBeGreaterThan(0);

      const job = tracker.getJobState(jobId);
      expect(job?.status).toBe('failed');
      expect(job?.error).toBeDefined();
    }, 10000);

    it('should handle cancellation across components', async () => {
      await trainer.init();
      await tracker.init();

      const config = applyPreset('children-book', {
        name: 'cancel-test',
        datasetPath: './datasets/test.jsonl',
      });

      trainer.train(config);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const jobId = trainer.getCurrentJob()!.id;

      await trainer.cancel();

      const job = tracker.getJobState(jobId);
      expect(job?.status).toBe('cancelled');
    });
  });

  // ===========================================================================
  // Configuration Presets
  // ===========================================================================

  describe('preset integration', () => {
    it('should apply children-book preset correctly', async () => {
      await trainer.init();

      const config = applyPreset('children-book', {
        name: 'preset-test',
        datasetPath: './datasets/test.jsonl',
      });

      expect(config.baseModel).toBe('sdxl-1.0');
      expect(config.resolution).toBe(512);
      expect(config.loraRank).toBe(16);
      expect(config.minSNRGamma).toBe(5);
    });

    it('should allow preset overrides', async () => {
      await trainer.init();

      const config = applyPreset('children-book', {
        name: 'override-test',
        datasetPath: './datasets/test.jsonl',
        epochs: 50,
        batchSize: 8,
      });

      expect(config.epochs).toBe(50); // Override
      expect(config.batchSize).toBe(8); // Override
      expect(config.baseModel).toBe('sdxl-1.0'); // From preset
    });
  });

  // ===========================================================================
  // Resume Capability
  // ===========================================================================

  describe('resume capability', () => {
    it('should identify resumable jobs', async () => {
      await trainer.init();
      await tracker.init();

      const config = applyPreset('children-book', {
        name: 'resume-test',
        datasetPath: './datasets/test.jsonl',
      });

      trainer.train(config);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const jobId = trainer.getCurrentJob()!.id;

      // Simulate progress
      mockWs.emit('message', JSON.stringify({
        type: 'progress',
        data: { value: 50, max: 100 },
      }));

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate failure
      mockWs.simulateFailure();

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Check if resumable
      const canResume = tracker.canResumeJob(jobId);
      expect(canResume).toBe(true);
    }, 10000);
  });
});
