/**
 * Validation Pipeline
 *
 * Main orchestrator for multi-stage validation:
 * 1. Basic validation (files, formats, schemas)
 * 2. Quality scoring (images, text, audio)
 * 3. Compliance checks (WCAG, educational)
 * 4. Auto-remediation (optional)
 * 5. Report generation
 *
 * Features:
 * - Event-driven progress tracking
 * - Fail-fast error handling
 * - Detailed validation reports
 * - Auto-remediation support
 *
 * @module validation/ValidationPipeline
 */

import { EventEmitter } from 'events';
import { stat } from 'fs/promises';
import { join } from 'path';
import {
  ValidationPipelineConfig,
  ValidationReport,
  ValidationContext,
  ValidationStage,
  ValidationSummary,
  ValidationProgressEvent,
  BasicValidationRules,
  QualityValidationRules,
  ComplianceValidationRules
} from './types';
import { BasicValidator, DEFAULT_BASIC_RULES } from './BasicValidator';
import { QualityScorer, DEFAULT_QUALITY_RULES } from './QualityScorer';
import {
  ComplianceValidator,
  DEFAULT_COMPLIANCE_RULES
} from './ComplianceValidator';
import { AutoRemediator, DEFAULT_REMEDIATION_CONFIG } from './AutoRemediator';
import { ReportGenerator } from './ReportGenerator';

/**
 * Validation events
 */
export const ValidationEvents = {
  PIPELINE_STARTED: 'pipeline:started',
  STAGE_STARTED: 'stage:started',
  STAGE_COMPLETED: 'stage:completed',
  STAGE_FAILED: 'stage:failed',
  PROGRESS: 'progress',
  PIPELINE_COMPLETED: 'pipeline:completed',
  PIPELINE_FAILED: 'pipeline:failed'
} as const;

/**
 * Default pipeline configuration
 */
export const DEFAULT_PIPELINE_CONFIG: ValidationPipelineConfig = {
  rules: {
    basic: DEFAULT_BASIC_RULES,
    quality: DEFAULT_QUALITY_RULES,
    compliance: DEFAULT_COMPLIANCE_RULES
  },
  stages: ['basic', 'quality', 'compliance'],
  failFast: false,
  enableRemediation: false,
  generateReport: true,
  reportFormat: 'both',
  concurrency: 4
};

/**
 * Validation Pipeline orchestrator
 */
export class ValidationPipeline extends EventEmitter {
  private basicValidator: BasicValidator;
  private qualityScorer: QualityScorer;
  private complianceValidator: ComplianceValidator;
  private remediator: AutoRemediator;
  private reportGenerator: ReportGenerator;

  constructor(private config: ValidationPipelineConfig = DEFAULT_PIPELINE_CONFIG) {
    super();

    this.basicValidator = new BasicValidator(config.rules.basic);
    this.qualityScorer = new QualityScorer(
      config.rules.quality,
      config.concurrency
    );
    this.complianceValidator = new ComplianceValidator(config.rules.compliance);
    this.remediator = new AutoRemediator(DEFAULT_REMEDIATION_CONFIG);
    this.reportGenerator = new ReportGenerator();
  }

  /**
   * Validate a game package
   */
  async validate(gamePath: string, gameId: string): Promise<ValidationReport> {
    const startTime = Date.now();

    // Create validation context
    const context: ValidationContext = {
      gameId,
      gamePath,
      config: this.config,
      startTime,
      issues: [],
      completedStages: []
    };

    this.emit(ValidationEvents.PIPELINE_STARTED, { gameId, gamePath });

    try {
      // Verify game path exists
      try {
        await stat(gamePath);
      } catch {
        throw new Error(`Game path not found: ${gamePath}`);
      }

      // Initialize report
      const report: ValidationReport = {
        gameId,
        validatedAt: new Date(),
        validationDuration: 0,
        passed: true,
        overallScore: 100,
        stages: {},
        summary: this.createEmptySummary(),
        recommendations: []
      };

      // Run validation stages
      for (const stage of this.config.stages) {
        context.currentStage = stage;
        this.emit(ValidationEvents.STAGE_STARTED, stage);

        try {
          await this.runStage(stage, context, report);
          context.completedStages.push(stage);
          this.emit(ValidationEvents.STAGE_COMPLETED, { stage, report });

          // Fail fast if critical issues found
          if (
            this.config.failFast &&
            !this.isStageResultPassed(report.stages[stage])
          ) {
            report.passed = false;
            break;
          }
        } catch (error) {
          this.emit(ValidationEvents.STAGE_FAILED, { stage, error });
          if (this.config.failFast) {
            throw error;
          }
          // Continue with next stage if not fail-fast
        }
      }

      // Auto-remediation (if enabled and validation failed)
      if (this.config.enableRemediation && !report.passed) {
        this.emit(ValidationEvents.STAGE_STARTED, 'remediation');
        const remediationResult = await this.remediator.remediate(gamePath, report);
        report.stages.remediation = remediationResult;
        context.completedStages.push('remediation');
        this.emit(ValidationEvents.STAGE_COMPLETED, {
          stage: 'remediation',
          result: remediationResult
        });
      }

      // Calculate overall results
      this.calculateOverallResults(report);

      // Generate recommendations
      report.recommendations = this.generateRecommendations(report);

      // Validation duration
      report.validationDuration = Date.now() - startTime;

      // Generate report
      if (this.config.generateReport && this.config.reportOutputPath) {
        await this.reportGenerator.generate(report, {
          format: this.config.reportFormat,
          outputPath: this.config.reportOutputPath,
          includeDetails: true
        });
      }

      this.emit(ValidationEvents.PIPELINE_COMPLETED, report);

      return report;
    } catch (error) {
      this.emit(ValidationEvents.PIPELINE_FAILED, error);
      throw error;
    }
  }

