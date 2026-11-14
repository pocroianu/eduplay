/**
 * Basic Validator Tests
 *
 * @module validation/__tests__/BasicValidator
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { BasicValidator, DEFAULT_BASIC_RULES } from '../BasicValidator';

describe('BasicValidator', () => {
  let testDir: string;
  let validator: BasicValidator;

  beforeAll(async () => {
    testDir = join(tmpdir(), `basic-validator-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    validator = new BasicValidator(DEFAULT_BASIC_RULES);
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('File Existence Checks', () => {
    it('should detect missing config file', async () => {
      const gamePath = join(testDir, 'missing-config');
      await mkdir(gamePath, { recursive: true });

      const result = await validator.validate(gamePath, 'missing-config');

      expect(result.passed).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].category).toBe('file-missing');
      expect(result.issues[0].severity).toBe('critical');
    });

    it('should pass when config file exists', async () => {
      const gamePath = join(testDir, 'has-config');
      await mkdir(gamePath, { recursive: true });

      const config = {
        meta: {
          gameId: 'test-game',
          themeName: 'nature',
          totalSteps: 3
        },
        questions: []
      };

      await writeFile(
        join(gamePath, 'config.json'),
        JSON.stringify(config, null, 2)
      );

      const result = await validator.validate(gamePath, 'has-config');

      const configIssues = result.issues.filter(
        i => i.category === 'file-missing' && i.file?.includes('config.json')
      );
      expect(configIssues).toHaveLength(0);
    });
  });

  describe('Schema Validation', () => {
    it('should validate config schema', async () => {
      const gamePath = join(testDir, 'valid-schema');
      await mkdir(gamePath, { recursive: true });

      const config = {
        meta: {
          gameId: 'test-game',
          themeName: 'nature',
          totalSteps: 3,
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

      const result = await validator.validate(gamePath, 'valid-schema');

      const schemaIssues = result.schemaChecks.filter(c => !c.valid);
      expect(schemaIssues).toHaveLength(0);
    });

    it('should detect invalid config schema', async () => {
      const gamePath = join(testDir, 'invalid-schema');
      await mkdir(gamePath, { recursive: true });

      const config = {
        // Missing meta
        questions: []
      };

      await writeFile(
        join(gamePath, 'config.json'),
        JSON.stringify(config, null, 2)
      );

      const result = await validator.validate(gamePath, 'invalid-schema');

      const schemaIssues = result.schemaChecks.filter(
        c => c.schemaType === 'config' && !c.valid
      );
      expect(schemaIssues.length).toBeGreaterThan(0);
    });

    it('should detect invalid JSON', async () => {
      const gamePath = join(testDir, 'invalid-json');
      await mkdir(gamePath, { recursive: true });

      await writeFile(join(gamePath, 'config.json'), '{ invalid json }');

      const result = await validator.validate(gamePath, 'invalid-json');

      const schemaIssues = result.schemaChecks.filter(
        c => c.schemaType === 'config' && !c.valid
      );
      expect(schemaIssues.length).toBeGreaterThan(0);
      expect(schemaIssues[0].errors[0]).toContain('parse');
    });
  });

  describe('Asset Reference Integrity', () => {
    it('should detect broken asset references', async () => {
      const gamePath = join(testDir, 'broken-refs');
      await mkdir(gamePath, { recursive: true });
      await mkdir(join(gamePath, 'assets'), { recursive: true });

      const config = {
        meta: {
          gameId: 'test-game',
          themeName: 'nature',
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
                assetPath: 'assets/missing.png', // This file doesn't exist
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

      const result = await validator.validate(gamePath, 'broken-refs');

      const brokenRefs = result.referenceChecks.filter(
        c => c.referenceType === 'asset' && !c.exists
      );
      expect(brokenRefs.length).toBeGreaterThan(0);
    });

    it('should detect broken i18n key references', async () => {
      const gamePath = join(testDir, 'broken-i18n-refs');
      await mkdir(gamePath, { recursive: true });

      const config = {
        meta: {
          gameId: 'test-game',
          themeName: 'nature',
          totalSteps: 1,
          supportedLanguages: ['en']
        },
        questions: [
          {
            id: 'q1',
            questionKey: 'q1.question', // This key doesn't exist in i18n
            choices: []
          }
        ]
      };

      const i18n = {
        meta: { title: 'Test Game' },
        questions: {
          q1: {
            // Missing 'question' key
            choices: {}
          }
        }
      };

      await writeFile(
        join(gamePath, 'config.json'),
        JSON.stringify(config, null, 2)
      );
      await writeFile(join(gamePath, 'en.json'), JSON.stringify(i18n, null, 2));

      const result = await validator.validate(gamePath, 'broken-i18n-refs');

      const brokenRefs = result.referenceChecks.filter(
        c => c.referenceType === 'i18n-key' && !c.exists
      );
      expect(brokenRefs.length).toBeGreaterThan(0);
    });
  });

  describe('Issue Creation', () => {
    it('should create issues with correct severity', async () => {
      const gamePath = join(testDir, 'severity-test');
      await mkdir(gamePath, { recursive: true });

      // No config file = critical
      const result = await validator.validate(gamePath, 'severity-test');

      const criticalIssues = result.issues.filter(i => i.severity === 'critical');
      expect(criticalIssues.length).toBeGreaterThan(0);
    });

    it('should include suggested fixes in issues', async () => {
      const gamePath = join(testDir, 'fixes-test');
      await mkdir(gamePath, { recursive: true });

      const result = await validator.validate(gamePath, 'fixes-test');

      const issuesWithFixes = result.issues.filter(i => i.suggestedFix);
      expect(issuesWithFixes.length).toBeGreaterThan(0);
    });
  });
});
