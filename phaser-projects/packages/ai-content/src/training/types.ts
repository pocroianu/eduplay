/**
 * Training Data Collection Types
 *
 * Type definitions for Phase 3: Training Data Collection
 */

/**
 * Extracted game data from existing games
 */
export interface ExtractedGameData {
  gameId: string;
  meta: {
    title: string;
    theme: string;
    difficulty: 'easy' | 'medium' | 'hard';
    languages: string[];
  };
  questions: ExtractedQuestion[];
  assets: ExtractedAsset[];
  statistics: ExtractionStatistics;
}

/**
 * Extracted question with all metadata
 */
export interface ExtractedQuestion {
  id: string;
  text: Record<string, string>; // language -> text
  category: string; // fruits, animals, colors, etc.
  choices: ExtractedChoice[];
  correctChoice: string;
  difficulty: number;
}

/**
 * Extracted choice (answer option)
 */
export interface ExtractedChoice {
  id: string;
  text: Record<string, string>;
  assetPath?: string;
  category: string;
}

/**
 * Extracted asset (image/audio)
 */
export interface ExtractedAsset {
  path: string;
  type: 'image' | 'audio';
  category: string;
  tags: string[];
  metadata: AssetMetadata;
}

/**
 * Asset metadata from analysis
 */
export interface AssetMetadata {
  // Image metadata
  width?: number;
  height?: number;
  format?: string;
  colorPalette?: string[];
  dominantColors?: string[];
  complexity?: number;
  hasTransparency?: boolean;

  // Audio metadata
  duration?: number;
  sampleRate?: number;
  bitrate?: number;
}

/**
 * Extraction statistics
 */
export interface ExtractionStatistics {
  totalQuestions: number;
  totalChoices: number;
  totalAssets: number;
  categoryCounts: Record<string, number>;
  languageCounts: Record<string, number>;
  difficultyDistribution: Record<string, number>;
}

/**
 * Prompt template definition
 */
export interface PromptTemplate {
  id: string;
  category: string;
  type: 'image' | 'text' | 'audio';
  template: string;
  variables: PromptVariable[];
  style?: string;
  negativePrompt?: string;
  examples?: string[];
  metadata: {
    targetAge: string;
    complexity: 'simple' | 'moderate' | 'complex';
    version: string;
    author: string;
  };
}

/**
 * Prompt template variable
 */
export interface PromptVariable {
  name: string;
  type: 'string' | 'number' | 'enum' | 'boolean';
  description: string;
  required: boolean;
  default?: any;
  options?: string[]; // For enum type
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

/**
 * Built prompt from template
 */
export interface BuiltPrompt {
  templateId: string;
  prompt: string;
  negativePrompt?: string;
  variables: Record<string, any>;
  metadata: {
    category: string;
    style?: string;
    generatedAt: Date;
  };
}

/**
 * Training dataset entry (image)
 */
export interface ImageDatasetEntry {
  id: string;
  prompt: string;
  negativePrompt: string;
  imagePath: string;
  category: string;
  style: string;
  metadata: {
    width: number;
    height: number;
    sourceGame?: string;
    sourceAsset?: string;
    tags: string[];
  };
}

/**
 * Training dataset entry (text)
 */
export interface TextDatasetEntry {
  id: string;
  prompt: string;
  completion: string;
  category: string;
  metadata: {
    language: string;
    difficulty: string;
    targetAge: string;
    wordCount: number;
    readabilityScore: number;
  };
}

/**
 * Training dataset entry (audio)
 */
export interface AudioDatasetEntry {
  id: string;
  text: string;
  audioPath: string;
  language: string;
  voice: string;
  metadata: {
    duration: number;
    pace: number; // words per minute
    targetAge: string;
  };
}

/**
 * Quality metrics for validation
 */
export interface QualityMetrics {
  // Image metrics
  image?: {
    sharpness: number;        // 0-100
    simplicity: number;       // 0-100
    backgroundClean: number;  // 0-100
    colorConsistency: number; // 0-100
    appropriateness: number;  // 0-100
  };

  // Text metrics
  text?: {
    readability: number;      // Flesch-Kincaid grade level
    wordCount: number;
    appropriateness: number;  // 0-100
    grammarScore: number;     // 0-100
    safetyScore: number;      // 0-100
  };

  // Audio metrics
  audio?: {
    clarity: number;          // 0-100
    pace: number;             // words per minute
    volume: number;           // normalized 0-1
    pronunciationScore: number; // 0-100
  };