  /**
   * Run validation stage
   */
  private async runStage(
    stage: ValidationStage,
    context: ValidationContext,
    report: ValidationReport
  ): Promise<void> {
    this.emitProgress(stage, 0, `Starting ${stage} validation`);

    switch (stage) {
      case 'basic':
        report.stages.basic = await this.basicValidator.validate(
          context.gamePath,
          context.gameId
        );
        this.emitProgress(stage, 100, 'Basic validation complete');
        break;

      case 'quality':
        this.emitProgress(stage, 0, 'Scoring content quality');
        report.stages.quality = await this.qualityScorer.validate(
          context.gamePath,
          context.gameId
        );
        this.emitProgress(stage, 100, 'Quality scoring complete');
        break;

      case 'compliance':
        this.emitProgress(stage, 0, 'Checking compliance');
        report.stages.compliance = await this.complianceValidator.validate(
          context.gamePath,
          context.gameId
        );
        this.emitProgress(stage, 100, 'Compliance checks complete');
        break;

      case 'remediation':
        // Remediation is handled separately
        break;
    }
  }

  /**
   * Calculate overall results
   */
  private calculateOverallResults(report: ValidationReport): void {
    const summary = this.createEmptySummary();
    let totalScore = 0;
    let scoreCount = 0;

    // Collect all issues
    const allIssues = [
      ...(report.stages.basic?.issues || []),
      ...(report.stages.quality?.issues || []),
      ...(report.stages.compliance?.issues || [])
    ];

    // Count issues by severity
    summary.totalIssues = allIssues.length;
    summary.criticalIssues = allIssues.filter(i => i.severity === 'critical').length;
    summary.highIssues = allIssues.filter(i => i.severity === 'high').length;
    summary.mediumIssues = allIssues.filter(i => i.severity === 'medium').length;
    summary.lowIssues = allIssues.filter(i => i.severity === 'low').length;

    // Count issues by type
    summary.imageIssues = allIssues.filter(
      i => i.category.includes('image') || i.category === 'size-exceeded'
    ).length;
    summary.textIssues = allIssues.filter(
      i => i.category.includes('text') || i.category === 'readability-high'
    ).length;
    summary.audioIssues = allIssues.filter(i => i.category.includes('audio')).length;
    summary.configIssues = allIssues.filter(
      i => i.category === 'schema-invalid' || i.category === 'file-missing'
    ).length;

    // Count issues by category
    summary.basicValidationIssues = report.stages.basic?.issues.length || 0;
    summary.qualityIssues = report.stages.quality?.issues.length || 0;
    summary.complianceIssues = report.stages.compliance?.issues.length || 0;

    // Remediation stats
    if (report.stages.remediation) {
      summary.autoRemediatedIssues = report.stages.remediation.autoRemediatedIssues;
      summary.manualRemediationRequired =
        report.stages.remediation.manualRemediationRequired;
    } else {
      summary.autoRemediatedIssues = 0;
      summary.manualRemediationRequired = allIssues.filter(i => !i.canAutoRemediate).length;
    }

    // Calculate overall score
    if (report.stages.basic?.passed !== false) {
      totalScore += 100;
      scoreCount += 1;
    }

    if (report.stages.quality) {
      totalScore += report.stages.quality.overallScore;
      scoreCount += 1;
    }

    if (report.stages.compliance?.passed !== false) {
      totalScore += 100;
      scoreCount += 1;
    }

    report.overallScore = scoreCount > 0 ? totalScore / scoreCount : 0;

    // Apply penalties for critical/high issues
    const criticalPenalty = summary.criticalIssues * 20;
    const highPenalty = summary.highIssues * 10;
    report.overallScore = Math.max(0, report.overallScore - criticalPenalty - highPenalty);

    // Determine pass/fail
    report.passed =
      summary.criticalIssues === 0 &&
      summary.highIssues === 0 &&
      report.overallScore >= this.config.rules.quality.minOverallQuality;

    report.summary = summary;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(report: ValidationReport): string[] {
    const recommendations: string[] = [];

    // Critical issues
    if (report.summary.criticalIssues > 0) {
      recommendations.push(
        `Fix ${report.summary.criticalIssues} critical issues immediately - these prevent game from functioning`
      );
    }

    // High priority issues
    if (report.summary.highIssues > 0) {
      recommendations.push(
        `Address ${report.summary.highIssues} high-priority issues to improve quality and compliance`
      );
    }

    // Quality score
    if (report.overallScore < 80) {
      recommendations.push(
        `Overall quality score (${report.overallScore.toFixed(1)}) is below recommended threshold (80) - consider regenerating content`
      );
    }

    // Image quality
    if (report.stages.quality?.avgImageScore && report.stages.quality.avgImageScore < 80) {
      recommendations.push(
        `Average image quality (${report.stages.quality.avgImageScore.toFixed(1)}) is low - review image generation parameters`
      );
    }

    // Text quality
    if (report.stages.quality?.avgTextScore && report.stages.quality.avgTextScore < 80) {
      recommendations.push(
        `Average text quality (${report.stages.quality.avgTextScore.toFixed(1)}) is low - simplify language and reduce complexity`
      );
    }

    // WCAG compliance
    const failedWCAG =
      report.stages.compliance?.wcagChecks?.filter(c => !c.passed).length || 0;
    if (failedWCAG > 0) {
      recommendations.push(
        `${failedWCAG} WCAG checks failed - review accessibility guidelines and adjust theme/content`
      );
    }

    // Auto-remediation
    if (
      report.stages.remediation &&
      report.stages.remediation.autoRemediatedIssues > 0
    ) {
      recommendations.push(
        `${report.stages.remediation.autoRemediatedIssues} issues were automatically fixed - review changes before deployment`
      );
    }

    // Manual remediation needed
    if (report.summary.manualRemediationRequired > 0) {
      recommendations.push(
        `${report.summary.manualRemediationRequired} issues require manual intervention - see detailed report for specific actions`
      );
    }

    // Success message
    if (report.passed && recommendations.length === 0) {
      recommendations.push(
        'All validation checks passed! Game is ready for deployment.'
      );
    }

    return recommendations;
  }

  /**
   * Create empty summary
   */
  private createEmptySummary(): ValidationSummary {
    return {
      totalIssues: 0,
      criticalIssues: 0,
      highIssues: 0,
      mediumIssues: 0,
      lowIssues: 0,
      imageIssues: 0,
      textIssues: 0,
      audioIssues: 0,
      configIssues: 0,
      basicValidationIssues: 0,
      qualityIssues: 0,
      complianceIssues: 0,
      autoRemediatedIssues: 0,
      manualRemediationRequired: 0
    };
  }

  /**
   * Check if stage result passed
   */
  private isStageResultPassed(stageResult: any): boolean {
    return stageResult?.passed !== false;
  }

  /**
   * Emit progress event
   */
  private emitProgress(
    stage: ValidationStage,
    progress: number,
    message: string,
    details?: Record<string, any>
  ): void {
    const event: ValidationProgressEvent = {
      stage,
      progress,
      message,
      details
    };
    this.emit(ValidationEvents.PROGRESS, event);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ValidationPipelineConfig>): void {
    this.config = { ...this.config, ...config };

    // Recreate validators with new config
    if (config.rules?.basic) {
      this.basicValidator = new BasicValidator(config.rules.basic);
    }
    if (config.rules?.quality) {
      this.qualityScorer = new QualityScorer(
        config.rules.quality,
        this.config.concurrency
      );
    }
    if (config.rules?.compliance) {
      this.complianceValidator = new ComplianceValidator(config.rules.compliance);
    }
  }
}
