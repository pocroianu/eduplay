/**
 * Validation Pipeline Tests
 *
 * @module validation/__tests__/ValidationPipeline
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import sharp from 'sharp';
import {
  ValidationPipeline,
  ValidationEvents,
  DEFAULT_PIPELINE_CONFIG
} from '../ValidationPipeline';

describe('ValidationPipeline', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `validation-pipeline-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('Pipeline Execution', () => {
    it('should run all stages in order', async () => {
      const gamePath = await createValidGame(testDir, 'pipeline-test');
      const pipeline = new ValidationPipeline(DEFAULT_PIPELINE_CONFIG);

      const stagesCompleted: string[] = [];

      pipeline.on(ValidationEvents.STAGE_COMPLETED, ({ stage }: any) => {
        stagesCompleted.push(stage);
      });

      const report = await pipeline.validate(gamePath, 'pipeline-test');

      expect(stagesCompleted).toContain('basic');
      expect(stagesCompleted).toContain('quality');
      expect(stagesCompleted).toContain('compliance');
      expect(report).toBeDefined();
    });

    it('should emit progress events', async () => {
      const gamePath = await createValidGame(testDir, 'progress-test');
      const pipeline = new ValidationPipeline(DEFAULT_PIPELINE_CONFIG);

      const progressEvents: any[] = [];

      pipeline.on(ValidationEvents.PROGRESS, (event: any) => {
        progressEvents.push(event);
      });

      await pipeline.validate(gamePath, 'progress-test');

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0]).toHaveProperty('stage');
      expect(progressEvents[0]).toHaveProperty('progress');
      expect(progressEvents[0]).toHaveProperty('message');
    });

    it('should complete successfully for valid game', async () => {
      const gamePath = await createValidGame(testDir, 'valid-game');
      const pipeline = new ValidationPipeline(DEFAULT_PIPELINE_CONFIG);

      const report = await pipeline.validate(gamePath, 'valid-game');

      expect(report.passed).toBe(true);
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.summary.criticalIssues).toBe(0);
    });
  });

  describe('Fail-Fast Mode', () => {
    it('should stop on first critical failure when fail-fast enabled', async () => {
      const gamePath = join(testDir, 'fail-fast-test');
      await mkdir(gamePath, { recursive: true });

      // Create invalid config (will fail basic validation)
      await writeFile(join(gamePath, 'config.json'), '{ invalid }');

      const pipeline = new ValidationPipeline({
        ...DEFAULT_PIPELINE_CONFIG,
        failFast: true
      });

      const stagesCompleted: string[] = [];

      pipeline.on(ValidationEvents.STAGE_COMPLETED, ({ stage }: any) => {
        stagesCompleted.push(stage);
      });

      const report = await pipeline.validate(gamePath, 'fail-fast-test');

      expect(report.passed).toBe(false);
      // Should not complete all stages
      expect(stagesCompleted.length).toBeLessThan(3);
    });
  });

  describe('Report Generation', () => {
    it('should generate comprehensive validation report', async () => {
      const gamePath = await createValidGame(testDir, 'report-test');
      const pipeline = new ValidationPipeline(DEFAULT_PIPELINE_CONFIG);

      const report = await pipeline.validate(gamePath, 'report-test');

      expect(report).toHaveProperty('gameId');
      expect(report).toHaveProperty('validatedAt');
      expect(report).toHaveProperty('validationDuration');
      expect(report).toHaveProperty('passed');
      expect(report).toHaveProperty('overallScore');
      expect(report).toHaveProperty('stages');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('recommendations');
    });

    it('should include stage results', async () => {
      const gamePath = await createValidGame(testDir, 'stages-test');
      const pipeline = new ValidationPipeline(DEFAULT_PIPELINE_CONFIG);

      const report = await pipeline.validate(gamePath, 'stages-test');

      expect(report.stages.basic).toBeDefined();
      expect(report.stages.quality).toBeDefined();
      expect(report.stages.compliance).toBeDefined();
    });

    it('should calculate summary statistics', async () => {
      const gamePath = await createValidGame(testDir, 'summary-test');
      const pipeline = new ValidationPipeline(DEFAULT_PIPELINE_CONFIG);

      const report = await pipeline.validate(gamePath, 'summary-test');

      expect(report.summary).toHaveProperty('totalIssues');
      expect(report.summary).toHaveProperty('criticalIssues');
      expect(report.summary).toHaveProperty('highIssues');
      expect(report.summary).toHaveProperty('mediumIssues');
      expect(report.summary).toHaveProperty('lowIssues');
    });

    it('should generate recommendations', async () => {
      const gamePath = await createValidGame(testDir, 'recommendations-test');
      const pipeline = new ValidationPipeline(DEFAULT_PIPELINE_CONFIG);

      const report = await pipeline.validate(gamePath, 'recommendations-test');

      expect(Array.isArray(report.recommendations)).toBe(true);
      if (report.passed) {
        expect(report.recommendations.length).toBeGreaterThan(0);
        expect(report.recommendations[0]).toContain('ready');
      }
    });
  });

  describe('Configuration', () => {
    it('should respect custom configuration', async () => {
      const gamePath = await createValidGame(testDir, 'custom-config');

      const customConfig = {
        ...DEFAULT_PIPELINE_CONFIG,
        stages: ['basic'] as any, // Only run basic validation
        failFast: true
      };

      const pipeline = new ValidationPipeline(customConfig);

      const report = await pipeline.validate(gamePath, 'custom-config');

      expect(report.stages.basic).toBeDefined();
      // Other stages should not run
      expect(report.stages.quality).toBeUndefined();
      expect(report.stages.compliance).toBeUndefined();
    });

    it('should allow configuration updates', () => {
      const pipeline = new ValidationPipeline(DEFAULT_PIPELINE_CONFIG);

      pipeline.updateConfig({
        failFast: true,
        enableRemediation: true
      });

      // Configuration should be updated
      expect(pipeline['config'].failFast).toBe(true);
      expect(pipeline['config'].enableRemediation).toBe(true);
    });
  });
});

/**
 * Helper: Create a valid game for testing
 */
async function createValidGame(
  baseDir: string,
  gameId: string
): Promise<string> {
  const gamePath = join(baseDir, gameId);
  await mkdir(gamePath, { recursive: true });
  await mkdir(join(gamePath, 'assets'), { recursive: true });

  // Create config
  const config = {
    meta: {
      gameId,
      version: '1.0.0',
      themeName: 'nature',
      difficulty: 'easy',
      totalSteps: 1,
      supportedLanguages: ['en']
    },
    questions: [
      {
        id: 'q1',
        questionKey: 'q1.question',
        choices: [
          {
            id: 'q1_choice1',
            textKey: 'q1.choices.q1_choice1',
            assetPath: 'assets/q1_choice1.png',
            correct: true
          }
        ]
      }
    ]
  };

  await writeFile(
    join(gamePath, 'config.json'),
    JSON.stringify(config, null, 2)
  );

  // Create i18n
  const i18n = {
    meta: {
      title: 'Test Game'
    },
    questions: {
      q1: {
        question: 'Which one is correct?',
        choices: {
          q1_choice1: 'Apple'
        }
      }
    }
  };

  await writeFile(join(gamePath, 'en.json'), JSON.stringify(i18n, null, 2));

  // Create a simple test image
  const imageBuffer = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 3,
      background: { r: 255, g: 0, b: 0 }
    }
  })
    .png()
    .toBuffer();

  await writeFile(join(gamePath, 'assets', 'q1_choice1.png'), imageBuffer);

  return gamePath;
}