  // Overall
  overallScore: number;       // 0-100
  passed: boolean;
  issues: string[];
}

/**
 * Training manifest for LoRA
 */
export interface TrainingManifest {
  version: string;
  createdAt: Date;
  baseModel: string;
  dataset: {
    trainSize: number;
    valSize: number;
    testSize: number;
    categories: string[];
  };
  training: {
    epochs: number;
    batchSize: number;
    learningRate: number;
    loraRank: number;
    loraAlpha: number;
  };
  validation: {
    minQualityScore: number;
    passRate: number;
  };
  files: {
    train: string;
    val: string;
    test: string;
    prompts: string;
  };
}

/**
 * Content analysis result
 */
export interface ContentAnalysis {
  contentType: 'image' | 'text' | 'audio';
  totalItems: number;
  patterns: {
    categories: Record<string, number>;
    styles: Record<string, number>;
    commonThemes: string[];
  };
  imageAnalysis?: {
    averageWidth: number;
    averageHeight: number;
    commonColors: string[];
    averageComplexity: number;
    formats: Record<string, number>;
  };
  textAnalysis?: {
    averageWordCount: number;
    averageReadability: number;
    commonWords: string[];
    sentencePatterns: string[];
  };
  audioAnalysis?: {
    averageDuration: number;
    sampleRates: Record<number, number>;
    languages: Record<string, number>;
  };
}

/**
 * Data extractor configuration
 */
export interface DataExtractorConfig {
  /** Root directory containing Activity folders. */
  gamesPath: string;
  outputPath: string;
  includeAssets: boolean;
  languages: string[];
}

/**
 * Content analyzer configuration
 */
export interface ContentAnalyzerConfig {
  inputPath: string;
  outputPath: string;
  contentType: 'image' | 'text' | 'audio';
}

/**
 * Dataset builder configuration
 */
export interface DatasetBuilderConfig {
  outputPath: string;
  split: {
    train: number;  // 0.7
    val: number;    // 0.15
    test: number;   // 0.15
  };
  shuffle: boolean;
  seed?: number;
}

/**
 * Validation rules configuration
 */
export interface ValidationRules {
  image: {
    minSharpness: number;
    minSimplicity: number;
    minBackgroundClean: number;
    minWidth: number;
    minHeight: number;
  };
  text: {
    maxGradeLevel: number;
    minWords: number;
    maxWords: number;
    minGrammarScore: number;
    minSafetyScore: number;
  };
  audio: {
    minClarity: number;
    minPace: number;
    maxPace: number;
    minVolume: number;
    maxVolume: number;
  };
  overallMinScore: number;
}

/**
 * Prompt builder result
 */
export interface PromptBuildResult {
  success: boolean;
  prompt?: BuiltPrompt;
  error?: string;
  validationErrors?: string[];
}

// ============================================================================
// Phase 4: LoRA Training Types
// ============================================================================

/**
 * Base model types supported for LoRA training
 */
export type BaseModel = 'sdxl-1.0' | 'sd-1.5' | 'sdxl-turbo';

/**
 * Optimizer types
 */
export type OptimizerType = 'AdamW' | 'AdamW8bit' | 'Adafactor' | 'Lion';

/**
 * Learning rate scheduler types
 */
export type LRSchedulerType =
  | 'linear'
  | 'cosine'
  | 'cosine_with_restarts'
  | 'polynomial'
  | 'constant'
  | 'constant_with_warmup';

/**
 * Mixed precision training modes
 */
export type MixedPrecision = 'no' | 'fp16' | 'bf16';

/**
 * Training job status
 */
export type TrainingStatus =
  | 'pending'
  | 'preparing'
  | 'training'
  | 'validating'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Complete LoRA training configuration
 */
export interface LoRATrainingConfig {
  // Job identification
  name: string;
  description?: string;

  // Dataset
  datasetPath: string; // Path to JSONL file from Phase 3

  // Model configuration
  baseModel: BaseModel;
  resolution: number; // 512 or 1024

  // Training hyperparameters
  epochs: number;
  batchSize: number;
  learningRate: number;
  loraRank: number;
  loraAlpha: number;

  // Optimizer settings
  optimizer: OptimizerType;
  lrScheduler: LRSchedulerType;
  lrWarmupSteps?: number;

  // Advanced training options
  mixedPrecision: MixedPrecision;
  gradientAccumulationSteps?: number;
  maxGradNorm?: number;
  minSNRGamma?: number; // Recommended: 5
  noiseOffset?: number; // Recommended: 0.03

  // Checkpointing
  saveEveryNEpochs: number;
  keepNCheckpoints: number;

  // Validation
  validationEpochs: number[]; // e.g., [25, 50, 75, 100]
  validationPrompts?: string[];

  // Output
  outputDir?: string; // Defaults to loras/

  // Advanced options
  seed?: number;
  enableXformers?: boolean; // Memory optimization
  enableCPUOffload?: boolean; // For limited VRAM
  cacheLatents?: boolean; // Speed optimization
}

/**
 * Training job with runtime state
 */
export interface TrainingJob {
  // Job identification
  id: string;
  name: string;
  status: TrainingStatus;

