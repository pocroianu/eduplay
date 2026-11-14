/**
 * Validation Module
 *
 * Phase 6: Validation Pipeline
 *
 * Comprehensive validation system for AI-generated game content including:
 * - Basic validation (files, formats, schemas)
 * - Quality scoring (images, text, audio)
 * - WCAG 2.1 AA compliance
 * - Educational appropriateness
 * - Auto-remediation
 * - Report generation
 *
 * @module validation
 */

// Main pipeline
export {
  ValidationPipeline,
  ValidationEvents,
  DEFAULT_PIPELINE_CONFIG
} from './ValidationPipeline';

// Validators
export {
  BasicValidator,
  DEFAULT_BASIC_RULES
} from './BasicValidator';

export {
  QualityScorer,
  DEFAULT_QUALITY_RULES
} from './QualityScorer';

export {
  ComplianceValidator,
  DEFAULT_COMPLIANCE_RULES
} from './ComplianceValidator';

// Remediation
export {
  AutoRemediator,
  DEFAULT_REMEDIATION_CONFIG,
  type RemediationConfig
} from './AutoRemediator';

// Report generation
export {
  ReportGenerator,
  DEFAULT_HTML_OPTIONS
} from './ReportGenerator';

// Types
export * from './types';
