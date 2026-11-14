/**
 * CLI command for batch game generation.
 *
 * @module cli/commands/batch
 */

import { Command } from 'commander';
import { v4 as uuid } from 'uuid';
import ora from 'ora';
import chalk from 'chalk';
import { BatchProcessor, BatchEvents, StatusServer } from '../../batch';
import { GameContentGenerator } from '../../generators/GameContentGenerator';
import { ImageContentGenerator } from '../../generators/ImageContentGenerator';
import { TextContentGenerator } from '../../generators/TextContentGenerator';
import { AudioContentGenerator } from '../../generators/AudioContentGenerator';
import { QualityValidator } from '../../training/QualityValidator';
import { ProviderFactory } from '../../providers/factory/ProviderFactory';

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Create batch command
 */
export function createBatchCommand(): Command {
  const command = new Command('batch');
  command.description('Batch game generation operations');

  // Subcommand: batch generate
  command
    .command('generate')
    .description('Generate multiple games in batch')
    .requiredOption('-c, --category <type>', 'Game category (fruits, animals, colors, etc.)')
    .requiredOption('-n, --count <number>', 'Number of games to generate', parseInt)
    .option('-t, --theme <name>', 'Visual theme', 'nature')
    .option('-d, --difficulty <level>', 'Difficulty level (easy, medium, hard)', 'easy')
    .option('-q, --questions <count>', 'Questions per game', parseInt, 5)
    .option('-l, --languages <langs>', 'Languages (comma-separated)', 'en,ro')
    .option('--lora <model>', 'LoRA model name or path')
    .option('-o, --output <path>', 'Output directory', './generated-games')
    .option('--start-index <number>', 'Starting game index', parseInt, 0)
    .option('--concurrency <number>', 'Concurrent jobs', parseInt, 3)
    .option('--no-validate', 'Skip validation')
    .option('--status-port <port>', 'Status server port', parseInt, 3001)
    .option('--batch-name <name>', 'Custom batch name')
    .action(async (options) => {
      const spinner = ora('Initializing batch generation...').start();

      try {
        // Initialize providers
        const factory = new ProviderFactory();
        const imageProvider = factory.createImageProvider({ type: 'comfyui' });
        const textProvider = factory.createTextProvider({ type: 'ollama' });
        const audioProvider = factory.createAudioProvider({ type: 'piper' });

        // Initialize generators
        const imageGenerator = new ImageContentGenerator(imageProvider);
        const textGenerator = new TextContentGenerator(textProvider);
        const audioGenerator = new AudioContentGenerator(audioProvider);
        const validator = new QualityValidator();

        const gameGenerator = new GameContentGenerator(
          imageGenerator,
          textGenerator,
          audioGenerator,
          validator
        );

        // Initialize batch processor
        const batchProcessor = new BatchProcessor(gameGenerator, {
          concurrency: options.concurrency
        });

        // Initialize status server
        const statusServer = new StatusServer({ port: options.statusPort });
        await statusServer.start();

        spinner.succeed('Batch processor initialized');

        // Setup event listeners
        batchProcessor.on(BatchEvents.BATCH_STARTED, (state) => {
          console.log(chalk.blue('\n🚀 Batch Started'));
          console.log(chalk.gray(`   Batch ID: ${state.batchId}`));
          console.log(chalk.gray(`   Name: ${state.name}`));
          console.log(chalk.gray(`   Total Jobs: ${state.progress.total}`));
          statusServer.broadcastBatchStarted(state.batchId, state.name);
        });

        batchProcessor.on(BatchEvents.JOB_STARTED, (job) => {
          spinner.text = `Generating ${job.gameId}...`;
        });

        batchProcessor.on(BatchEvents.JOB_COMPLETED, (job) => {
          console.log(chalk.green(`✓ ${job.gameId}`));
          statusServer.broadcastJobCompleted(job.batchId, job.id, job.gameId);
        });

        batchProcessor.on(BatchEvents.JOB_FAILED, ({ job, error }) => {
          console.log(chalk.red(`✗ ${job.gameId}: ${error.message}`));
          statusServer.broadcastJobFailed(job.batchId, job.id, error.message);
        });

        batchProcessor.on(BatchEvents.PROGRESS_UPDATE, (progress) => {
          const percentage = progress.percentage;
          const completed = progress.completed;
          const total = progress.total;
          const failed = progress.failed;
          const eta = formatDuration(progress.estimatedTimeRemaining);

          spinner.text = `Progress: ${percentage}% (${completed}/${total}) | Failed: ${failed} | ETA: ${eta}`;

          statusServer.broadcastProgress('current', progress);
        });

        // Create batch request
        const batchId = uuid();
        const batchName = options.batchName || `${options.category}-batch-${Date.now()}`;
        const languages = options.languages.split(',').map((l: string) => l.trim());

        const request = {
          batchId,
          name: batchName,
          template: 'multiple-choice',
          category: options.category,
          count: options.count,
          startIndex: options.startIndex,
          options: {
            theme: options.theme,
            difficulty: options.difficulty,
            languages,
            questionCount: options.questions,
            loraModel: options.lora,
            validate: options.validate,
            remediate: true,
            outputDir: options.output
          }
        };

        // Process batch
        spinner.start('Processing batch...');
        const result = await batchProcessor.processBatch(request);

        spinner.succeed(chalk.green('Batch completed!'));

        // Display statistics
        console.log(chalk.blue('\n📊 Batch Statistics:'));
        console.log(chalk.gray(`   Total Jobs:     ${result.metrics.totalJobs}`));
        console.log(chalk.green(`   Successful:     ${result.metrics.successfulJobs}`));
        console.log(chalk.red(`   Failed:         ${result.metrics.failedJobs}`));
        console.log(chalk.yellow(`   Retried:        ${result.metrics.retriedJobs}`));
        console.log(chalk.gray(`   Success Rate:   ${(result.metrics.successRate * 100).toFixed(1)}%`));
        console.log(chalk.gray(`   Total Duration: ${formatDuration(result.metrics.totalDuration)}`));
        console.log(chalk.gray(`   Avg Duration:   ${formatDuration(result.metrics.averageDuration)}`));
        console.log(chalk.gray(`   Throughput:     ${result.metrics.throughput.toFixed(1)} games/hour`));

        // Broadcast completion
        statusServer.broadcastBatchCompleted(batchId, result.metrics);

        // Stop status server
        await statusServer.stop();

        // Shutdown batch processor
        batchProcessor.shutdown();

      } catch (error: any) {
        spinner.fail(chalk.red('Batch generation failed'));
        console.error(chalk.red(error.message));
        if (error.stack) {
          console.error(chalk.gray(error.stack));
        }
        process.exit(1);
      }
    });

  // Subcommand: batch resume
  command
    .command('resume')
    .description('Resume a paused or failed batch')
    .argument('<batch-id>', 'Batch ID to resume')
    .option('--status-port <port>', 'Status server port', parseInt, 3001)
    .action(async (batchId, options) => {
      const spinner = ora('Resuming batch...').start();

      try {
        // Initialize components (same as generate)
        const factory = new ProviderFactory();
        const imageProvider = factory.createImageProvider({ type: 'comfyui' });
        const textProvider = factory.createTextProvider({ type: 'ollama' });
        const audioProvider = factory.createAudioProvider({ type: 'piper' });

        const imageGenerator = new ImageContentGenerator(imageProvider);
        const textGenerator = new TextContentGenerator(textProvider);
        const audioGenerator = new AudioContentGenerator(audioProvider);
        const validator = new QualityValidator();

        const gameGenerator = new GameContentGenerator(
          imageGenerator,
          textGenerator,
          audioGenerator,
          validator
        );

        const batchProcessor = new BatchProcessor(gameGenerator);

        // Initialize status server
        const statusServer = new StatusServer({ port: options.statusPort });
        await statusServer.start();

        // Setup event listeners (same as generate)
        batchProcessor.on(BatchEvents.PROGRESS_UPDATE, (progress) => {
          spinner.text = `Progress: ${progress.percentage}% (${progress.completed}/${progress.total})`;
          statusServer.broadcastProgress(batchId, progress);
        });

        batchProcessor.on(BatchEvents.JOB_COMPLETED, (job) => {
          console.log(chalk.green(`✓ ${job.gameId}`));
        });

        batchProcessor.on(BatchEvents.JOB_FAILED, ({ job, error }) => {
          console.log(chalk.red(`✗ ${job.gameId}: ${error.message}`));
        });

        // Resume batch
        const result = await batchProcessor.resumeBatch(batchId);

        spinner.succeed('Batch resumed and completed!');

        // Display statistics
        console.log(chalk.blue('\n📊 Results:'));
        console.log(chalk.gray(`   Successful: ${result.metrics.successfulJobs}`));
        console.log(chalk.gray(`   Failed:     ${result.metrics.failedJobs}`));

        await statusServer.stop();
        batchProcessor.shutdown();

      } catch (error: any) {
        spinner.fail('Resume failed');
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  // Subcommand: batch status
  command
    .command('status')
    .description('Check batch status')
    .argument('<batch-id>', 'Batch ID')
    .action(async (batchId) => {
      const spinner = ora('Loading batch status...').start();

      try {
        const factory = new ProviderFactory();
        const imageProvider = factory.createImageProvider({ type: 'comfyui' });
        const textProvider = factory.createTextProvider({ type: 'ollama' });
        const audioProvider = factory.createAudioProvider({ type: 'piper' });

        const imageGenerator = new ImageContentGenerator(imageProvider);
        const textGenerator = new TextContentGenerator(textProvider);
        const audioGenerator = new AudioContentGenerator(audioProvider);
        const validator = new QualityValidator();

        const gameGenerator = new GameContentGenerator(
          imageGenerator,
          textGenerator,
          audioGenerator,
          validator
        );

        const batchProcessor = new BatchProcessor(gameGenerator);

        const state = await batchProcessor.getBatchState(batchId);

        if (!state) {
          spinner.fail('Batch not found');
          process.exit(1);
        }

        spinner.succeed('Batch loaded');

        // Display status
        console.log(chalk.blue('\n📋 Batch Status'));
        console.log(chalk.gray(`   ID:         ${state.batchId}`));
        console.log(chalk.gray(`   Name:       ${state.name}`));
        console.log(chalk.gray(`   Status:     ${state.status}`));
        console.log(chalk.gray(`   Created:    ${state.createdAt.toLocaleString()}`));

        if (state.startedAt) {
          console.log(chalk.gray(`   Started:    ${state.startedAt.toLocaleString()}`));
        }

        if (state.completedAt) {
          console.log(chalk.gray(`   Completed:  ${state.completedAt.toLocaleString()}`));
        }

        console.log(chalk.blue('\n📊 Progress'));
        console.log(chalk.gray(`   Total:      ${state.progress.total}`));
        console.log(chalk.green(`   Completed:  ${state.progress.completed}`));
        console.log(chalk.red(`   Failed:     ${state.progress.failed}`));
        console.log(chalk.yellow(`   Pending:    ${state.progress.pending}`));
        console.log(chalk.gray(`   Progress:   ${state.progress.percentage}%`));

        batchProcessor.shutdown();

      } catch (error: any) {
        spinner.fail('Failed to load status');
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  // Subcommand: batch cancel
  command
    .command('cancel')
    .description('Cancel a running batch')
    .argument('<batch-id>', 'Batch ID')
    .action(async (batchId) => {
      const spinner = ora('Cancelling batch...').start();

      try {
        const factory = new ProviderFactory();
        const imageProvider = factory.createImageProvider({ type: 'comfyui' });
        const textProvider = factory.createTextProvider({ type: 'ollama' });
        const audioProvider = factory.createAudioProvider({ type: 'piper' });

        const imageGenerator = new ImageContentGenerator(imageProvider);
        const textGenerator = new TextContentGenerator(textProvider);
        const audioGenerator = new AudioContentGenerator(audioProvider);
        const validator = new QualityValidator();

        const gameGenerator = new GameContentGenerator(
          imageGenerator,
          textGenerator,
          audioGenerator,
          validator
        );

        const batchProcessor = new BatchProcessor(gameGenerator);

        await batchProcessor.cancelBatch(batchId);

        spinner.succeed('Batch cancelled');

        batchProcessor.shutdown();

      } catch (error: any) {
        spinner.fail('Cancel failed');
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  // Subcommand: batch list
  command
    .command('list')
    .description('List all batches')
    .action(async () => {
      const spinner = ora('Loading batches...').start();

      try {
        const factory = new ProviderFactory();
        const imageProvider = factory.createImageProvider({ type: 'comfyui' });
        const textProvider = factory.createTextProvider({ type: 'ollama' });
        const audioProvider = factory.createAudioProvider({ type: 'piper' });

        const imageGenerator = new ImageContentGenerator(imageProvider);
        const textGenerator = new TextContentGenerator(textProvider);
        const audioGenerator = new AudioContentGenerator(audioProvider);
        const validator = new QualityValidator();

        const gameGenerator = new GameContentGenerator(
          imageGenerator,
          textGenerator,
          audioGenerator,
          validator
        );

        const batchProcessor = new BatchProcessor(gameGenerator);

        const batches = await batchProcessor.listBatches();

        spinner.succeed(`Found ${batches.length} batches`);

        if (batches.length === 0) {
          console.log(chalk.gray('\nNo batches found'));
          return;
        }

        console.log(chalk.blue('\n📋 Batches:'));
        for (const batchId of batches) {
          console.log(chalk.gray(`   ${batchId}`));
        }

        batchProcessor.shutdown();

      } catch (error: any) {
        spinner.fail('Failed to list batches');
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  return command;
}