  // Configuration
  config: LoRATrainingConfig;

  // Progress tracking
  progress: TrainingProgress;

  // Timing
  startedAt?: Date;
  completedAt?: Date;
  estimatedEndTime?: Date;

  // Results
  result?: TrainingResult;
  error?: TrainingError;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Real-time training progress
 */
export interface TrainingProgress {
  // Epoch progress
  currentEpoch: number;
  totalEpochs: number;

  // Step progress
  currentStep: number;
  totalSteps: number;
  stepsPerEpoch: number;

  // Metrics
  currentLoss: number;
  avgLoss: number;
  learningRate: number;

  // Validation
  lastValidationEpoch?: number;
  validationMetrics?: ValidationMetrics;

  // Performance
  stepsPerSecond: number;
  epochsPerHour: number;

  // Progress percentage (0-100)
  percentage: number;
}

/**
 * Validation metrics from prompt testing
 */
export interface ValidationMetrics {
  epoch: number;
  timestamp: Date;

  // Per-prompt results
  prompts: Array<{
    prompt: string;
    imagePath: string;
    score: number; // Visual quality score 0-100
  }>;

  // Aggregate metrics
  avgScore: number;
  minScore: number;
  maxScore: number;

  // Advanced metrics (if FID calculator available)
  fidScore?: number; // Fréchet Inception Distance
  clipScore?: number; // CLIP similarity score
}

/**
 * Training result on completion
 */
export interface TrainingResult {
  // Model output
  loraPath: string;
  modelSize: number; // bytes

  // Training metrics
  finalLoss: number;
  avgLoss: number;
  totalSteps: number;
  totalEpochs: number;

  // Validation results
  validationMetrics?: ValidationMetrics[];

  // Performance
  trainingDuration: number; // seconds
  avgStepsPerSecond: number;

  // Checkpoints
  checkpoints: string[]; // Paths to saved checkpoints

  // Metadata
  completedAt: Date;
}

/**
 * Training error details
 */
export interface TrainingError {
  code: string;
  message: string;
  stack?: string;
  timestamp: Date;

  // Context
  epoch?: number;
  step?: number;

  // Recovery
  canResume: boolean;
  suggestedAction?: string;
}

export interface TrainingPreflightResult {
  datasetEntries: number;
  imageCount: number;
  hostTrainingRoot: string;
  containerTrainingRoot: string;
  requiredNodes: string[];
}

/**
 * LoRA model metadata
 */
export interface LoRAModel {
  // Identification
  id: string;
  name: string;
  version: string;

  // File info
  path: string;
  size: number;
  checksum: string; // SHA256

  // Training info
  baseModel: BaseModel;
  trainingConfig: LoRATrainingConfig;
  trainingResult: TrainingResult;

  // Metadata
  description?: string;
  tags?: string[];
  createdAt: Date;

  // Usage stats
  generationCount?: number;
  lastUsedAt?: Date;
}

/**
 * ComfyUI workflow definition for training
 */
export interface ComfyUIWorkflow {
  // Workflow structure
  nodes: Record<string, ComfyUINode>;

  // Execution order
  executionOrder?: string[];

  // Metadata
  metadata?: {
    title?: string;
    description?: string;
    version?: string;
  };
}

/**
 * ComfyUI workflow node
 */
export interface ComfyUINode {
  class_type: string;
  inputs: Record<string, any>;
  _meta?: {
    title?: string;
  };
}

/**
 * WebSocket message from ComfyUI
 */
export interface ComfyUIMessage {
  type: 'execution_start' | 'execution_cached' | 'executing' | 'executed' | 'progress' | 'execution_error' | 'status';
  data: any;
}

/**
 * Training preset definition
 */
export interface TrainingPreset {
  id: string;
  name: string;
  description: string;

  // Recommended use cases
  bestFor: string[];

  // Configuration template
  config: Partial<LoRATrainingConfig>;

  // Expected results
  expectedTrainingTime?: string; // e.g., "2-4 hours"
  expectedGPUMemory?: string; // e.g., "12-16GB"
  expectedModelSize?: string; // e.g., "300-500MB"
}

/**
 * Model export options
 */
export interface ModelExportOptions {
  includeMetadata: boolean;
  includeCheckpoints: boolean;
  includeValidationImages: boolean;
  compressionLevel?: number; // 0-9 for tar.gz
}

/**
 * Training job filter
 */
export interface TrainingJobFilter {
  status?: TrainingStatus | TrainingStatus[];
  name?: string;
  startedAfter?: Date;
  startedBefore?: Date;
  limit?: number;
  offset?: number;
}
