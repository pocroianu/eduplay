/**
 * CLI command for generating game content.
 *
 * @module cli/commands/generate
 */

import { Command } from 'commander';
import { GameContentGenerator, GenerationEvents } from '../../generators/GameContentGenerator';
import { ImageContentGenerator } from '../../generators/ImageContentGenerator';
import { TextContentGenerator } from '../../generators/TextContentGenerator';
import { AudioContentGenerator } from '../../generators/AudioContentGenerator';
import { ProviderFactory } from '../../providers/factory/ProviderFactory';
import { QualityValidator } from '../../training/QualityValidator';
import { PromptBuilder } from '../../training/PromptBuilder';
import ora from 'ora';

export interface GenerateCommandOptions {
  category: string;
  theme: string;
  difficulty: 'easy' | 'medium' | 'hard' | string;
  questions: string;
  languages: string;
  lora?: string;
  imageModel?: string;
  output: string;
  validate: boolean;
}

function resolveDifficulty(value: GenerateCommandOptions['difficulty']): 'easy' | 'medium' | 'hard' {
  if (!['easy', 'medium', 'hard'].includes(value)) {
    throw new Error(`Invalid difficulty: ${value}. Must be 'easy', 'medium', or 'hard'.`);
  }

  return value as 'easy' | 'medium' | 'hard';
}

export function parseLanguages(value: string): string[] {
  const languages = value.split(',').map(language => language.trim()).filter(Boolean);
  if (languages.length === 0) {
    throw new Error('At least one language must be specified. Use --languages en,ro or --languages ro.');
  }
  return languages;
}

export function resolveImageModel(options: Pick<GenerateCommandOptions, 'lora' | 'imageModel'>): {
  imageModel: 'base' | 'lora';
  loraModel?: string;
} {
  if (options.imageModel && !['base', 'lora'].includes(options.imageModel)) {
    throw new Error(`Invalid image model: ${options.imageModel}. Must be 'base' or 'lora'.`);
  }

  const imageModel = (options.imageModel ??
    (options.lora ? 'lora' : 'base')) as 'base' | 'lora';

  if (imageModel === 'lora' && !options.lora) {
    throw new Error('Image model "lora" requires --lora <model>.');
  }

  return {
    imageModel,
    loraModel: imageModel === 'lora' ? options.lora : undefined
  };
}

export function validateLanguagesForAudioProvider(audioProvider: string, languages: string[]): void {
  if (audioProvider === 'f5-romanian') {
    const unsupported = languages.filter(language => language !== 'ro');
    if (unsupported.length > 0) {
      throw new Error(`F5 Romanian TTS only supports Romanian audio. Use --languages ro or keep Piper for: ${unsupported.join(', ')}`);
    }
  }
}


export function createGenerateCommand(): Command {
  const command = new Command('generate');

  command
    .description('Generate game content using AI providers')
    .requiredOption('-c, --category <type>', 'Content category (fruits, animals, etc.)')
    .option('-t, --theme <name>', 'Visual theme', 'nature')
    .option('-d, --difficulty <level>', 'Difficulty level', 'easy')
    .option('-q, --questions <count>', 'Number of questions', '5')
    .option('-l, --languages <langs>', 'Languages (comma-separated)', 'en,ro')
    .option('--image-model <mode>', 'Image model to use: base or lora')
    .option('--lora <model>', 'LoRA model to use')
    .option('-o, --output <path>', 'Output directory', './generated-games')
    .option('--no-validate', 'Skip validation')
    .action(async (options: GenerateCommandOptions) => {
      const spinner = ora('Initializing generators...').start();
      let factory: ProviderFactory | undefined;

      try {
        const imageSettings = resolveImageModel(options);
        const difficulty = resolveDifficulty(options.difficulty);
        const config = ProviderFactory.loadConfig();
        const languages = parseLanguages(options.languages);
        validateLanguagesForAudioProvider(config.providers.audio.provider, languages);
        factory = ProviderFactory.getInstance(config);
        await factory.initialize();

        const imageProvider = await factory.getImageProvider();
        const textProvider = await factory.getTextProvider();
        const audioProvider = await factory.getAudioProvider();

        // Create generators
        const promptBuilder = new PromptBuilder();
        const imageGen = new ImageContentGenerator(imageProvider, promptBuilder);
        const textGen = new TextContentGenerator(textProvider, promptBuilder);
        const audioGen = new AudioContentGenerator(audioProvider);
        const validator = new QualityValidator();

        const generator = new GameContentGenerator(
          imageGen,
          textGen,
          audioGen,
          validator
        );

        // Setup event listeners
        generator.on(GenerationEvents.GENERATION_STARTED, () => {
          spinner.text = 'Starting generation...';
        });

        generator.on(GenerationEvents.QUESTION_STARTED, (num) => {
          spinner.text = `Generating question ${num}...`;
        });

        generator.on(GenerationEvents.VALIDATION_STARTED, () => {
          spinner.text = 'Validating content...';
        });

        // Generate
        spinner.start();

        const gameId = `${options.category}-${Date.now()}`;
        const gamePackage = await generator.generate({
          category: options.category,
          theme: options.theme,
          difficulty,
          languages,
          questionCount: parseInt(options.questions),
          choicesPerQuestion: 3,
          loraModel: imageSettings.loraModel,
          validateBeforeCommit: options.validate,
          retryOnFailure: true,
          maxRetries: 2,
          outputDir: options.output,
          gameId
        });

        spinner.succeed('Generation completed!');

        console.log(`\n✅ Game generated: ${gameId}`);
        console.log(`   Questions: ${parseInt(options.questions)}`);
        console.log(`   Languages: ${languages.join(', ')}`);
        console.log(`   Image model: ${imageSettings.imageModel}`);
        if (imageSettings.loraModel) {
          console.log(`   LoRA: ${imageSettings.loraModel}`);
        }
        console.log(`   Quality score: ${gamePackage.validation.overallScore.toFixed(1)}/100`);
        console.log(`   Generation time: ${Math.round(gamePackage.generationTime / 1000)}s`);
        console.log(`   Output: ${options.output}/${gameId}`);

      } catch (error) {
        spinner.fail('Generation failed');
        console.error(error);
        process.exit(1);
      } finally {
        if (factory) {
          await factory.shutdown();
          ProviderFactory.reset();
        }
      }
    });

  return command;
}
