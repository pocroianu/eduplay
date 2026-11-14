/**
 * Type definitions for Phase 6: Validation Pipeline
 *
 * Comprehensive validation system for AI-generated game content.
 *
 * @module validation/types
 */

/**
 * Validation pipeline configuration
 */
export interface ValidationPipelineConfig {
  // Validation rules
  rules: ValidationRules;

  // Pipeline stages to run
  stages: ValidationStage[];

  // Fail-fast behavior
  failFast: boolean;

  // Auto-remediation
  enableRemediation: boolean;

  // Report generation
  generateReport: boolean;
  reportFormat: 'json' | 'html' | 'both';
  reportOutputPath?: string;

  // Concurrency
  concurrency: number;
}

/**
 * Validation stages
 */
export type ValidationStage =
  | 'basic'
  | 'quality'
  | 'compliance'
  | 'remediation';

/**
 * Complete validation rules
 */
export interface ValidationRules {
  // File existence and format
  basic: BasicValidationRules;

  // Quality scoring
  quality: QualityValidationRules;

  // WCAG compliance
  compliance: ComplianceValidationRules;
}

/**
 * Basic validation rules
 */
export interface BasicValidationRules {
  // Required files
  requireConfigFile: boolean;
  requireI18nFiles: boolean;
  requireAssets: boolean;

  // File formats
  allowedImageFormats: string[]; // ['png', 'jpg', 'webp']
  allowedAudioFormats: string[]; // ['mp3', 'ogg', 'wav']

  // Size limits
  maxImageSize: number; // bytes (default: 2MB)
  maxAudioSize: number; // bytes (default: 1MB)

  // Asset requirements
  minImageWidth: number;
  minImageHeight: number;
  maxImageWidth: number;
  maxImageHeight: number;

  // Schema validation
  validateConfigSchema: boolean;
  validateI18nSchema: boolean;
}

/**
 * Quality validation rules
 */
export interface QualityValidationRules {
  // Minimum scores (0-100)
  minImageQuality: number;
  minTextQuality: number;
  minAudioQuality: number;
  minOverallQuality: number;

  // Image quality
  minSharpness: number;
  minSimplicity: number;
  minBackgroundClean: number;

  // Text quality
  maxReadabilityGrade: number; // Flesch-Kincaid
  minWords: number;
  maxWords: number;
  minGrammarScore: number;
  minSafetyScore: number;

  // Audio quality
  minClarity: number;
  minPace: number; // WPM
  maxPace: number; // WPM
}

/**
 * WCAG 2.1 AA compliance rules
 */
export interface ComplianceValidationRules {
  // Color contrast
  minNormalTextContrast: number; // 4.5:1
  minLargeTextContrast: number; // 3:1
  largeTextThreshold: number; // 18pt or 14pt bold

  // Alt text
  requireAltText: boolean;
  minAltTextLength: number;
  maxAltTextLength: number;

  // Educational appropriateness
  targetAgeRange: [number, number]; // [3, 8]
  checkContentSafety: boolean;
  checkReadingLevel: boolean;

  // Technical compliance
  validateJSONSchema: boolean;
  checkI18nCompleteness: boolean;
  checkAssetReferences: boolean;
}

/**
 * Complete validation report
 */
export interface ValidationReport {
  // Game identification
  gameId: string;
  validatedAt: Date;
  validationDuration: number; // milliseconds

  // Overall status
  passed: boolean;
  overallScore: number; // 0-100

  // Stage results
  stages: {
    basic?: BasicValidationResult;
    quality?: QualityValidationResult;
    compliance?: ComplianceValidationResult;
    remediation?: RemediationResult;
  };

  // Issues summary
  summary: ValidationSummary;

  // Recommendations
  recommendations: string[];
}

/**
 * Validation summary
 */
export interface ValidationSummary {
  totalIssues: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;

  // By type
  imageIssues: number;
  textIssues: number;
  audioIssues: number;
  configIssues: number;

  // By category
  basicValidationIssues: number;
  qualityIssues: number;
  complianceIssues: number;

  // Remediation
  autoRemediatedIssues: number;
  manualRemediationRequired: number;
}

