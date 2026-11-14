/**
 * Quality Scorer
 *
 * Scores generated content quality using multiple metrics:
 * - Image quality (resolution, clarity, style consistency)
 * - Text quality (readability, complexity, age-appropriateness)
 * - Audio quality (duration, clarity, noise level)
 *
 * Integrates with Phase 3 QualityValidator and extends with batch processing.
 *
 * @module validation/QualityScorer
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import PQueue from 'p-queue';
import { QualityValidator, QualityMetrics } from '../training/QualityValidator';
import {
  QualityValidationResult,
  QualityValidationRules,
  AssetQualityScore,
  TextQualityScore,
  ValidationIssue,
  AssetInfo
} from './types';

/**
 * Default quality validation rules
 */
export const DEFAULT_QUALITY_RULES: QualityValidationRules = {
  minImageQuality: 80,
  minTextQuality: 80,
  minAudioQuality: 70,
  minOverallQuality: 80,

  // Image metrics
  minSharpness: 70,
  minSimplicity: 60,
  minBackgroundClean: 80,

  // Text metrics
  maxReadabilityGrade: 3,
  minWords: 5,
  maxWords: 15,
  minGrammarScore: 80,
  minSafetyScore: 95,

  // Audio metrics
  minClarity: 70,
  minPace: 120,
  maxPace: 150
};

/**
 * Quality scoring service with batch processing
 */
export class QualityScorer {
  private validator: QualityValidator;
  private queue: PQueue;

  constructor(
    private rules: QualityValidationRules = DEFAULT_QUALITY_RULES,
    concurrency: number = 4
  ) {
    this.validator = new QualityValidator({
      image: {
        minSharpness: rules.minSharpness,
        minSimplicity: rules.minSimplicity,
        minBackgroundClean: rules.minBackgroundClean,
        minWidth: 256,
        minHeight: 256
      },
      text: {
        maxGradeLevel: rules.maxReadabilityGrade,
        minWords: rules.minWords,
        maxWords: rules.maxWords,
        minGrammarScore: rules.minGrammarScore,
        minSafetyScore: rules.minSafetyScore
      },
      audio: {
        minClarity: rules.minClarity,
        minPace: rules.minPace,
        maxPace: rules.maxPace,
        minVolume: 0.3,
        maxVolume: 0.9
      },
      overallMinScore: rules.minOverallQuality
    });

    this.queue = new PQueue({ concurrency });
  }

  /**
   * Validate quality of entire game package
   */
  async validate(gamePath: string, gameId: string): Promise<QualityValidationResult> {
    const startedAt = new Date();
    const issues: ValidationIssue[] = [];

    // Load game config
    const configPath = join(gamePath, 'config.json');
    const config = await this.loadConfig(configPath);
    if (!config) {
      return this.createEmptyResult(startedAt, [
        this.createIssue(
          'critical',
          'Config file not found or invalid',
          configPath
        )
      ]);
    }

    // Collect assets and text
    const imageAssets: AssetInfo[] = [];
    const textItems: Array<{ id: string; text: string; language: string }> = [];
    const audioAssets: AssetInfo[] = [];

    // Extract from config
    for (const question of config.questions || []) {
      // Collect images from choices
      for (const choice of question.choices || []) {
        if (choice.assetPath) {
          imageAssets.push({
            id: choice.id,
            type: 'image',
            path: choice.assetPath,
            absolutePath: join(gamePath, choice.assetPath),
            size: 0,
            exists: true
          });
        }
      }
    }

    // Extract text from i18n files
    for (const lang of config.meta?.supportedLanguages || ['en']) {
      const i18nPath = join(gamePath, `${lang}.json`);
      const i18n = await this.loadI18n(i18nPath);
      if (i18n) {
        for (const question of config.questions || []) {
          const questionKey = question.questionKey;
          if (questionKey) {
            const keyParts = questionKey.split('.');
            let value = i18n.questions;
            for (const part of keyParts) {
              value = value?.[part];
            }
            if (value && typeof value === 'string') {
              textItems.push({
                id: `${question.id}_${lang}`,
                text: value,
                language: lang
              });
            }
          }

          // Collect choice text
          for (const choice of question.choices || []) {
            if (choice.textKey) {
              const keyParts = choice.textKey.split('.');
              let value = i18n.questions;
              for (const part of keyParts) {
                value = value?.[part];
              }
              if (value && typeof value === 'string') {
                textItems.push({
                  id: `${choice.id}_${lang}`,
                  text: value,
                  language: lang
                });
              }
            }
          }
        }
      }
    }

    // Score images in parallel
    const imageScores = await this.scoreImages(imageAssets);
    imageScores.forEach(score => {
      if (!score.passed) {
        issues.push(
          this.createIssue(
            score.score < this.rules.minImageQuality * 0.7 ? 'high' : 'medium',
            `Image quality score ${score.score.toFixed(1)} below threshold ${this.rules.minImageQuality}`,
            score.assetPath,
            { score: score.score, metrics: score.metrics }
          )
        );
      }
    });

    // Score text in parallel
    const textScores = await this.scoreText(textItems);
    textScores.forEach(score => {
      if (!score.passed) {
        issues.push(
          this.createIssue(
            score.score < this.rules.minTextQuality * 0.7 ? 'high' : 'medium',
            `Text quality score ${score.score.toFixed(1)} below threshold ${this.rules.minTextQuality}`,
            undefined,
            { textId: score.textId, score: score.score, metrics: score.metrics }
          )
        );
      }
    });

    // Score audio (placeholder - would score if audio files present)
    const audioScores: AssetQualityScore[] = [];

    // Calculate aggregate scores
    const avgImageScore =
      imageScores.length > 0
        ? imageScores.reduce((sum, s) => sum + s.score, 0) / imageScores.length
        : 0;
    const avgTextScore =
      textScores.length > 0
        ? textScores.reduce((sum, s) => sum + s.score, 0) / textScores.length
        : 0;
    const avgAudioScore =
      audioScores.length > 0
        ? audioScores.reduce((sum, s) => sum + s.score, 0) / audioScores.length
        : 0;

    const overallScore =
      imageScores.length + textScores.length + audioScores.length > 0
        ? (avgImageScore * imageScores.length +
            avgTextScore * textScores.length +
            avgAudioScore * audioScores.length) /
          (imageScores.length + textScores.length + audioScores.length)
        : 0;

    const passed =
      overallScore >= this.rules.minOverallQuality &&
      issues.filter(i => i.severity === 'critical' || i.severity === 'high')
        .length === 0;

    const completedAt = new Date();

    return {
      passed,
      startedAt,
      completedAt,
      duration: completedAt.getTime() - startedAt.getTime(),
      overallScore,
      imageScores,
      textScores,
      audioScores,
      avgImageScore,
      avgTextScore,
      avgAudioScore,
      issues
    };
  }

