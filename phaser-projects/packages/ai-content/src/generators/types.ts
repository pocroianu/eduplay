/**
 * Type definitions for game content generation.
 *
 * @module generators/types
 */

/**
 * Generation request for a complete game
 */
export interface GameGenerationRequest {
  // Game metadata
  category: string;
  theme: string;
  difficulty: 'easy' | 'medium' | 'hard';
  languages: string[];

  // Content structure
  questionCount: number;
  choicesPerQuestion: number;

  // Runtime target
  rendererId?: string;
  rendererVersion?: string;
  activityVersion?: number;

  // Style preferences
  visualStyle?: string;
  loraModel?: string;

  // Quality settings
  validateBeforeCommit: boolean;
  retryOnFailure: boolean;
  maxRetries: number;

  // Output
  outputDir: string;
  gameId: string;
}

/**
 * Generated game package
 */
export interface GeneratedGamePackage {
  gameId: string;
  metadata: GameMetadata;
  config: any; // Game config JSON
  i18n: Record<string, any>; // Language files
  assets: GeneratedAssetManifest;
  validation: ValidationReport;
  generationTime: number;
}

/**
 * Game metadata
 */
export interface GameMetadata {
  generatedAt: Date;
  generatorVersion: string;
  request: GameGenerationRequest;
  providersUsed: {
    image: string;
    text: string;
    audio: string;
  };
  loraModel?: string;
}

/**
 * Asset manifest
 */
export interface GeneratedAssetManifest {
  images: AssetInfo[];
  audio: AssetInfo[];
  totalSize: number;
}

/**
 * Individual asset info
 */
export interface AssetInfo {
  id: string;
  type: 'image' | 'audio';
  path: string;
  size: number;
  sha256: string;
  metadata: Record<string, any>;
}

/**
 * Validation report
 */
export interface ValidationReport {
  passed: boolean;
  overallScore: number;
  imageScores: number[];
  textScores: number[];
  audioScores: number[];
  issues: ValidationIssue[];
}

/**
 * Validation issue
 */
export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  type: 'image' | 'text' | 'audio';
  assetId: string;
  message: string;
}

/**
 * Generation context (internal state)
 */
export interface GenerationContext {
  request: GameGenerationRequest;
  tempDir: string;
  questions: GeneratedQuestion[];
  assets: Map<string, AssetInfo>;
  startTime: number;
}

/**
 * Generated question
 */
export interface GeneratedQuestion {
  id: string;
  text: Record<string, string>; // lang -> text
  choices: GeneratedChoice[];
  correctChoiceId: string;
  category: string;
  audioFiles: Record<string, string>; // lang -> path
}

/**
 * Generated choice
 */
export interface GeneratedChoice {
  id: string;
  text: Record<string, string>;
  imagePath: string;
  subject: string;
  category: string;
  correct: boolean;
}

/**
 * Image generation spec
 */
export interface ImageGenerationSpec {
  subject: string;
  category: string;
  style: string;
  loraModel?: string;
  seed?: number;
}

/**
 * Text generation spec
 */
export interface TextGenerationSpec {
  type: 'question' | 'choice' | 'feedback';
  subject: string;
  language: string;
  difficulty: string;
  context?: Record<string, any>;
}

/**
 * Audio generation spec
 */
export interface AudioGenerationSpec {
  text: string;
  language: string;
  voice?: string;
  speed?: number;
}

/**
 * Batch generation options
 */
export interface BatchGenerationOptions {
  onProgress?: (completed: number, total: number) => void;
  concurrency?: number;
}
