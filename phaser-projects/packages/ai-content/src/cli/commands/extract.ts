import chalk from 'chalk';
import ora from 'ora';
import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import {
  DataExtractor,
  type DataExtractorConfig
} from '../../training/index';

interface ExtractOptions {
  gameId?: string;
  output: string;
  languages: string;
  assets: boolean;
  verbose?: boolean;
}

export function resolveMultipleChoiceGamesPath(commandsDir = __dirname): string {
  return join(commandsDir, '../../../../..', 'activities');
}

export async function extractCommand(options: ExtractOptions): Promise<void> {
  const spinner = ora('Initializing data extraction...').start();

  try {
    // Parse languages
    const languages = options.languages.split(',').map(lang => lang.trim());

    const gamesPath = resolveMultipleChoiceGamesPath();

    if (options.verbose) {
      spinner.info(chalk.blue(`Games path: ${gamesPath}`));
      spinner.info(chalk.blue(`Languages: ${languages.join(', ')}`));
      spinner.info(chalk.blue(`Include assets: ${options.assets}`));
      if (options.gameId) {
        spinner.info(chalk.blue(`Target game: ${options.gameId}`));
      }
      spinner.start('Extracting data...');
    }

    // Create extractor config
    const config: DataExtractorConfig = {
      gamesPath,
      outputPath: options.output,
      languages,
      includeAssets: options.assets
    };

    // Create extractor
    const extractor = new DataExtractor(config);

    // Extract game(s)
    spinner.text = options.gameId
      ? `Extracting game: ${options.gameId}...`
      : 'Extracting all games...';

    const results = options.gameId
      ? await extractor.extractGame(options.gameId)
      : await extractor.extractAll();

    // Create output directory
    await mkdir(options.output, { recursive: true });

    // Save results
    const outputFile = join(options.output, 'extracted-games.json');
    await writeFile(outputFile, JSON.stringify(results, null, 2));

    // Save individual game files
    const gamesDir = join(options.output, 'games');
    await mkdir(gamesDir, { recursive: true });

    if (options.gameId) {
      // Single game
      const gameFile = join(gamesDir, `${options.gameId}.json`);
      await writeFile(gameFile, JSON.stringify(results, null, 2));
    } else {
      // All games - results is an array
      const gamesArray = Array.isArray(results) ? results : [results];
      for (const game of gamesArray) {
        if (game.gameId) {
          const gameFile = join(gamesDir, `${game.gameId}.json`);
          await writeFile(gameFile, JSON.stringify(game, null, 2));
        }
      }
    }

    // Calculate statistics
    const gamesArray = Array.isArray(results) ? results : [results];
    const totalGames = gamesArray.length;
    const totalQuestions = gamesArray.reduce((sum, game) =>
      sum + (game.questions?.length || 0), 0
    );
    const totalChoices = gamesArray.reduce((sum, game) => {
      const questions = game.questions || [];
      return sum + questions.reduce((qSum, q) =>
        qSum + (q.choices?.length || 0), 0
      );
    }, 0);

    // Collect unique categories
    const categories = new Set<string>();
    gamesArray.forEach(game => {
      game.questions?.forEach(q => {
        q.choices?.forEach(c => {
          if (c.category) categories.add(c.category);
        });
      });
    });

    spinner.succeed(chalk.green('Data extraction complete!'));

    // Display statistics
    console.log('\n' + chalk.bold('Extraction Statistics:'));
    console.log(chalk.cyan(`  📦 Games extracted: ${totalGames}`));
    console.log(chalk.cyan(`  ❓ Total questions: ${totalQuestions}`));
    console.log(chalk.cyan(`  🎯 Total choices: ${totalChoices}`));
    console.log(chalk.cyan(`  🏷️  Categories: ${categories.size} (${Array.from(categories).join(', ')})`));
    console.log(chalk.cyan(`  💾 Saved to: ${outputFile}`));
    console.log(chalk.cyan(`  📁 Individual games: ${gamesDir}`));

    if (options.verbose) {
      console.log('\n' + chalk.gray('Game Details:'));
      gamesArray.forEach(game => {
        const gameId = game.gameId || 'unknown';
        const qCount = game.questions?.length || 0;
        console.log(chalk.gray(`  - ${gameId}: ${qCount} questions`));
      });
    }

    console.log('\n' + chalk.green('✅ Extraction completed successfully!'));

  } catch (error) {
    spinner.fail(chalk.red('Extraction failed'));
    console.error(chalk.red('❌ Error:', error instanceof Error ? error.message : String(error)));
    if (options.verbose && error instanceof Error && error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}
