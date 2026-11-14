/**
 * Unit tests for GameContentGenerator.
 *
 * @module generators/__tests__/GameContentGenerator.test
 */

import { existsSync, readFileSync } from 'fs';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameContentGenerator, GenerationEvents } from '../GameContentGenerator';
import { ImageContentGenerator } from '../ImageContentGenerator';
import { TextContentGenerator } from '../TextContentGenerator';
import { AudioContentGenerator } from '../AudioContentGenerator';
import { QualityValidator } from '../../training/QualityValidator';
import { GameGenerationRequest } from '../types';
import { parseGameConfig } from '../../../../validation/src';

describe('GameContentGenerator', () => {
  let generator: GameContentGenerator;
  let mockImageGen: ImageContentGenerator;
  let mockTextGen: TextContentGenerator;
  let mockAudioGen: AudioContentGenerator;
  let mockValidator: QualityValidator;

  beforeEach(() => {
    // Create mocks
    mockImageGen = {
      generate: vi.fn().mockResolvedValue(Buffer.from('image')),
      generateBatch: vi.fn().mockResolvedValue([
        {
          buffer: Buffer.from('image1'),
          width: 512,
          height: 512,
          provider: 'comfyui (fallback)',
          providerDetails: { route: 'fallback-batch-error' }
        },
        {
          buffer: Buffer.from('image2'),
          width: 512,
          height: 512,
          provider: 'comfyui (fallback)',
          providerDetails: { route: 'fallback-batch-error' }
        }
      ]),
      getUsedProviders: vi.fn().mockReturnValue(['comfyui (fallback)'])
    } as any;

    mockTextGen = {
      generateQuestion: vi.fn().mockResolvedValue('Test question?'),
      generateChoiceText: vi.fn().mockResolvedValue('Test choice'),
      generateFeedback: vi.fn().mockResolvedValue('Great job!'),
      generateBatch: vi.fn()
    } as any;

    mockAudioGen = {
      generate: vi.fn().mockResolvedValue(Buffer.from('audio')),
      generateBatch: vi.fn().mockImplementation(async (requests: Array<{ language: string }>) =>
        requests.map((request, index) => ({
          buffer: Buffer.from(`audio${index + 1}-${request.language}`),
          duration: 3
        }))
      )
    } as any;

    mockValidator = {
      validateImage: vi.fn().mockResolvedValue({ passed: true, overallScore: 90, issues: [] }),
      validateText: vi.fn().mockResolvedValue({ passed: true, overallScore: 95, issues: [] }),
      validateAudio: vi.fn().mockResolvedValue({ passed: true, overallScore: 92, issues: [] })
    } as any;

    generator = new GameContentGenerator(
      mockImageGen,
      mockTextGen,
      mockAudioGen,
      mockValidator
    );
  });

  describe('generate', () => {
    it('should generate complete game package', async () => {
      const request: GameGenerationRequest = {
        category: 'fruits',
        theme: 'nature',
        difficulty: 'easy',
        languages: ['en'],
        questionCount: 1,
        choicesPerQuestion: 2,
        validateBeforeCommit: false,
        retryOnFailure: false,
        maxRetries: 0,
        outputDir: '/tmp/test',
        gameId: 'test-game'
      };

      const result = await generator.generate(request);

      expect(result.gameId).toBe('test-game');
      expect(result.config.questions).toHaveLength(1);
      expect(mockTextGen.generateQuestion).toHaveBeenCalled();
      expect(mockImageGen.generateBatch).toHaveBeenCalled();
      expect(mockAudioGen.generateBatch).toHaveBeenCalled();
    });

    it('should emit events during generation', async () => {
      const request: GameGenerationRequest = {
        category: 'fruits',
        theme: 'nature',
        difficulty: 'easy',
        languages: ['en'],
        questionCount: 1,
        choicesPerQuestion: 2,
        validateBeforeCommit: false,
        retryOnFailure: false,
        maxRetries: 0,
        outputDir: '/tmp/test',
        gameId: 'test-game'
      };

      const startedSpy = vi.fn();
      const completedSpy = vi.fn();

      generator.on(GenerationEvents.GENERATION_STARTED, startedSpy);
      generator.on(GenerationEvents.GENERATION_COMPLETED, completedSpy);

      await generator.generate(request);

      expect(startedSpy).toHaveBeenCalledWith(request);
      expect(completedSpy).toHaveBeenCalled();
    });

    it('should handle validation failure when validateBeforeCommit is true', async () => {
      mockValidator.validateImage = vi.fn().mockResolvedValue({
        passed: false,
        overallScore: 50,
        issues: ['Quality too low']
      });

      const request: GameGenerationRequest = {
        category: 'fruits',
        theme: 'nature',
        difficulty: 'easy',
        languages: ['en'],
        questionCount: 1,
        choicesPerQuestion: 2,
        validateBeforeCommit: true,
        retryOnFailure: false,
        maxRetries: 0,
        outputDir: '/tmp/test',
        gameId: 'test-game'
      };

      await expect(generator.generate(request)).rejects.toThrow('Validation failed');
    });

    it('should retry on failure when retryOnFailure is true', async () => {
      let callCount = 0;
      mockTextGen.generateQuestion = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Generation failed');
        }
        return Promise.resolve('Test question?');
      });

      const request: GameGenerationRequest = {
        category: 'fruits',
        theme: 'nature',
        difficulty: 'easy',
        languages: ['en'],
        questionCount: 1,
        choicesPerQuestion: 2,
        validateBeforeCommit: false,
        retryOnFailure: true,
        maxRetries: 1,
        outputDir: '/tmp/test',
        gameId: 'test-game'
      };

      const result = await generator.generate(request);
      expect(result.gameId).toBe('test-game');
      expect(callCount).toBe(2);
    });

    it('should generate Romanian-only content without English choice text', async () => {
      const request: GameGenerationRequest = {
        category: 'fruits',
        theme: 'nature',
        difficulty: 'easy',
        languages: ['ro'],
        questionCount: 1,
        choicesPerQuestion: 2,
        validateBeforeCommit: false,
        retryOnFailure: false,
        maxRetries: 0,
        outputDir: '/tmp/test',
        gameId: 'test-game'
      };

      const result = await generator.generate(request);

      expect(result.i18n).toHaveProperty('ro');
      expect(result.i18n).not.toHaveProperty('en');
      expect(mockImageGen.generateBatch).toHaveBeenCalled();
    });

    it('should generate multi-language content', async () => {
      const request: GameGenerationRequest = {
        category: 'fruits',
        theme: 'nature',
        difficulty: 'easy',
        languages: ['en', 'ro'],
        questionCount: 1,
        choicesPerQuestion: 2,
        validateBeforeCommit: false,
        retryOnFailure: false,
        maxRetries: 0,
        outputDir: '/tmp/test',
        gameId: 'test-game'
      };

      const result = await generator.generate(request);

      expect(result.i18n).toHaveProperty('en');
      expect(result.i18n).toHaveProperty('ro');
      expect(mockTextGen.generateQuestion).toHaveBeenCalledTimes(2); // Once per language
      expect(mockAudioGen.generateBatch).toHaveBeenCalled();
    });

    it('writes a reviewable Activity package instead of legacy root config files', async () => {
      const outputDir = await mkdtemp(join(tmpdir(), 'ai-activity-package-'));
      const request: GameGenerationRequest = {
        category: 'fruits',
        theme: 'nature',
        difficulty: 'easy',
        languages: ['en', 'ro'],
        questionCount: 1,
        choicesPerQuestion: 2,
        rendererId: 'multiple-choice',
        validateBeforeCommit: false,
        retryOnFailure: false,
        maxRetries: 0,
        outputDir,
        gameId: 'test-game'
      };

      await generator.generate(request);

      const gameDir = join(outputDir, 'test-game');
      expect(existsSync(join(gameDir, 'config.json'))).toBe(false);
      expect(JSON.parse(readFileSync(join(gameDir, 'activity.json'), 'utf8'))).toMatchObject({
        activityId: 'test-game',
        version: 1,
        renderer: { id: 'multiple-choice', version: '^1.0.0' },
        gameId: 'test-game'
      });
      expect(existsSync(join(gameDir, 'versions', '1', 'config.json'))).toBe(true);
      expect(existsSync(join(gameDir, 'versions', '1', 'strings', 'en.json'))).toBe(true);
      expect(existsSync(join(gameDir, 'versions', '1', 'strings', 'ro.json'))).toBe(true);
      expect(existsSync(join(gameDir, 'assets', 'library', 'images', 'q1_choice1.png'))).toBe(true);

      const config = JSON.parse(readFileSync(join(gameDir, 'versions', '1', 'config.json'), 'utf8'));
      expect(parseGameConfig(config).success).toBe(true);

      const assets = JSON.parse(readFileSync(join(gameDir, 'versions', '1', 'assets.json'), 'utf8'));
      expect(assets.games['test-game'].manifest.images).toContain('q1_choice1');
      expect(assets.pinnedAssets.q1_choice1).toMatchObject({
        type: 'image',
        path: '/assets/library/images/q1_choice1.png'
      });
    });

    it('rejects unsafe Activity package path inputs before writing', async () => {
      const outputDir = await mkdtemp(join(tmpdir(), 'ai-activity-package-unsafe-'));
      const request: GameGenerationRequest = {
        category: 'fruits',
        theme: 'nature',
        difficulty: 'easy',
        languages: ['../escape'] as any,
        questionCount: 1,
        choicesPerQuestion: 2,
        activityVersion: 1,
        validateBeforeCommit: false,
        retryOnFailure: false,
        maxRetries: 0,
        outputDir,
        gameId: 'test-game'
      };

      await expect(generator.generate(request)).rejects.toThrow('Invalid Activity package language');
      expect(existsSync(join(outputDir, 'test-game'))).toBe(false);

      await expect(generator.generate({
        ...request,
        languages: ['en'],
        activityVersion: 0,
      })).rejects.toThrow('Invalid Activity package version');
      expect(existsSync(join(outputDir, 'test-game'))).toBe(false);
    });

    it('records the committed image provider in metadata and asset entries', async () => {
      const request: GameGenerationRequest = {
        category: 'fruits',
        theme: 'nature',
        difficulty: 'easy',
        languages: ['en'],
        questionCount: 1,
        choicesPerQuestion: 2,
        validateBeforeCommit: false,
        retryOnFailure: false,
        maxRetries: 0,
        outputDir: '/tmp/test',
        gameId: 'test-game'
      };

      const result = await generator.generate(request);

      expect(result.metadata.providersUsed.image).toBe('comfyui (fallback)');
      expect(result.assets.images[0].metadata.provider).toBe('comfyui (fallback)');
      expect(result.assets.images[0].metadata.providerDetails).toEqual({
        route: 'fallback-batch-error'
      });
    });
  });

  describe('events', () => {
    it('should have all required event constants', () => {
      expect(GenerationEvents.GENERATION_STARTED).toBe('generation:started');
      expect(GenerationEvents.QUESTION_STARTED).toBe('question:started');
      expect(GenerationEvents.QUESTION_COMPLETED).toBe('question:completed');
      expect(GenerationEvents.VALIDATION_STARTED).toBe('validation:started');
      expect(GenerationEvents.VALIDATION_COMPLETED).toBe('validation:completed');
      expect(GenerationEvents.GENERATION_COMPLETED).toBe('generation:completed');
      expect(GenerationEvents.GENERATION_FAILED).toBe('generation:failed');
    });
  });
});
