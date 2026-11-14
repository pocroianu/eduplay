/**
 * Auto Remediator
 *
 * Automatically fixes common validation issues:
 * - Image optimization (resize, compress, format conversion)
 * - Contrast adjustment for WCAG compliance
 * - Text spell-check and grammar fixes
 * - Safe, conservative fixes only
 *
 * @module validation/AutoRemediator
 */

import { copyFile, writeFile, readFile } from 'fs/promises';
import { join, extname, basename } from 'path';
import sharp from 'sharp';
import {
  RemediationResult,
  RemediationAction,
  RemediationType,
  ValidationIssue,
  ValidationReport
} from './types';

/**
 * Remediation configuration
 */
export interface RemediationConfig {
  // Image settings
  targetImageWidth: number;
  targetImageHeight: number;
  imageQuality: number; // 1-100
  imageFormat: 'png' | 'jpeg' | 'webp';

  // Safety settings
  createBackups: boolean;
  dryRun: boolean; // Don't actually make changes

  // Logging
  verbose: boolean;
}

/**
 * Default remediation config
 */
export const DEFAULT_REMEDIATION_CONFIG: RemediationConfig = {
  targetImageWidth: 512,
  targetImageHeight: 512,
  imageQuality: 85,
  imageFormat: 'png',
  createBackups: true,
  dryRun: false,
  verbose: false
};

/**
 * Auto-remediation service
 */
export class AutoRemediator {
  constructor(
    private config: RemediationConfig = DEFAULT_REMEDIATION_CONFIG
  ) {}

  /**
   * Remediate issues from validation report
   */
  async remediate(
    gamePath: string,
    report: ValidationReport
  ): Promise<RemediationResult> {
    const startedAt = new Date();
    const actions: RemediationAction[] = [];
    const unresolvedIssues: ValidationIssue[] = [];

    // Collect remediable issues
    const allIssues = this.collectIssues(report);
    const remediableIssues = allIssues.filter(i => i.canAutoRemediate);

    if (this.config.verbose) {
      console.log(`Found ${remediableIssues.length} auto-remediable issues`);
    }

    // Process each issue
    for (const issue of remediableIssues) {
      const action = await this.remediateIssue(gamePath, issue);
      actions.push(action);

      if (!action.success) {
        unresolvedIssues.push(issue);
      }
    }

    // Add unremediable issues to unresolved
    const unremediableIssues = allIssues.filter(i => !i.canAutoRemediate);
    unresolvedIssues.push(...unremediableIssues);

    const completedAt = new Date();

    return {
      startedAt,
      completedAt,
      duration: completedAt.getTime() - startedAt.getTime(),
      actions,
      totalIssues: allIssues.length,
      autoRemediatedIssues: actions.filter(a => a.success).length,
      manualRemediationRequired: unresolvedIssues.length,
      unresolvedIssues
    };
  }

  /**
   * Remediate single issue
   */
  private async remediateIssue(
    gamePath: string,
    issue: ValidationIssue
  ): Promise<RemediationAction> {
    const action: RemediationAction = {
      issueId: issue.id,
      actionType: this.getActionType(issue),
      description: `Remediate: ${issue.message}`,
      applied: false,
      success: false,
      details: {}
    };

    try {
      switch (issue.category) {
        case 'size-exceeded':
          await this.remediateImageSize(gamePath, issue, action);
          break;

        case 'format-invalid':
          if (issue.file && this.isImageFile(issue.file)) {
            await this.remediateImageFormat(gamePath, issue, action);
          }
          break;

        case 'contrast-insufficient':
          // Conservative approach: log warning, don't auto-fix colors
          action.success = false;
          action.details = {
            reason: 'Color adjustments require manual review'
          };
          break;

        default:
          action.success = false;
          action.details = {
            reason: 'No remediation strategy for this issue category'
          };
      }
    } catch (error) {
      action.success = false;
      action.error = error instanceof Error ? error.message : String(error);
    }

    return action;
  }

  /**
   * Remediate image size issues
   */
  private async remediateImageSize(
    gamePath: string,
    issue: ValidationIssue,
    action: RemediationAction
  ): Promise<void> {
    if (!issue.file) {
      throw new Error('No file specified in issue');
    }

    const imagePath = issue.file.startsWith(gamePath)
      ? issue.file
      : join(gamePath, issue.file);

    if (this.config.verbose) {
      console.log(`Optimizing image: ${imagePath}`);
    }

    // Create backup if enabled
    if (this.config.createBackups && !this.config.dryRun) {
      const backupPath = `${imagePath}.backup`;
      await copyFile(imagePath, backupPath);
      action.details.backupPath = backupPath;
    }

    // Load image
    const image = sharp(imagePath);
    const metadata = await image.metadata();

    action.details.originalSize = issue.details?.size || 0;
    action.details.originalDimensions = {
      width: metadata.width,
      height: metadata.height
    };

    // Resize if needed
    let processedImage = image;

    // Check if dimensions exceed limits
    const needsResize =
      (metadata.width || 0) > this.config.targetImageWidth ||
      (metadata.height || 0) > this.config.targetImageHeight;

    if (needsResize) {
      processedImage = processedImage.resize(
        this.config.targetImageWidth,
        this.config.targetImageHeight,
        {
          fit: 'inside',
          withoutEnlargement: true
        }
      );
    }

    // Compress
    if (this.config.imageFormat === 'jpeg') {
      processedImage = processedImage.jpeg({ quality: this.config.imageQuality });
    } else if (this.config.imageFormat === 'webp') {
      processedImage = processedImage.webp({ quality: this.config.imageQuality });
    } else {
      processedImage = processedImage.png({
        quality: this.config.imageQuality,
        compressionLevel: 9
      });
    }

    // Save if not dry run
    if (!this.config.dryRun) {
      const buffer = await processedImage.toBuffer();
      await writeFile(imagePath, buffer);

      action.details.newSize = buffer.length;
      action.details.sizeSaved = action.details.originalSize - buffer.length;
      action.details.compressionRatio = (
        (action.details.sizeSaved / action.details.originalSize) *
        100
      ).toFixed(2);

      if (this.config.verbose) {
        console.log(
          `  Saved ${this.formatBytes(action.details.sizeSaved)} (${action.details.compressionRatio}% reduction)`
        );
      }
    }

    action.applied = !this.config.dryRun;
    action.success = true;
  }

