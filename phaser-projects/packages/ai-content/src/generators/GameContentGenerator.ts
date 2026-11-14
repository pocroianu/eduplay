/**
 * Main orchestrator for game content generation.
 *
 * Coordinates multi-modal AI generation (images, text, audio) to create
 * complete game packages with transaction-like semantics and validation.
 *
 * @module generators/GameContentGenerator
 */

import { EventEmitter } from 'events';
import { mkdtemp, rm, mkdir, writeFile, copyFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';
import {
  GameGenerationRequest,
  GeneratedGamePackage,
  GenerationContext,
  GeneratedQuestion,
  GeneratedChoice,
  ValidationReport,
  ImageGenerationSpec
} from './types';
import { ImageContentGenerator } from './ImageContentGenerator';
import { TextContentGenerator } from './TextContentGenerator';
import { AudioContentGenerator } from './AudioContentGenerator';
import { QualityValidator } from '../training/QualityValidator';

/**
 * Generation events
 */
export const GenerationEvents = {
  GENERATION_STARTED: 'generation:started',
  QUESTION_STARTED: 'question:started',
  QUESTION_COMPLETED: 'question:completed',
  VALIDATION_STARTED: 'validation:started',
  VALIDATION_COMPLETED: 'validation:completed',
  GENERATION_COMPLETED: 'generation:completed',
  GENERATION_FAILED: 'generation:failed'
} as const;

/**
 * Main orchestrator for game content generation.
 *
 * Responsibilities:
 * - Coordinate multi-modal generation
 * - Manage generation lifecycle
 * - Implement transactional semantics
 * - Handle errors and retries
 * - Validate generated content
 */
export class GameContentGenerator extends EventEmitter {
  private imageGenerator: ImageContentGenerator;
  private textGenerator: TextContentGenerator;
  private audioGenerator: AudioContentGenerator;
  private validator: QualityValidator;
  private imageProvidersUsed: string[] = [];

  constructor(
    imageGenerator: ImageContentGenerator,
    textGenerator: TextContentGenerator,
    audioGenerator: AudioContentGenerator,
    validator: QualityValidator
  ) {
    super();
    this.imageGenerator = imageGenerator;
    this.textGenerator = textGenerator;
    this.audioGenerator = audioGenerator;
    this.validator = validator;
  }

  /**
   * Generate a complete game package
   */
  async generate(request: GameGenerationRequest): Promise<GeneratedGamePackage> {
    const startTime = Date.now();
    this.validatePackagePathInputs(request);
    this.emit(GenerationEvents.GENERATION_STARTED, request);
    this.imageProvidersUsed = [];

    // Create temporary working directory
    const tempDir = await mkdtemp(join(tmpdir(), 'game-gen-'));

    const context: GenerationContext = {
      request,
      tempDir,
      questions: [],
      assets: new Map(),
      startTime
    };

    try {
      // Phase 1: Generate questions (text only)
      await this.generateQuestions(context);

      // Phase 2: Generate images for choices
      await this.generateImages(context);

      // Phase 3: Generate audio narration
      await this.generateAudio(context);

      // Phase 4: Validate all content
      const validation = await this.validateContent(context);

      if (!validation.passed && request.validateBeforeCommit) {
        throw new Error(
          `Validation failed: ${validation.issues.length} issues found`
        );
      }

      // Phase 5: Build game package
      const gamePackage = await this.buildGamePackage(context, validation);

      // Phase 6: Commit to output directory
      await this.commitGamePackage(gamePackage, request.outputDir);

      // Cleanup temp directory
      await rm(tempDir, { recursive: true, force: true });

      const generationTime = Date.now() - startTime;
      gamePackage.generationTime = generationTime;

      this.emit(GenerationEvents.GENERATION_COMPLETED, gamePackage);

      return gamePackage;

    } catch (error) {
      // Rollback: cleanup temp directory
      await rm(tempDir, { recursive: true, force: true });

      this.emit(GenerationEvents.GENERATION_FAILED, error);

      // Retry logic
      if (request.retryOnFailure && request.maxRetries > 0) {
        console.log('Retrying generation...');
        request.maxRetries--;
        return this.generate(request);
      }

      throw error;
    }
  }

  // Private methods

  private async generateQuestions(context: GenerationContext): Promise<void> {
    const { request } = context;

    for (let i = 0; i < request.questionCount; i++) {
      this.emit(GenerationEvents.QUESTION_STARTED, i + 1);

      const question: GeneratedQuestion = {
        id: `q${i + 1}`,
        text: {},
        choices: [],
        correctChoiceId: '',
        category: request.category,
        audioFiles: {}
      };

      // Generate question text for each language
      for (const lang of request.languages) {
        const questionText = await this.textGenerator.generateQuestion({
          type: 'question',
          subject: request.category,
          language: lang,
          difficulty: request.difficulty
        });

        question.text[lang] = questionText;
      }

      // Generate choices
      const choiceSubjects = await this.selectChoiceSubjects(
        request.category,
        request.choicesPerQuestion
      );

      for (let j = 0; j < choiceSubjects.length; j++) {
        const choiceId = `${question.id}_choice${j + 1}`;
        const subject = choiceSubjects[j];
        const isCorrect = j === 0; // First choice is correct

        const choice: GeneratedChoice = {
          id: choiceId,
          text: {},
          imagePath: '', // Will be filled in image phase
          subject,
          category: request.category,
          correct: isCorrect
        };

        // Generate choice text for each language
        for (const lang of request.languages) {
          const choiceText = await this.textGenerator.generateChoiceText({
            type: 'choice',
            subject,
            language: lang,
            difficulty: request.difficulty
          });

          choice.text[lang] = choiceText;
        }

        question.choices.push(choice);

        if (isCorrect) {
          question.correctChoiceId = choiceId;
        }
      }

      // Shuffle choices
      this.shuffleArray(question.choices);

      context.questions.push(question);

      this.emit(GenerationEvents.QUESTION_COMPLETED, question);
    }
  }

  private async generateImages(context: GenerationContext): Promise<void> {
    const { request, tempDir } = context;

    const imageSpecs: Array<{ question: GeneratedQuestion; choice: GeneratedChoice; spec: ImageGenerationSpec }> = [];

    // Collect all image generation specs
    for (const question of context.questions) {
      for (const choice of question.choices) {
        const subject = choice.subject;

        imageSpecs.push({
          question,
          choice,
          spec: {
            subject,
            category: request.category,
            style: request.visualStyle || 'cartoon-friendly',
            loraModel: request.loraModel
          }
        });
      }
    }

    // Generate images in batch
    const images = await this.imageGenerator.generateBatch(
      imageSpecs.map(s => s.spec),
      {
        onProgress: (completed, total) => {
          console.log(`Generated ${completed}/${total} images`);
        }
      }
    );

    // Save images and update choices
    for (let i = 0; i < images.length; i++) {
      const { choice } = imageSpecs[i];
      const imageData = images[i];

      const filename = `${choice.id}.png`;
      const imagePath = join(tempDir, 'assets', filename);

      await mkdir(join(tempDir, 'assets'), { recursive: true });
      await writeFile(imagePath, imageData.buffer);

      choice.imagePath = imagePath;

      // Track asset
      context.assets.set(choice.id, {
        id: choice.id,
        type: 'image',
        path: imagePath,
        size: imageData.buffer.length,
        sha256: this.calculateSHA256(imageData.buffer),
        metadata: {
          width: imageData.width,
          height: imageData.height,
          subject: imageSpecs[i].spec.subject,
          provider: imageData.provider,
          providerDetails: imageData.providerDetails
        }
      });
    }

    this.imageProvidersUsed = this.imageGenerator.getUsedProviders();
  }

  private async generateAudio(context: GenerationContext): Promise<void> {
    const { request, tempDir } = context;

    const audioSpecs: Array<{ question: GeneratedQuestion; language: string; text: string }> = [];

    // Collect all audio generation specs
    for (const question of context.questions) {
      for (const lang of request.languages) {
        const text = question.text[lang];
        audioSpecs.push({ question, language: lang, text });
      }
    }

    // Generate audio in batch
    const audioFiles = await this.audioGenerator.generateBatch(
      audioSpecs.map(s => ({
        text: s.text,
        language: s.language
      })),
      {
        onProgress: (completed, total) => {
          console.log(`Generated ${completed}/${total} audio files`);
        }
      }
    );

    // Save audio and update questions
    for (let i = 0; i < audioFiles.length; i++) {
      const { question, language } = audioSpecs[i];
      const audioData = audioFiles[i];

      const filename = `${question.id}_${language}.mp3`;
      const audioPath = join(tempDir, 'assets', filename);

      await writeFile(audioPath, audioData.buffer);

      question.audioFiles[language] = audioPath;

      // Track asset
      const assetId = `${question.id}_audio_${language}`;
      context.assets.set(assetId, {
        id: assetId,
        type: 'audio',
        path: audioPath,
        size: audioData.buffer.length,
        sha256: this.calculateSHA256(audioData.buffer),
        metadata: {
          duration: audioData.duration,
          language
        }
      });
    }
  }

  private async validateContent(context: GenerationContext): Promise<ValidationReport> {
    this.emit(GenerationEvents.VALIDATION_STARTED);

    const report: ValidationReport = {
      passed: true,
      overallScore: 0,
      imageScores: [],
      textScores: [],
      audioScores: [],
      issues: []
    };

    // Validate images
    for (const asset of context.assets.values()) {
      if (asset.type === 'image') {
        const metrics = await this.validator.validateImage(asset.path);
        report.imageScores.push(metrics.overallScore);

        if (!metrics.passed) {
          report.passed = false;
          report.issues.push({
            severity: 'error',
            type: 'image',
            assetId: asset.id,
            message: metrics.issues.join(', ')
          });
        }
      }
    }

    // Validate text
    for (const question of context.questions) {
      for (const [lang, text] of Object.entries(question.text)) {
        const metrics = await this.validator.validateText(text);
        report.textScores.push(metrics.overallScore);

        if (!metrics.passed) {
          report.passed = false;
          report.issues.push({
            severity: 'warning',
            type: 'text',
            assetId: `${question.id}_${lang}`,
            message: metrics.issues.join(', ')
          });
        }
      }
    }

    // Calculate overall score
    const allScores = [
      ...report.imageScores,
      ...report.textScores,
      ...report.audioScores
    ];

    report.overallScore = allScores.length > 0
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length
      : 0;

    this.emit(GenerationEvents.VALIDATION_COMPLETED, report);

    return report;
  }

  private async buildGamePackage(
    context: GenerationContext,
    validation: ValidationReport
  ): Promise<GeneratedGamePackage> {
    const { request, questions, assets } = context;

    // Build game config
    const config = this.buildGameConfig(request, questions);

    // Build i18n files
    const i18n: Record<string, any> = {};
    for (const lang of request.languages) {
      i18n[lang] = this.buildI18nFile(lang, questions);
    }

    // Build asset manifest
    const assetManifest = {
      images: Array.from(assets.values()).filter(a => a.type === 'image'),
      audio: Array.from(assets.values()).filter(a => a.type === 'audio'),
      totalSize: Array.from(assets.values()).reduce((sum, a) => sum + a.size, 0)
    };

    return {
      gameId: request.gameId,
      metadata: {
        generatedAt: new Date(),
        generatorVersion: '1.0.0',
        request,
        providersUsed: {
          image: this.imageProvidersUsed.length > 0
            ? this.imageProvidersUsed.join(', ')
            : this.imageGenerator.constructor.name,
          text: typeof this.textGenerator.getProviderName === 'function'
            ? this.textGenerator.getProviderName()
            : this.textGenerator.constructor.name,
          audio: typeof this.audioGenerator.getProviderName === 'function'
            ? this.audioGenerator.getProviderName()
            : this.audioGenerator.constructor.name
        },
        loraModel: request.loraModel
      },
      config,
      i18n,
      assets: assetManifest,
      validation,
      generationTime: Date.now() - context.startTime
    };
  }

  private buildGameConfig(request: GameGenerationRequest, questions: GeneratedQuestion[]): any {
    return {
      meta: {
        gameId: request.gameId,
        version: '1.0.0',
        themeName: request.theme,
        difficulty: request.difficulty,
        totalSteps: questions.length,
        supportedLanguages: request.languages,
        gameType: 'multipleChoice'
      },
      questions: questions.map(q => ({
        id: q.id,
        questionKey: `${q.id}.question`,
        choices: q.choices.map(c => ({
          type: 'image',
          value: c.id,
          isCorrect: c.correct
        }))
      }))
    };
  }

  private buildI18nFile(lang: string, questions: GeneratedQuestion[]): any {
    const i18n: any = {
      meta: {
        title: `Generated Game ${lang.toUpperCase()}`
      },
      questions: {},
      choices: {}
    };

    for (const question of questions) {
      i18n.questions[question.id] = {
        question: question.text[lang]
      };

      for (const choice of question.choices) {
        i18n.choices[choice.id] = choice.text[lang];
      }
    }

    return i18n;
  }

  private async commitGamePackage(
    gamePackage: GeneratedGamePackage,
    outputDir: string
  ): Promise<void> {
    const request = gamePackage.metadata.request;
    const activityVersion = request.activityVersion ?? 1;
    const rendererId = request.rendererId ?? 'multiple-choice';
    const rendererVersion = request.rendererVersion ?? '^1.0.0';
    const gameDir = join(outputDir, gamePackage.gameId);
    const versionDir = join(gameDir, 'versions', String(activityVersion));
    const stringsDir = join(versionDir, 'strings');
    const imageLibraryDir = join(gameDir, 'assets', 'library', 'images');
    const audioLibraryDir = join(gameDir, 'assets', 'library', 'audio');

    await mkdir(stringsDir, { recursive: true });
    await mkdir(imageLibraryDir, { recursive: true });
    await mkdir(audioLibraryDir, { recursive: true });

    await writeFile(
      join(gameDir, 'activity.json'),
      JSON.stringify({
        activityId: gamePackage.gameId,
        version: activityVersion,
        renderer: { id: rendererId, version: rendererVersion },
        gameId: gamePackage.gameId
      }, null, 2)
    );

    await writeFile(
      join(versionDir, 'config.json'),
      JSON.stringify(gamePackage.config, null, 2)
    );

    for (const [lang, content] of Object.entries(gamePackage.i18n)) {
      await writeFile(
        join(stringsDir, `${lang}.json`),
        JSON.stringify(content, null, 2)
      );
    }

    for (const asset of gamePackage.assets.images) {
      await copyFile(asset.path, join(imageLibraryDir, `${asset.id}.png`));
    }
    for (const asset of gamePackage.assets.audio) {
      await copyFile(asset.path, join(audioLibraryDir, `${asset.id}.mp3`));
    }

    await writeFile(
      join(versionDir, 'assets.json'),
      JSON.stringify(this.buildActivityAssetRegistry(gamePackage), null, 2)
    );

    await writeFile(
      join(gameDir, 'generation-metadata.json'),
      JSON.stringify(gamePackage.metadata, null, 2)
    );
  }

  private buildActivityAssetRegistry(gamePackage: GeneratedGamePackage): any {
    const pinnedAssets: Record<string, any> = {};
    const images = gamePackage.assets.images.map((asset) => {
      pinnedAssets[asset.id] = {
        type: 'image',
        assetId: `sha256-${asset.sha256}`,
        sha256: asset.sha256,
        path: `/assets/library/images/${asset.id}.png`
      };
      return asset.id;
    });
    const audio = gamePackage.assets.audio.map((asset) => {
      pinnedAssets[asset.id] = {
        type: 'audio',
        assetId: `sha256-${asset.sha256}`,
        sha256: asset.sha256,
        path: `/assets/library/audio/${asset.id}.mp3`
      };
      return asset.id;
    });

    return {
      version: '2.0.0',
      baseUrl: '/assets/library',
      pinnedAssets,
      games: {
        [gamePackage.gameId]: {
          manifest: { images, audio, spritesheets: [] }
        }
      }
    };
  }

  // Utility methods

  private async selectChoiceSubjects(
    category: string,
    count: number
  ): Promise<string[]> {
    // Select subjects from category
    const categorySubjects: Record<string, string[]> = {
      fruits: ['apple', 'banana', 'orange', 'grape', 'strawberry', 'watermelon'],
      animals: ['dog', 'cat', 'rabbit', 'bird', 'fish', 'elephant'],
      colors: ['red', 'blue', 'yellow', 'green', 'orange', 'purple'],
      shapes: ['circle', 'square', 'triangle', 'rectangle', 'star', 'heart']
    };

    const subjects = categorySubjects[category] || [];
    return this.shuffleArray([...subjects]).slice(0, count);
  }


  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private validatePackagePathInputs(request: GameGenerationRequest): void {
    this.assertSafeActivityId(request.gameId, 'id');
    if (request.rendererId) this.assertSafeActivityId(request.rendererId, 'renderer id');
    const activityVersion = request.activityVersion ?? 1;
    if (!Number.isInteger(activityVersion) || activityVersion <= 0) {
      throw new Error(`Invalid Activity package version: expected a positive integer, got ${activityVersion}`);
    }
    for (const language of request.languages) {
      if (language !== 'en' && language !== 'ro') {
        throw new Error(`Invalid Activity package language: expected en or ro, got ${language}`);
      }
    }
  }

  private assertSafeActivityId(value: string, label: string): void {
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(value)) {
      throw new Error(`Invalid Activity package ${label}: expected a safe slug, got ${value}`);
    }
  }

  private calculateSHA256(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }
}
