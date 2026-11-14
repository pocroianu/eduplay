/**
 * Basic Validator
 *
 * Performs fundamental validation checks on game packages:
 * - File existence
 * - Format validation
 * - Asset size limits
 * - Schema validation
 * - Asset reference integrity
 *
 * @module validation/BasicValidator
 */

import { readFile, stat, access } from 'fs/promises';
import { join, extname, resolve } from 'path';
import { constants as fsConstants } from 'fs';
import sharp from 'sharp';
import {
  BasicValidationResult,
  BasicValidationRules,
  FileExistenceCheck,
  FormatValidationCheck,
  AssetSizeCheck,
  SchemaValidationCheck,
  ReferenceIntegrityCheck,
  ValidationIssue,
  AssetInfo
} from './types';

/**
 * Default basic validation rules
 */
export const DEFAULT_BASIC_RULES: BasicValidationRules = {
  requireConfigFile: true,
  requireI18nFiles: true,
  requireAssets: true,

  allowedImageFormats: ['png', 'jpg', 'jpeg', 'webp'],
  allowedAudioFormats: ['mp3', 'ogg', 'wav'],

  maxImageSize: 2 * 1024 * 1024, // 2MB
  maxAudioSize: 1 * 1024 * 1024, // 1MB

  minImageWidth: 256,
  minImageHeight: 256,
  maxImageWidth: 2048,
  maxImageHeight: 2048,

  validateConfigSchema: true,
  validateI18nSchema: true
};

/**
 * Basic validation service
 */
export class BasicValidator {
  constructor(private rules: BasicValidationRules = DEFAULT_BASIC_RULES) {}

  /**
   * Validate a game package
   */
  async validate(gamePath: string, gameId: string): Promise<BasicValidationResult> {
    const startedAt = new Date();
    const issues: ValidationIssue[] = [];

    // File existence checks
    const fileChecks = await this.checkFileExistence(gamePath, gameId);
    issues.push(...fileChecks.filter(c => c.issue).map(c => c.issue!));

    // Format validation checks
    const formatChecks = await this.validateFormats(gamePath, fileChecks);
    issues.push(...formatChecks.filter(c => c.issue).map(c => c.issue!));

    // Size checks
    const sizeChecks = await this.checkAssetSizes(gamePath, fileChecks);
    issues.push(...sizeChecks.filter(c => c.issue).map(c => c.issue!));

    // Schema validation
    const schemaChecks = await this.validateSchemas(gamePath, fileChecks);
    issues.push(...schemaChecks.filter(c => c.issue).map(c => c.issue!));

    // Reference integrity
    const referenceChecks = await this.checkReferenceIntegrity(gamePath, fileChecks);
    issues.push(...referenceChecks.filter(c => c.issue).map(c => c.issue!));

    const completedAt = new Date();

    return {
      passed: issues.filter(i => i.severity === 'critical' || i.severity === 'high').length === 0,
      startedAt,
      completedAt,
      duration: completedAt.getTime() - startedAt.getTime(),
      fileChecks,
      formatChecks,
      sizeChecks,
      schemaChecks,
      referenceChecks,
      issues
    };
  }

  /**
   * Check file existence
   */
  private async checkFileExistence(
    gamePath: string,
    gameId: string
  ): Promise<FileExistenceCheck[]> {
    const checks: FileExistenceCheck[] = [];

    // Check config.json
    const configPath = join(gamePath, 'config.json');
    const configExists = await this.fileExists(configPath);
    checks.push({
      filePath: configPath,
      fileType: 'config',
      exists: configExists,
      required: this.rules.requireConfigFile,
      issue: !configExists && this.rules.requireConfigFile
        ? this.createIssue(
            'critical',
            'file-missing',
            'basic',
            `Required config file not found: ${configPath}`,
            configPath
          )
        : undefined
    });

    // Check i18n files (at least en.json)
    const i18nFiles = ['en.json', 'ro.json'];
    for (const i18nFile of i18nFiles) {
      const i18nPath = join(gamePath, i18nFile);
      const i18nExists = await this.fileExists(i18nPath);
      checks.push({
        filePath: i18nPath,
        fileType: 'i18n',
        exists: i18nExists,
        required: i18nFile === 'en.json' && this.rules.requireI18nFiles,
        issue: !i18nExists && i18nFile === 'en.json' && this.rules.requireI18nFiles
          ? this.createIssue(
              'critical',
              'file-missing',
              'basic',
              `Required i18n file not found: ${i18nPath}`,
              i18nPath
            )
          : undefined
      });
    }

    // Check assets directory
    const assetsPath = join(gamePath, 'assets');
    const assetsExists = await this.fileExists(assetsPath);
    if (!assetsExists && this.rules.requireAssets) {
      checks.push({
        filePath: assetsPath,
        fileType: 'image',
        exists: false,
        required: true,
        issue: this.createIssue(
          'critical',
          'file-missing',
          'basic',
          `Required assets directory not found: ${assetsPath}`,
          assetsPath
        )
      });
    }

    return checks;
  }

