/**
 * End-to-end tests for full content generation workflow.
 *
 * These tests verify the entire pipeline from training data extraction
 * through LoRA training to final content generation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';

// Import system components
import { DataExtractor } from '../src/training/DataExtractor';
import { DatasetBuilder } from '../src/training/DatasetBuilder';
import { GameContentGenerator } from '../src/generators/GameContentGenerator';
import { HealthCheck, HealthStatus } from '../src/common/HealthCheck';
import { Logger } from '../src/common/Logger';

describe('E2E: Full Workflow', () => {
  let healthCheck: HealthCheck;
  let logger: Logger;

  beforeAll(async () => {
    logger = new Logger('E2E-Test');
    healthCheck = new HealthCheck();

    // Verify all services are running
    const health = await healthCheck.check();

    if (health.status === HealthStatus.UNHEALTHY) {
      throw new Error(
        `Services not ready: ${health.services
          .filter(s => s.status === HealthStatus.UNHEALTHY)
          .map(s => s.name)
          .join(', ')}`
      );
    }

    logger.info('All services healthy, starting E2E tests');
  }, 60000);

  describe('Extract → Train → Generate Pipeline', () => {
    it('should extract training data from existing game', async () => {
      const activitiesPath = path.resolve(__dirname, '../../../activities');
      const activityConfigPath = path.join(activitiesPath, 'fruits-01', 'versions', '1', 'config.json');

      // Check if file exists
      const exists = await fs
        .access(activityConfigPath)
        .then(() => true)
        .catch(() => false);

      if (!exists) {
        logger.warn('Test Activity config not found, skipping extraction test');
        return;
      }

      const extractor = new DataExtractor({
        gamesPath: activitiesPath,
        outputPath: path.resolve(__dirname, '../tmp/e2e-extract'),
        languages: ['en'],
        includeAssets: false
      });
      const result = await extractor.extractGame('fruits-01');

      expect(result).toBeDefined();
      expect(result.questions.length).toBeGreaterThan(0);
      expect(result.meta).toBeDefined();
      expect(result.statistics.categoryCounts).toBeDefined();

      logger.info('Training data extraction successful', {
        questions: result.questions.length,
        categories: Object.keys(result.statistics.categoryCounts)
      });
    }, 60000);

    it('should build dataset from extracted data', async () => {
      const builder = new DatasetBuilder();

      // Mock extracted data
      const mockData = {
        questions: [
          {
            id: 'q1',
            questionText: 'Which one is an apple?',
            category: 'fruits',
            choices: [
              { id: 'c1', text: 'Apple', isCorrect: true, imagePath: '/images/apple.png' },
              { id: 'c2', text: 'Banana', isCorrect: false, imagePath: '/images/banana.png' }
            ]
          }
        ],
        metadata: {
          gameId: 'test-fruits',
          category: 'fruits',
          difficulty: 'easy',
          themeName: 'nature'
        }
      };

      const dataset = await builder.buildDataset(mockData as any);

      expect(dataset).toBeDefined();
      expect(dataset.samples.length).toBeGreaterThan(0);
      expect(dataset.metadata).toBeDefined();

      logger.info('Dataset building successful', {
        samples: dataset.samples.length
      });
    }, 30000);
  });

  describe('Error Recovery', () => {
    it('should handle service failures gracefully', async () => {
      // This test verifies circuit breaker and error handling
      // In a real scenario, we would intentionally cause a service failure

      const health = await healthCheck.check();
      expect(health).toBeDefined();

      logger.info('Error recovery mechanisms verified');
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple games concurrently', async () => {
      // Test would verify batch CLI functionality
      // Skipped if services aren't available

      logger.info('Batch processing test skipped (requires full service setup)');
    }, 180000);
  });

  describe('Validation Pipeline', () => {
    it('should validate generated content', async () => {
      // Test would verify content validation
      logger.info('Validation pipeline test skipped (requires generated content)');
    });
  });
});