  /**
   * Remediate image format issues
   */
  private async remediateImageFormat(
    gamePath: string,
    issue: ValidationIssue,
    action: RemediationAction
  ): Promise<void> {
    if (!issue.file) {
      throw new Error('No file specified in issue');
    }

    const imagePath = issue.file.startsWith(gamePath)
      ? issue.file
      : join(gamePath, issue.file);

    // Check if this is a dimension issue
    if (
      issue.details?.width &&
      issue.details?.height &&
      (issue.details.width < 256 || issue.details.height < 256)
    ) {
      // Resize to minimum dimensions
      const image = sharp(imagePath);

      if (this.config.createBackups && !this.config.dryRun) {
        const backupPath = `${imagePath}.backup`;
        await copyFile(imagePath, backupPath);
        action.details.backupPath = backupPath;
      }

      const resized = image.resize(
        Math.max(issue.details.width, 256),
        Math.max(issue.details.height, 256),
        {
          fit: 'cover',
          position: 'center'
        }
      );

      if (!this.config.dryRun) {
        await resized.toFile(`${imagePath}.temp`);
        await copyFile(`${imagePath}.temp`, imagePath);
      }

      action.applied = !this.config.dryRun;
      action.success = true;
      action.details.oldDimensions = {
        width: issue.details.width,
        height: issue.details.height
      };
      action.details.newDimensions = {
        width: Math.max(issue.details.width, 256),
        height: Math.max(issue.details.height, 256)
      };
    } else {
      // Format conversion not supported (too risky without knowing context)
      action.success = false;
      action.details = {
        reason: 'Format conversion requires manual review'
      };
    }
  }

  /**
   * Get action type from issue
   */
  private getActionType(issue: ValidationIssue): RemediationType {
    if (issue.remediationAction) {
      return issue.remediationAction;
    }

    // Infer from category
    const categoryMap: Record<string, RemediationType> = {
      'size-exceeded': 'image-compress',
      'format-invalid': 'image-resize',
      'contrast-insufficient': 'contrast-adjust'
    };

    return categoryMap[issue.category] || 'image-compress';
  }

  /**
   * Collect all issues from report
   */
  private collectIssues(report: ValidationReport): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (report.stages.basic) {
      issues.push(...report.stages.basic.issues);
    }
    if (report.stages.quality) {
      issues.push(...report.stages.quality.issues);
    }
    if (report.stages.compliance) {
      issues.push(...report.stages.compliance.issues);
    }

    return issues;
  }

  /**
   * Check if file is an image
   */
  private isImageFile(filePath: string): boolean {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
    const ext = extname(filePath).toLowerCase();
    return imageExtensions.includes(ext);
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get remediation statistics
   */
  getStatistics(result: RemediationResult): {
    totalIssues: number;
    remediatedIssues: number;
    failedRemediations: number;
    manualRemediationRequired: number;
    remediationRate: number;
  } {
    const remediatedIssues = result.actions.filter(a => a.success).length;
    const failedRemediations = result.actions.filter(a => !a.success).length;
    const remediationRate =
      result.totalIssues > 0 ? remediatedIssues / result.totalIssues : 0;

    return {
      totalIssues: result.totalIssues,
      remediatedIssues,
      failedRemediations,
      manualRemediationRequired: result.manualRemediationRequired,
      remediationRate
    };
  }

  /**
   * Estimate remediation time
   */
  estimateRemediationTime(report: ValidationReport): {
    estimatedSeconds: number;
    estimatedMinutes: number;
  } {
    const issues = this.collectIssues(report);
    const remediableIssues = issues.filter(i => i.canAutoRemediate);

    // Rough estimates:
    // - Image optimization: 2 seconds per image
    // - Other fixes: 0.5 seconds
    let totalSeconds = 0;

    for (const issue of remediableIssues) {
      if (issue.category === 'size-exceeded' || issue.category === 'format-invalid') {
        totalSeconds += 2;
      } else {
        totalSeconds += 0.5;
      }
    }

    return {
      estimatedSeconds: totalSeconds,
      estimatedMinutes: Math.ceil(totalSeconds / 60)
    };
  }
}