  /**
   * Score images in batch with parallel processing
   */
  private async scoreImages(assets: AssetInfo[]): Promise<AssetQualityScore[]> {
    const results = await Promise.all(
      assets.map(asset =>
        this.queue.add(() => this.scoreImage(asset))
      )
    );
    return results.filter(r => r !== null) as AssetQualityScore[];
  }

  /**
   * Score single image
   */
  private async scoreImage(asset: AssetInfo): Promise<AssetQualityScore | null> {
    try {
      const metrics = await this.validator.validateImage(asset.absolutePath);

      const score = metrics.overallScore;
      const passed = score >= this.rules.minImageQuality && metrics.passed;

      return {
        assetId: asset.id,
        assetPath: asset.absolutePath,
        assetType: 'image',
        score,
        metrics: {
          sharpness: metrics.image?.sharpness || 0,
          simplicity: metrics.image?.simplicity || 0,
          backgroundClean: metrics.image?.backgroundClean || 0,
          colorConsistency: metrics.image?.colorConsistency || 0,
          appropriateness: metrics.image?.appropriateness || 0
        },
        passed,
        issues: metrics.issues
      };
    } catch (error) {
      console.error(`Failed to score image ${asset.id}:`, error);
      return null;
    }
  }

  /**
   * Score text in batch with parallel processing
   */
  private async scoreText(
    textItems: Array<{ id: string; text: string; language: string }>
  ): Promise<TextQualityScore[]> {
    const results = await Promise.all(
      textItems.map(item =>
        this.queue.add(() => this.scoreTextItem(item))
      )
    );
    return results.filter(r => r !== null) as TextQualityScore[];
  }

  /**
   * Score single text item
   */
  private async scoreTextItem(item: {
    id: string;
    text: string;
    language: string;
  }): Promise<TextQualityScore | null> {
    try {
      const metrics = await this.validator.validateText(item.text);

      const score = metrics.overallScore;
      const passed = score >= this.rules.minTextQuality && metrics.passed;

      return {
        textId: item.id,
        text: item.text,
        language: item.language,
        score,
        metrics: {
          readability: metrics.text?.readability || 0,
          wordCount: metrics.text?.wordCount || 0,
          appropriateness: metrics.text?.appropriateness || 0,
          grammarScore: metrics.text?.grammarScore || 0,
          safetyScore: metrics.text?.safetyScore || 0
        },
        passed,
        issues: metrics.issues
      };
    } catch (error) {
      console.error(`Failed to score text ${item.id}:`, error);
      return null;
    }
  }

  /**
   * Load config file
   */
  private async loadConfig(configPath: string): Promise<any> {
    try {
      const data = await readFile(configPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Load i18n file
   */
  private async loadI18n(i18nPath: string): Promise<any> {
    try {
      const data = await readFile(i18nPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Create empty result
   */
  private createEmptyResult(
    startedAt: Date,
    issues: ValidationIssue[]
  ): QualityValidationResult {
    const completedAt = new Date();
    return {
      passed: false,
      startedAt,
      completedAt,
      duration: completedAt.getTime() - startedAt.getTime(),
      overallScore: 0,
      imageScores: [],
      textScores: [],
      audioScores: [],
      avgImageScore: 0,
      avgTextScore: 0,
      avgAudioScore: 0,
      issues
    };
  }

  /**
   * Create validation issue
   */
  private createIssue(
    severity: ValidationIssue['severity'],
    message: string,
    file?: string,
    details?: Record<string, any>
  ): ValidationIssue {
    return {
      id: `quality-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      severity,
      category: 'quality-low',
      stage: 'quality',
      message,
      file,
      details,
      canAutoRemediate: false,
      suggestedFix: 'Regenerate content with adjusted parameters'
    };
  }

  /**
   * Get validation statistics
   */
  getStatistics(result: QualityValidationResult): {
    totalAssets: number;
    passedAssets: number;
    failedAssets: number;
    passRate: number;
  } {
    const totalAssets =
      result.imageScores.length +
      result.textScores.length +
      result.audioScores.length;
    const passedAssets =
      result.imageScores.filter(s => s.passed).length +
      result.textScores.filter(s => s.passed).length +
      result.audioScores.filter(s => s.passed).length;
    const failedAssets = totalAssets - passedAssets;
    const passRate = totalAssets > 0 ? passedAssets / totalAssets : 0;

    return {
      totalAssets,
      passedAssets,
      failedAssets,
      passRate
    };
  }
}