  /**
   * Validate file formats
   */
  private async validateFormats(
    gamePath: string,
    fileChecks: FileExistenceCheck[]
  ): Promise<FormatValidationCheck[]> {
    const checks: FormatValidationCheck[] = [];

    // Find assets directory
    const assetsPath = join(gamePath, 'assets');
    if (!(await this.fileExists(assetsPath))) {
      return checks;
    }

    // Load config to get asset references
    const configPath = join(gamePath, 'config.json');
    if (!(await this.fileExists(configPath))) {
      return checks;
    }

    try {
      const configData = await readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);

      // Check image formats
      for (const question of config.questions || []) {
        for (const choice of question.choices || []) {
          if (choice.assetPath) {
            const assetPath = join(gamePath, choice.assetPath);
            const ext = extname(assetPath).slice(1).toLowerCase();
            const valid = this.rules.allowedImageFormats.includes(ext);

            checks.push({
              filePath: assetPath,
              expectedFormat: this.rules.allowedImageFormats.join('|'),
              actualFormat: ext,
              valid,
              issue: !valid
                ? this.createIssue(
                    'high',
                    'format-invalid',
                    'basic',
                    `Invalid image format '${ext}'. Allowed: ${this.rules.allowedImageFormats.join(', ')}`,
                    assetPath
                  )
                : undefined
            });
          }
        }
      }
    } catch (error) {
      // Config parsing error - will be caught in schema validation
    }