/**
 * Basic validation result
 */
export interface BasicValidationResult {
  passed: boolean;
  startedAt: Date;
  completedAt: Date;
  duration: number;

  // File existence checks
  fileChecks: FileExistenceCheck[];

  // Format validation
  formatChecks: FormatValidationCheck[];

  // Asset size checks
  sizeChecks: AssetSizeCheck[];

  // Schema validation
  schemaChecks: SchemaValidationCheck[];

  // Asset reference integrity
  referenceChecks: ReferenceIntegrityCheck[];

  // Issues
  issues: ValidationIssue[];
}

/**
 * File existence check
 */
export interface FileExistenceCheck {
  filePath: string;
  fileType: 'config' | 'i18n' | 'image' | 'audio';
  exists: boolean;
  required: boolean;
  issue?: ValidationIssue;
}

/**
 * Format validation check
 */
export interface FormatValidationCheck {
  filePath: string;
  expectedFormat: string;
  actualFormat?: string;
  valid: boolean;
  issue?: ValidationIssue;
}

/**
 * Asset size check
 */
export interface AssetSizeCheck {
  filePath: string;
  assetType: 'image' | 'audio';
  size: number;
  maxSize: number;
  withinLimit: boolean;
  issue?: ValidationIssue;
}

/**
 * Schema validation check
 */
export interface SchemaValidationCheck {
  filePath: string;
  schemaType: 'config' | 'i18n';
  valid: boolean;
  errors: string[];
  issue?: ValidationIssue;
}

/**
 * Reference integrity check
 */
export interface ReferenceIntegrityCheck {
  sourceFile: string;
  referencedFile: string;
  referenceType: 'asset' | 'i18n-key';
  exists: boolean;
  issue?: ValidationIssue;
}

/**
 * Quality validation result
 */
export interface QualityValidationResult {
  passed: boolean;
  startedAt: Date;
  completedAt: Date;
  duration: number;

  // Scores
  overallScore: number;
  imageScores: AssetQualityScore[];
  textScores: TextQualityScore[];
  audioScores: AssetQualityScore[];

  // Aggregate metrics
  avgImageScore: number;
  avgTextScore: number;
  avgAudioScore: number;

  // Issues
  issues: ValidationIssue[];
}

/**
 * Asset quality score
 */
export interface AssetQualityScore {
  assetId: string;
  assetPath: string;
  assetType: 'image' | 'audio';
  score: number;
  metrics: Record<string, number>;
  passed: boolean;
  issues: string[];
}

/**
 * Text quality score
 */
export interface TextQualityScore {
  textId: string;
  text: string;
  language: string;
  score: number;
  metrics: {
    readability: number;
    wordCount: number;
    appropriateness: number;
    grammarScore: number;
    safetyScore: number;
  };
  passed: boolean;
  issues: string[];
}

/**
 * Compliance validation result
 */
export interface ComplianceValidationResult {
  passed: boolean;
  startedAt: Date;
  completedAt: Date;
  duration: number;

  // WCAG checks
  wcagChecks: WCAGCheck[];

  // Educational checks
  educationalChecks: EducationalCheck[];

  // Technical checks
  technicalChecks: TechnicalCheck[];

  // Issues
  issues: ValidationIssue[];
}

/**
 * WCAG compliance check
 */
export interface WCAGCheck {
  checkType: 'color-contrast' | 'alt-text' | 'keyboard-nav' | 'screen-reader';
  guideline: string; // e.g., "1.4.3 Contrast (Minimum)"
  level: 'A' | 'AA' | 'AAA';
  passed: boolean;
  details: Record<string, any>;
  issue?: ValidationIssue;
}

/**
 * Educational appropriateness check
 */
export interface EducationalCheck {
  checkType: 'age-appropriate' | 'reading-level' | 'content-safety' | 'vocabulary';
  passed: boolean;
  details: Record<string, any>;
  issue?: ValidationIssue;
}

/**
 * Technical compliance check
 */
export interface TechnicalCheck {
  checkType: 'schema' | 'i18n-completeness' | 'asset-references' | 'file-format';
  passed: boolean;
  details: Record<string, any>;
  issue?: ValidationIssue;
}

