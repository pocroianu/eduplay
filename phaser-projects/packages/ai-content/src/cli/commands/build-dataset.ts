import chalk from 'chalk';
import ora from 'ora';
import { join } from 'path';
import { mkdir, writeFile, readdir, readFile } from 'fs/promises';
import type { ExtractedGameData } from '../../training/index';

interface BuildDatasetOptions {
  input: string;
  output: string;
  type: 'image' | 'text' | 'audio';
  split: string;
  shuffle: boolean;
  seed?: number;
  verbose?: boolean;
}

interface DatasetItem {
  id: string;
  text?: string;
  prompt?: string;
  imagePath?: string;
  audioPath?: string;
  category: string;
  metadata: Record<string, any>;
}

export async function buildDatasetCommand(options: BuildDatasetOptions): Promise<void> {
  const spinner = ora('Initializing dataset builder...').start();

  try {
    // Validate type
    if (!['image', 'text', 'audio'].includes(options.type)) {
      throw new Error(`Invalid dataset type: ${options.type}. Must be 'image', 'text', or 'audio'`);
    }

    // Parse split ratio
    const splitParts = options.split.split(':').map(Number);
    if (splitParts.length !== 3 || splitParts.some(isNaN)) {
      throw new Error(`Invalid split ratio: ${options.split}. Must be in format 'train:val:test' (e.g., '70:15:15')`);
    }

    const [trainRatio, valRatio, testRatio] = splitParts;
    const total = trainRatio + valRatio + testRatio;
    if (total !== 100) {
      throw new Error(`Split ratios must sum to 100. Got: ${total}`);
    }

    if (options.verbose) {
      spinner.info(chalk.blue(`Input path: ${options.input}`));
      spinner.info(chalk.blue(`Output path: ${options.output}`));
      spinner.info(chalk.blue(`Dataset type: ${options.type}`));
      spinner.info(chalk.blue(`Split ratio: ${trainRatio}% / ${valRatio}% / ${testRatio}%`));
      spinner.info(chalk.blue(`Shuffle: ${options.shuffle}`));
      if (options.seed !== undefined) {
        spinner.info(chalk.blue(`Random seed: ${options.seed}`));
      }
      spinner.start('Building dataset...');
    }

    // Load extracted data
    spinner.text = 'Loading extracted data...';
    const gamesDir = join(options.input, 'games');
    const gameFiles = await readdir(gamesDir);
    const games: ExtractedGameData[] = [];

    for (const file of gameFiles) {
      if (file.endsWith('.json')) {
        const content = await readFile(join(gamesDir, file), 'utf-8');
        games.push(JSON.parse(content));
      }
    }

    if (games.length === 0) {
      throw new Error('No game data found. Run "extract" command first.');
    }

    // Convert games to dataset items
    spinner.text = 'Converting to dataset items...';
    const items: DatasetItem[] = [];
    const categories = new Set<string>();

    for (const game of games) {
      for (const question of game.questions) {
        categories.add(question.category);

        // Create items based on type
        if (options.type === 'text') {
          // For text datasets, use question texts
          for (const [lang, text] of Object.entries(question.text)) {
            items.push({
              id: `${game.gameId}-${question.id}-${lang}`,
              text,
              category: question.category,
              metadata: {
                gameId: game.gameId,
                questionId: question.id,
                language: lang,
                difficulty: question.difficulty
              }
            });
          }
        } else if (options.type === 'image') {
          // For image datasets, use choice assets
          for (const choice of question.choices) {
            if (choice.assetPath) {
              items.push({
                id: `${game.gameId}-${question.id}-${choice.id}`,
                imagePath: choice.assetPath,
                prompt: Object.values(question.text)[0] || '',
                category: question.category,
                metadata: {
                  gameId: game.gameId,
                  questionId: question.id,
                  choiceId: choice.id,
                  isCorrect: choice.id === question.correctChoice
                }
              });
            }
          }
        } else if (options.type === 'audio') {
          // For audio datasets, use choice assets
          for (const choice of question.choices) {
            if (choice.assetPath) {
              items.push({
                id: `${game.gameId}-${question.id}-${choice.id}`,
                audioPath: choice.assetPath,
                text: Object.values(question.text)[0] || '',
                category: question.category,
                metadata: {
                  gameId: game.gameId,
                  questionId: question.id,
                  choiceId: choice.id
                }
              });
            }
          }
        }
      }
    }

    if (items.length === 0) {
      throw new Error(`No ${options.type} items found in extracted data`);
    }

    // Shuffle if enabled
    if (options.shuffle) {
      spinner.text = 'Shuffling items...';
      shuffleArray(items, options.seed);
    }

    // Split data
    spinner.text = 'Splitting into train/val/test sets...';
    const trainCount = Math.floor(items.length * (trainRatio / 100));
    const valCount = Math.floor(items.length * (valRatio / 100));

    const trainData = items.slice(0, trainCount);
    const valData = items.slice(trainCount, trainCount + valCount);
    const testData = items.slice(trainCount + valCount);

    // Create output directory
    const outputDir = join(options.output, options.type);
    await mkdir(outputDir, { recursive: true });

    // Save JSONL files
    spinner.text = 'Saving dataset files...';

    const trainFile = join(outputDir, 'train.jsonl');
    const valFile = join(outputDir, 'val.jsonl');
    const testFile = join(outputDir, 'test.jsonl');

    await writeFile(trainFile, trainData.map(item => JSON.stringify(item)).join('\n'));
    await writeFile(valFile, valData.map(item => JSON.stringify(item)).join('\n'));
    await writeFile(testFile, testData.map(item => JSON.stringify(item)).join('\n'));

    // Save manifest
    const manifest = {
      type: options.type,
      created: new Date().toISOString(),
      splitRatio: {
        train: trainRatio / 100,
        val: valRatio / 100,
        test: testRatio / 100
      },
      shuffle: options.shuffle,
      seed: options.seed,
      statistics: {
        total: items.length,
        train: trainData.length,
        val: valData.length,
        test: testData.length,
        categories: Array.from(categories)
      },
      files: {
        train: trainFile,
        val: valFile,
        test: testFile
      }
    };

    const manifestFile = join(outputDir, 'manifest.json');
    await writeFile(manifestFile, JSON.stringify(manifest, null, 2));

    spinner.succeed(chalk.green('Dataset build complete!'));

    // Display statistics
    console.log('\n' + chalk.bold('Dataset Statistics:'));
    console.log(chalk.cyan(`  📊 Dataset type: ${options.type}`));
    console.log(chalk.cyan(`  📦 Total items: ${manifest.statistics.total}`));
    console.log(chalk.cyan(`  🎓 Training: ${manifest.statistics.train} (${trainRatio}%)`));
    console.log(chalk.cyan(`  ✅ Validation: ${manifest.statistics.val} (${valRatio}%)`));
    console.log(chalk.cyan(`  🧪 Testing: ${manifest.statistics.test} (${testRatio}%)`));
    console.log(chalk.cyan(`  🏷️  Categories: ${categories.size} (${Array.from(categories).join(', ')})`));

    console.log('\n' + chalk.bold('Output Files:'));
    console.log(chalk.cyan(`  📁 Train: ${trainFile}`));
    console.log(chalk.cyan(`  📁 Val: ${valFile}`));
    console.log(chalk.cyan(`  📁 Test: ${testFile}`));
    console.log(chalk.cyan(`  📋 Manifest: ${manifestFile}`));

    if (options.verbose) {
      console.log('\n' + chalk.gray('Dataset Details:'));
      console.log(chalk.gray(`  - Shuffle applied: ${options.shuffle}`));
      if (options.seed !== undefined) {
        console.log(chalk.gray(`  - Random seed: ${options.seed}`));
      }
      console.log(chalk.gray(`  - Output directory: ${outputDir}`));
    }

    console.log('\n' + chalk.green('✅ Dataset build completed successfully!'));

  } catch (error) {
    spinner.fail(chalk.red('Dataset build failed'));
    console.error(chalk.red('❌ Error:', error instanceof Error ? error.message : String(error)));
    if (options.verbose && error instanceof Error && error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

/**
 * Shuffle array in place using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[], seed?: number): void {
  // Simple seeded random number generator
  let currentSeed = seed;
  let random = currentSeed !== undefined
    ? () => {
        currentSeed = currentSeed!;
        const x = Math.sin(currentSeed++) * 10000;
        return x - Math.floor(x);
      }
    : Math.random;

  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