    return checks;
  }

  /**
   * Check asset sizes
   */
  private async checkAssetSizes(
    gamePath: string,
    fileChecks: FileExistenceCheck[]
  ): Promise<AssetSizeCheck[]> {
    const checks: AssetSizeCheck[] = [];

    // Load config to get asset references
    const configPath = join(gamePath, 'config.json');
    if (!(await this.fileExists(configPath))) {
      return checks;
    }

    try {
      const configData = await readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);

      // Check image sizes
      for (const question of config.questions || []) {
        for (const choice of question.choices || []) {
          if (choice.assetPath) {
            const assetPath = join(gamePath, choice.assetPath);
            if (await this.fileExists(assetPath)) {
              const stats = await stat(assetPath);
              const size = stats.size;
              const withinLimit = size <= this.rules.maxImageSize;

              checks.push({
                filePath: assetPath,
                assetType: 'image',
                size,
                maxSize: this.rules.maxImageSize,
                withinLimit,
                issue: !withinLimit
                  ? this.createIssue(
                      'medium',
                      'size-exceeded',
                      'basic',
                      `Image size ${this.formatBytes(size)} exceeds limit ${this.formatBytes(this.rules.maxImageSize)}`,
                      assetPath,
                      { size, maxSize: this.rules.maxImageSize }
                    )
                  : undefined
              });

              // Check image dimensions
              try {
                const image = sharp(assetPath);
                const metadata = await image.metadata();

                if (metadata.width && metadata.height) {
                  if (
                    metadata.width < this.rules.minImageWidth ||
                    metadata.height < this.rules.minImageHeight
                  ) {
                    checks.push({
                      filePath: assetPath,
                      assetType: 'image',
                      size,
                      maxSize: this.rules.maxImageSize,
                      withinLimit: false,
                      issue: this.createIssue(
                        'medium',
                        'format-invalid',
                        'basic',
                        `Image dimensions ${metadata.width}x${metadata.height} below minimum ${this.rules.minImageWidth}x${this.rules.minImageHeight}`,
                        assetPath,
                        { width: metadata.width, height: metadata.height }
                      )
                    });
                  }

                  if (
                    metadata.width > this.rules.maxImageWidth ||
                    metadata.height > this.rules.maxImageHeight
                  ) {
                    checks.push({
                      filePath: assetPath,
                      assetType: 'image',
                      size,
                      maxSize: this.rules.maxImageSize,
                      withinLimit: false,
                      issue: this.createIssue(
                        'low',
                        'format-invalid',
                        'basic',
                        `Image dimensions ${metadata.width}x${metadata.height} exceed maximum ${this.rules.maxImageWidth}x${this.rules.maxImageHeight}`,
                        assetPath,
                        { width: metadata.width, height: metadata.height }
                      )
                    });
                  }
                }
              } catch (error) {
                // Image processing error
              }
            }
          }
        }
      }

      // Check audio sizes (if audio files present)
      const assetsPath = join(gamePath, 'assets');
      // Note: Audio file checking would go here if we had audio references in config
    } catch (error) {
      // Config parsing error - will be caught in schema validation
    }

    return checks;
  }

  /**
   * Validate JSON schemas
   */
  private async validateSchemas(
    gamePath: string,
    fileChecks: FileExistenceCheck[]
  ): Promise<SchemaValidationCheck[]> {
    const checks: SchemaValidationCheck[] = [];

    // Validate config.json
    if (this.rules.validateConfigSchema) {
      const configPath = join(gamePath, 'config.json');
      const check = await this.validateConfigSchema(configPath);
      if (check) {
        checks.push(check);
      }
    }

    // Validate i18n files
    if (this.rules.validateI18nSchema) {
      for (const i18nFile of ['en.json', 'ro.json']) {
        const i18nPath = join(gamePath, i18nFile);
        if (await this.fileExists(i18nPath)) {
          const check = await this.validateI18nSchema(i18nPath);
          if (check) {
            checks.push(check);
          }
        }
      }
    }

    return checks;
  }

  /**
   * Validate config schema
   */
  private async validateConfigSchema(
    configPath: string
  ): Promise<SchemaValidationCheck | null> {
    if (!(await this.fileExists(configPath))) {
      return null;
    }

    const errors: string[] = [];

    try {
      const configData = await readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);

      // Check required fields
      if (!config.meta) {
        errors.push('Missing required field: meta');
      } else {
        if (!config.meta.gameId) errors.push('Missing meta.gameId');
        if (!config.meta.themeName) errors.push('Missing meta.themeName');
        if (!config.meta.totalSteps) errors.push('Missing meta.totalSteps');
      }

      if (!config.questions || !Array.isArray(config.questions)) {
        errors.push('Missing or invalid questions array');
      } else {
        config.questions.forEach((q: any, idx: number) => {
          if (!q.id) errors.push(`Question ${idx}: missing id`);
          if (!q.questionKey) errors.push(`Question ${idx}: missing questionKey`);
          if (!q.choices || !Array.isArray(q.choices)) {
            errors.push(`Question ${idx}: missing or invalid choices array`);
          }
        });
      }

      const valid = errors.length === 0;

      return {
        filePath: configPath,
        schemaType: 'config',
        valid,
        errors,
        issue: !valid
          ? this.createIssue(
              'high',
              'schema-invalid',
              'basic',
              `Config schema validation failed: ${errors[0]}`,
              configPath,
              { errors }
            )
          : undefined
      };
    } catch (error) {
      return {
        filePath: configPath,
        schemaType: 'config',
        valid: false,
        errors: [`Failed to parse JSON: ${error}`],
        issue: this.createIssue(
          'critical',
          'schema-invalid',
          'basic',
          `Failed to parse config.json: ${error}`,
          configPath
        )
      };
    }
  }

  /**
   * Validate i18n schema
   */
  private async validateI18nSchema(
    i18nPath: string
  ): Promise<SchemaValidationCheck | null> {
    if (!(await this.fileExists(i18nPath))) {
      return null;
    }

    const errors: string[] = [];

    try {
      const i18nData = await readFile(i18nPath, 'utf-8');
      const i18n = JSON.parse(i18nData);

      // Check required fields
      if (!i18n.meta) {
        errors.push('Missing required field: meta');
      }

      if (!i18n.questions) {
        errors.push('Missing required field: questions');
      }

      const valid = errors.length === 0;

      return {
        filePath: i18nPath,
        schemaType: 'i18n',
        valid,
        errors,
        issue: !valid
          ? this.createIssue(
              'medium',
              'schema-invalid',
              'basic',
              `I18n schema validation failed: ${errors[0]}`,
              i18nPath,
              { errors }
            )
          : undefined
      };
    } catch (error) {
      return {
        filePath: i18nPath,
        schemaType: 'i18n',
        valid: false,
        errors: [`Failed to parse JSON: ${error}`],
        issue: this.createIssue(
          'high',
          'schema-invalid',
          'basic',
          `Failed to parse i18n file: ${error}`,
          i18nPath
        )
      };
    }
  }

  /**
   * Check asset reference integrity
   */
  private async checkReferenceIntegrity(
    gamePath: string,
    fileChecks: FileExistenceCheck[]
  ): Promise<ReferenceIntegrityCheck[]> {
    const checks: ReferenceIntegrityCheck[] = [];

    // Load config
    const configPath = join(gamePath, 'config.json');
    if (!(await this.fileExists(configPath))) {
      return checks;
    }

    try {
      const configData = await readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);

      // Check asset references
      for (const question of config.questions || []) {
        for (const choice of question.choices || []) {
          if (choice.assetPath) {
            const assetPath = join(gamePath, choice.assetPath);
            const exists = await this.fileExists(assetPath);

            checks.push({
              sourceFile: configPath,
              referencedFile: assetPath,
              referenceType: 'asset',
              exists,
              issue: !exists
                ? this.createIssue(
                    'high',
                    'reference-broken',
                    'basic',
                    `Asset reference broken: ${choice.assetPath} not found`,
                    configPath,
                    { assetPath: choice.assetPath }
                  )
                : undefined
            });
          }
        }

        // Check i18n key references
        const questionKey = question.questionKey;
        if (questionKey) {
          for (const lang of config.meta?.supportedLanguages || ['en']) {
            const i18nPath = join(gamePath, `${lang}.json`);
            if (await this.fileExists(i18nPath)) {
              const i18nData = await readFile(i18nPath, 'utf-8');
              const i18n = JSON.parse(i18nData);

              // Parse key path (e.g., "q1.question")
              const keyParts = questionKey.split('.');
              let value = i18n.questions;
              for (const part of keyParts) {
                value = value?.[part];
              }

              const exists = value !== undefined;
              checks.push({
                sourceFile: configPath,
                referencedFile: i18nPath,
                referenceType: 'i18n-key',
                exists,
                issue: !exists
                  ? this.createIssue(
                      'high',
                      'reference-broken',
                      'basic',
                      `I18n key '${questionKey}' not found in ${lang}.json`,
                      configPath,
                      { key: questionKey, lang }
                    )
                  : undefined
              });
            }
          }
        }
      }
    } catch (error) {
      // Config parsing error - already caught in schema validation
    }

    return checks;
  }

  // Utility methods

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath, fsConstants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create validation issue
   */
  private createIssue(
    severity: ValidationIssue['severity'],
    category: ValidationIssue['category'],
    stage: ValidationIssue['stage'],
    message: string,
    file?: string,
    details?: Record<string, any>
  ): ValidationIssue {
    return {
      id: `${stage}-${category}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      severity,
      category,
      stage,
      message,
      file,
      details,
      canAutoRemediate: this.canAutoRemediate(category),
      suggestedFix: this.getSuggestedFix(category)
    };
  }

  /**
   * Check if issue can be auto-remediated
   */
  private canAutoRemediate(category: ValidationIssue['category']): boolean {
    const remediableCategories: ValidationIssue['category'][] = [
      'size-exceeded',
      'format-invalid'
    ];
    return remediableCategories.includes(category);
  }

  /**
   * Get suggested fix for issue
   */
  private getSuggestedFix(category: ValidationIssue['category']): string | undefined {
    const fixes: Record<string, string> = {
      'file-missing': 'Ensure all required files are generated',
      'format-invalid': 'Convert to supported format or adjust image dimensions',
      'size-exceeded': 'Compress image or audio file',
      'schema-invalid': 'Fix JSON structure to match expected schema',
      'reference-broken': 'Verify asset paths and i18n keys'
    };
    return fixes[category];
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}
