/**
 * TrainingProgressTracker Unit Tests
 *
 * Tests for persistent training progress tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TrainingProgressTracker, PROGRESS_EVENTS } from '../TrainingProgressTracker';
import type { TrainingJob, TrainingProgress, TrainingResult, TrainingError } from '../types';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

// Mock fs modules
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

// =============================================================================
// Test Fixtures
// =============================================================================

const mockJob: TrainingJob = {
  id: 'job-001',
  name: 'test-model',
  status: 'pending',
  config: {
    name: 'test-model',
    datasetPath: './data.jsonl',
    baseModel: 'sdxl-1.0',
    resolution: 512,
    epochs: 100,
    batchSize: 4,
    learningRate: 1e-4,
    loraRank: 16,
    loraAlpha: 32,
    optimizer: 'AdamW8bit',
    lrScheduler: 'cosine',
    mixedPrecision: 'fp16',
    saveEveryNEpochs: 10,
    keepNCheckpoints: 5,
    validationEpochs: [25, 50, 75, 100],
  },
  progress: {
    currentEpoch: 0,
    totalEpochs: 100,
    currentStep: 0,
    totalSteps: 1000,
    stepsPerEpoch: 10,
    currentLoss: 0,
    avgLoss: 0,
    learningRate: 1e-4,
    stepsPerSecond: 0,
    epochsPerHour: 0,
    percentage: 0,
  },
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
};

const mockProgress: Partial<TrainingProgress> = {
  currentEpoch: 10,
  currentStep: 100,
  currentLoss: 0.5,
  avgLoss: 0.55,
  stepsPerSecond: 2.5,
  percentage: 10,
};

const mockResult: TrainingResult = {
  loraPath: './loras/test-model.safetensors',
  modelSize: 500 * 1024 * 1024, // 500 MB
  finalLoss: 0.25,
  avgLoss: 0.45,
  totalSteps: 1000,
  totalEpochs: 100,
  trainingDuration: 7200, // 2 hours
  avgStepsPerSecond: 2.5,
  checkpoints: ['./loras/test-model-epoch-10.safetensors'],
  completedAt: new Date('2025-01-01T02:00:00Z'),
};

const mockError: TrainingError = {
  code: 'OUT_OF_MEMORY',
  message: 'CUDA out of memory',
  timestamp: new Date('2025-01-01T01:00:00Z'),
  epoch: 50,
  step: 500,
  canResume: true,
  suggestedAction: 'Reduce batch size or enable CPU offload',
};

// =============================================================================
// Setup/Teardown
// =============================================================================

describe('TrainingProgressTracker', () => {
  let tracker: TrainingProgressTracker;

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = new TrainingProgressTracker({ stateDir: './test-state' });
    (existsSync as any).mockReturnValue(true);
  });

  afterEach(async () => {
    await tracker.cleanup();
  });

  // ===========================================================================
  // Initialization Tests
  // ===========================================================================

  describe('init', () => {
    it('should create state directory if missing', async () => {
      (existsSync as any).mockReturnValue(false);
      (mkdir as any).mockResolvedValue(undefined);
      (readFile as any).mockRejectedValue(new Error('File not found'));

      await tracker.init();

      expect(mkdir).toHaveBeenCalledWith('./test-state', { recursive: true });
    });

    it('should load existing state on init', async () => {
      const state = {
        version: '1.0.0',
        savedAt: '2025-01-01T00:00:00Z',
        jobs: [mockJob],
      };

      (existsSync as any).mockReturnValue(true);
      (readFile as any).mockResolvedValue(JSON.stringify(state));

      const loadedSpy = vi.fn();
      tracker.on(PROGRESS_EVENTS.STATE_LOADED, loadedSpy);

      await tracker.init();

      expect(readFile).toHaveBeenCalled();
      expect(loadedSpy).toHaveBeenCalled();

      const job = tracker.getJobState('job-001');
      expect(job).toBeDefined();
      expect(job?.name).toBe('test-model');
    });

    it('should handle missing state file gracefully', async () => {
      (existsSync as any).mockReturnValue(false);

      await tracker.init();

      expect(tracker.getAllJobs()).toHaveLength(0);
    });

    it('should handle corrupted state file', async () => {
      (existsSync as any).mockReturnValue(true);
      (readFile as any).mockResolvedValue('invalid json{');

      await tracker.init();

      expect(tracker.getAllJobs()).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Job Tracking Tests
  // ===========================================================================

  describe('startTracking', () => {
    it('should start tracking a new job', async () => {
      (writeFile as any).mockResolvedValue(undefined);

      const startedSpy = vi.fn();
      tracker.on(PROGRESS_EVENTS.JOB_STARTED, startedSpy);

      await tracker.startTracking(mockJob);

      expect(startedSpy).toHaveBeenCalledWith(mockJob);

      const job = tracker.getJobState('job-001');
      expect(job).toEqual(mockJob);
    });

    it('should auto-save when tracking new job', async () => {
      (writeFile as any).mockResolvedValue(undefined);

      await tracker.startTracking(mockJob);

      expect(writeFile).toHaveBeenCalled();
    });

    it('should not auto-save if disabled', async () => {
      tracker = new TrainingProgressTracker({ autoSave: false });
      (writeFile as any).mockResolvedValue(undefined);

      await tracker.startTracking(mockJob);

      expect(writeFile).not.toHaveBeenCalled();
    });
  });

  describe('updateProgress', () => {
    beforeEach(async () => {
      (writeFile as any).mockResolvedValue(undefined);
      await tracker.startTracking(mockJob);
      vi.clearAllMocks();
    });

    it('should update job progress', async () => {
      const progressSpy = vi.fn();
      tracker.on(PROGRESS_EVENTS.JOB_PROGRESS, progressSpy);

      await tracker.updateProgress('job-001', mockProgress);

      expect(progressSpy).toHaveBeenCalled();

      const job = tracker.getJobState('job-001');
      expect(job?.progress.currentEpoch).toBe(10);
      expect(job?.progress.currentStep).toBe(100);
      expect(job?.progress.currentLoss).toBe(0.5);
    });

    it('should calculate ETA', async () => {
      await tracker.updateProgress('job-001', {
        currentStep: 100,
        totalSteps: 1000,
        stepsPerSecond: 2.5,
      });

      const job = tracker.getJobState('job-001');
      expect(job?.estimatedEndTime).toBeDefined();
    });

    it('should throw if job not found', async () => {
      await expect(tracker.updateProgress('unknown', mockProgress)).rejects.toThrow('Job not found');
    });

    it('should merge progress updates', async () => {
      await tracker.updateProgress('job-001', { currentEpoch: 5 });
      await tracker.updateProgress('job-001', { currentStep: 50 });

      const job = tracker.getJobState('job-001');
      expect(job?.progress.currentEpoch).toBe(5);
      expect(job?.progress.currentStep).toBe(50);
    });
  });

  describe('updateStatus', () => {
    beforeEach(async () => {
      (writeFile as any).mockResolvedValue(undefined);
      await tracker.startTracking(mockJob);
      vi.clearAllMocks();
    });

    it('should update job status', async () => {
      await tracker.updateStatus('job-001', 'training');

      const job = tracker.getJobState('job-001');
      expect(job?.status).toBe('training');
    });

    it('should set startedAt when status becomes training', async () => {
      await tracker.updateStatus('job-001', 'training');

      const job = tracker.getJobState('job-001');
      expect(job?.startedAt).toBeDefined();
    });

    it('should throw if job not found', async () => {
      await expect(tracker.updateStatus('unknown', 'training')).rejects.toThrow('Job not found');
    });
  });

  describe('completeJob', () => {
    beforeEach(async () => {
      (writeFile as any).mockResolvedValue(undefined);
      await tracker.startTracking(mockJob);
      vi.clearAllMocks();
    });

    it('should mark job as completed', async () => {
      const completedSpy = vi.fn();
      tracker.on(PROGRESS_EVENTS.JOB_COMPLETED, completedSpy);

      await tracker.completeJob('job-001', mockResult);

      expect(completedSpy).toHaveBeenCalled();

      const job = tracker.getJobState('job-001');
      expect(job?.status).toBe('completed');
      expect(job?.result).toEqual(mockResult);
      expect(job?.completedAt).toBeDefined();
    });

    it('should throw if job not found', async () => {
      await expect(tracker.completeJob('unknown', mockResult)).rejects.toThrow('Job not found');
    });
  });

  describe('failJob', () => {
    beforeEach(async () => {
      (writeFile as any).mockResolvedValue(undefined);
      await tracker.startTracking(mockJob);
      vi.clearAllMocks();
    });

    it('should mark job as failed', async () => {
      const failedSpy = vi.fn();
      tracker.on(PROGRESS_EVENTS.JOB_FAILED, failedSpy);

      await tracker.failJob('job-001', mockError);

      expect(failedSpy).toHaveBeenCalled();

      const job = tracker.getJobState('job-001');
      expect(job?.status).toBe('failed');
      expect(job?.error).toEqual(mockError);
      expect(job?.completedAt).toBeDefined();
    });

    it('should throw if job not found', async () => {
      await expect(tracker.failJob('unknown', mockError)).rejects.toThrow('Job not found');
    });
  });

  describe('cancelJob', () => {
    beforeEach(async () => {
      (writeFile as any).mockResolvedValue(undefined);
      await tracker.startTracking(mockJob);
      vi.clearAllMocks();
    });

    it('should mark job as cancelled', async () => {
      const cancelledSpy = vi.fn();
      tracker.on(PROGRESS_EVENTS.JOB_CANCELLED, cancelledSpy);

      await tracker.cancelJob('job-001');

      expect(cancelledSpy).toHaveBeenCalled();

      const job = tracker.getJobState('job-001');
      expect(job?.status).toBe('cancelled');
      expect(job?.completedAt).toBeDefined();
    });

    it('should throw if job not found', async () => {
      await expect(tracker.cancelJob('unknown')).rejects.toThrow('Job not found');
    });
  });

  // ===========================================================================
  // Query Tests
  // ===========================================================================

  describe('getJobState', () => {
    it('should return job by ID', async () => {
      (writeFile as any).mockResolvedValue(undefined);
      await tracker.startTracking(mockJob);

      const job = tracker.getJobState('job-001');
      expect(job).toBeDefined();
      expect(job?.id).toBe('job-001');
    });

    it('should return null for unknown job', () => {
      const job = tracker.getJobState('unknown');
      expect(job).toBeNull();
    });
  });

  describe('getAllJobs', () => {
    it('should return all jobs', async () => {
      (writeFile as any).mockResolvedValue(undefined);

      await tracker.startTracking(mockJob);
      await tracker.startTracking({ ...mockJob, id: 'job-002', name: 'model-2' });

      const jobs = tracker.getAllJobs();
      expect(jobs).toHaveLength(2);
    });

    it('should return empty array if no jobs', () => {
      const jobs = tracker.getAllJobs();
      expect(jobs).toHaveLength(0);
    });
  });

  describe('getJobsByStatus', () => {
    beforeEach(async () => {
      (writeFile as any).mockResolvedValue(undefined);
      await tracker.startTracking(mockJob);
      await tracker.startTracking({ ...mockJob, id: 'job-002', status: 'training' });
      await tracker.startTracking({ ...mockJob, id: 'job-003', status: 'completed' });
    });

    it('should filter jobs by status', () => {
      const pending = tracker.getJobsByStatus('pending');
      const training = tracker.getJobsByStatus('training');
      const completed = tracker.getJobsByStatus('completed');

      expect(pending).toHaveLength(1);
      expect(training).toHaveLength(1);
      expect(completed).toHaveLength(1);
    });
  });

  describe('getActiveJobs', () => {
    beforeEach(async () => {
      (writeFile as any).mockResolvedValue(undefined);
      await tracker.startTracking(mockJob); // pending
      await tracker.startTracking({ ...mockJob, id: 'job-002', status: 'training' });
      await tracker.startTracking({ ...mockJob, id: 'job-003', status: 'completed' });
    });

    it('should return only active jobs', () => {
      const active = tracker.getActiveJobs();
      expect(active).toHaveLength(2);
      expect(active.every((j) => ['pending', 'preparing', 'training'].includes(j.status))).toBe(true);
    });
  });

  describe('canResumeJob', () => {
    it('should return true for resumable failed job', async () => {
      (writeFile as any).mockResolvedValue(undefined);

      const job = {
        ...mockJob,
        status: 'failed' as const,
        progress: { ...mockJob.progress, currentEpoch: 10 },
        error: { ...mockError, canResume: true },
      };

      await tracker.startTracking(job);

      expect(tracker.canResumeJob('job-001')).toBe(true);
    });

    it('should return false for non-resumable failed job', async () => {
      (writeFile as any).mockResolvedValue(undefined);

      const job = {
        ...mockJob,
        status: 'failed' as const,
        progress: { ...mockJob.progress, currentEpoch: 10 },
        error: { ...mockError, canResume: false },
      };

      await tracker.startTracking(job);

      expect(tracker.canResumeJob('job-001')).toBe(false);
    });

    it('should return false for job at epoch 0', async () => {
      (writeFile as any).mockResolvedValue(undefined);

      const job = {
        ...mockJob,
        status: 'failed' as const,
        progress: { ...mockJob.progress, currentEpoch: 0 },
        error: { ...mockError, canResume: true },
      };

      await tracker.startTracking(job);

      expect(tracker.canResumeJob('job-001')).toBe(false);
    });

    it('should return false for unknown job', () => {
      expect(tracker.canResumeJob('unknown')).toBe(false);
    });
  });

  // ===========================================================================
  // Report Generation Tests
  // ===========================================================================

  describe('generateReport', () => {
    it('should generate report for completed job', async () => {
      (writeFile as any).mockResolvedValue(undefined);

      const job = {
        ...mockJob,
        status: 'completed' as const,
        result: mockResult,
      };

      await tracker.startTracking(job);

      const report = tracker.generateReport('job-001');

      expect(report).toContain('test-model');
      expect(report).toContain('COMPLETED');
      expect(report).toContain('500.00 MB');
      expect(report).toContain('0.2500'); // final loss
    });

    it('should generate report for failed job', async () => {
      (writeFile as any).mockResolvedValue(undefined);

      const job = {
        ...mockJob,
        status: 'failed' as const,
        error: mockError,
      };

      await tracker.startTracking(job);

      const report = tracker.generateReport('job-001');

      expect(report).toContain('FAILED');
      expect(report).toContain('OUT_OF_MEMORY');
      expect(report).toContain('CUDA out of memory');
    });

    it('should generate report for in-progress job', async () => {
      (writeFile as any).mockResolvedValue(undefined);

      await tracker.startTracking(mockJob);
      await tracker.updateProgress('job-001', mockProgress);

      const report = tracker.generateReport('job-001');

      expect(report).toContain('Epoch: 10 / 100');
      expect(report).toContain('10.0%');
    });

    it('should return error message for unknown job', () => {
      const report = tracker.generateReport('unknown');
      expect(report).toContain('Job not found');
    });
  });

  // ===========================================================================
  // Cleanup Tests
  // ===========================================================================

  describe('clearOldJobs', () => {
    beforeEach(async () => {
      (writeFile as any).mockResolvedValue(undefined);

      // Add old completed job
      const oldJob = {
        ...mockJob,
        id: 'old-job',
        status: 'completed' as const,
        completedAt: new Date('2020-01-01'),
      };

      // Add recent completed job
      const recentJob = {
        ...mockJob,
        id: 'recent-job',
        status: 'completed' as const,
        completedAt: new Date(),
      };

      await tracker.startTracking(oldJob);
      await tracker.startTracking(recentJob);
      await tracker.startTracking(mockJob); // pending, no completedAt
    });

    it('should clear old completed jobs', async () => {
      const cleared = await tracker.clearOldJobs(30); // 30 days

      expect(cleared).toBe(1); // Only old-job
      expect(tracker.getJobState('old-job')).toBeNull();
      expect(tracker.getJobState('recent-job')).not.toBeNull();
      expect(tracker.getJobState('job-001')).not.toBeNull();
    });

    it('should not clear active jobs', async () => {
      const cleared = await tracker.clearOldJobs(0); // 0 days

      expect(tracker.getJobState('job-001')).not.toBeNull(); // pending job kept
    });
  });

  // ===========================================================================
  // State Persistence Tests
  // ===========================================================================

  describe('saveState', () => {
    it('should save state to file', async () => {
      (writeFile as any).mockResolvedValue(undefined);
      (mkdir as any).mockResolvedValue(undefined);

      await tracker.startTracking(mockJob);

      const savedSpy = vi.fn();
      tracker.on(PROGRESS_EVENTS.STATE_SAVED, savedSpy);

      await tracker.saveState();

      expect(writeFile).toHaveBeenCalled();
      expect(savedSpy).toHaveBeenCalled();
    });

    it('should include version and timestamp', async () => {
      (writeFile as any).mockResolvedValue(undefined);
      await tracker.startTracking(mockJob);
      await tracker.saveState();

      const savedData = JSON.parse((writeFile as any).mock.calls[0][1]);

      expect(savedData.version).toBe('1.0.0');
      expect(savedData.savedAt).toBeDefined();
      expect(savedData.jobs).toHaveLength(1);
    });
  });

  describe('cleanup', () => {
    it('should save dirty state on cleanup', async () => {
      (writeFile as any).mockResolvedValue(undefined);

      await tracker.startTracking(mockJob);
      vi.clearAllMocks();

      await tracker.cleanup();

      // Should have saved
      expect(writeFile).toHaveBeenCalled();
    });

    it('should remove all listeners', async () => {
      const spy = vi.fn();
      tracker.on(PROGRESS_EVENTS.JOB_STARTED, spy);

      await tracker.cleanup();

      expect(tracker.listenerCount(PROGRESS_EVENTS.JOB_STARTED)).toBe(0);
    });
  });
});