/**
 * Remediation result
 */
export interface RemediationResult {
  startedAt: Date;
  completedAt: Date;
  duration: number;

  // Remediation actions
  actions: RemediationAction[];

  // Summary
  totalIssues: number;
  autoRemediatedIssues: number;
  manualRemediationRequired: number;

  // Issues that couldn't be fixed
  unresolvedIssues: ValidationIssue[];
}

/**
 * Remediation action
 */
export interface RemediationAction {
  issueId: string;
  actionType: RemediationType;
  description: string;
  applied: boolean;
  success: boolean;
  error?: string;
  details: Record<string, any>;
}

/**
 * Remediation types
 */
export type RemediationType =
  | 'image-resize'
  | 'image-compress'
  | 'image-format-convert'
  | 'contrast-adjust'
  | 'text-spell-check'
  | 'text-grammar-fix'
  | 'audio-normalize'
  | 'audio-format-convert'
  | 'add-alt-text'
  | 'fix-reference';

/**
 * Validation issue
 */
export interface ValidationIssue {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  stage: ValidationStage;

  // Description
  message: string;
  description?: string;

  // Location
  file?: string;
  assetId?: string;
  line?: number;

  // Metadata
  code?: string; // Error code (e.g., "IMG-001")
  details?: Record<string, any>;

  // Remediation
  canAutoRemediate: boolean;
  suggestedFix?: string;
  remediationAction?: RemediationType;
}

/**
 * Issue severity levels
 */
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Issue categories
 */
export type IssueCategory =
  | 'file-missing'
  | 'format-invalid'
  | 'size-exceeded'
  | 'quality-low'
  | 'contrast-insufficient'
  | 'alt-text-missing'
  | 'readability-high'
  | 'safety-concern'
  | 'reference-broken'
  | 'schema-invalid'
  | 'i18n-incomplete';

/**
 * Validation context (internal state)
 */
export interface ValidationContext {
  // Input
  gameId: string;
  gamePath: string;
  config: ValidationPipelineConfig;

  // State
  startTime: number;
  currentStage?: ValidationStage;

  // Loaded data
  gameConfig?: any;
  i18nFiles?: Record<string, any>;
  assets?: Map<string, AssetInfo>;

  // Issues collected
  issues: ValidationIssue[];

  // Progress tracking
  completedStages: ValidationStage[];
}

/**
 * Asset information
 */
export interface AssetInfo {
  id: string;
  type: 'image' | 'audio';
  path: string;
  absolutePath: string;
  size: number;
  exists: boolean;
  metadata?: Record<string, any>;
}

/**
 * Color contrast result
 */
export interface ColorContrastResult {
  foreground: string; // hex color
  background: string; // hex color
  ratio: number;
  passesAA: boolean;
  passesAAA: boolean;
  wcagLevel: 'AAA' | 'AA' | 'A' | 'fail';
}

/**
 * HTML report options
 */
export interface HTMLReportOptions {
  title?: string;
  includeCharts: boolean;
  includeScreenshots: boolean;
  theme: 'light' | 'dark';
}

/**
 * Report generation options
 */
export interface ReportGenerationOptions {
  format: 'json' | 'html' | 'both';
  outputPath: string;
  htmlOptions?: HTMLReportOptions;
  includeDetails: boolean;
}

/**
 * Validation progress event
 */
export interface ValidationProgressEvent {
  stage: ValidationStage;
  progress: number; // 0-100
  message: string;
  details?: Record<string, any>;
}

/**
 * Batch validation options
 */
export interface BatchValidationOptions {
  concurrency: number;
  onProgress?: (completed: number, total: number, gameId: string) => void;
  stopOnFirstFailure: boolean;
}

/**
 * Batch validation result
 */
export interface BatchValidationResult {
  totalGames: number;
  passedGames: number;
  failedGames: number;
  reports: Map<string, ValidationReport>;
  summary: {
    avgScore: number;
    totalIssues: number;
    totalCriticalIssues: number;
    commonIssues: Array<{ issue: string; count: number }>;
  };
}
