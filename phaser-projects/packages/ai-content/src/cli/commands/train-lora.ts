import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { LoRATrainer, TRAINER_EVENTS, applyPreset, listPresets, type LoRATrainingConfig } from '../../training/index';
import inquirer from 'inquirer';
import { existsSync } from 'fs';
import { join } from 'path';

interface TrainLoraOptions {
  name: string;
  dataset: string;
  preset?: string;
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
  loraRank?: number;
  loraAlpha?: number;
  resolution?: number;
  outputDir?: string;
  comfyuiUrl?: string;
  comfyuiWs?: string;
  skipConfirmation?: boolean;
  verbose?: boolean;
}

/**
 * Train a custom LoRA model
 */
export async function trainLoraCommand(options: TrainLoraOptions): Promise<void> {
  const spinner = ora('Initializing LoRA training...').start();

  try {
    // Validate dataset exists
    if (!existsSync(options.dataset)) {
      spinner.fail(chalk.red(`Dataset not found: ${options.dataset}`));
      process.exit(1);
    }

    // Get preset or use default
    const presetId = options.preset || 'children-book';
    const presets = listPresets();
    const preset = presets.find((p) => p.id === presetId);

    if (!preset) {
      spinner.fail(chalk.red(`Unknown preset: ${presetId}`));
      console.log(chalk.blue('\nAvailable presets:'));
      presets.forEach((p) => {
        console.log(`  ${chalk.cyan(p.id.padEnd(20))} - ${p.description}`);
      });
      process.exit(1);
    }

    spinner.info(chalk.blue(`Using preset: ${chalk.cyan(preset.name)}`));

    // Build configuration
    const configOverrides: Partial<LoRATrainingConfig> = {
      name: options.name,
      datasetPath: options.dataset,
      outputDir: options.outputDir || join(process.cwd(), 'loras'),
    };

    // Apply optional overrides
    if (options.epochs) configOverrides.epochs = options.epochs;
    if (options.batchSize) configOverrides.batchSize = options.batchSize;
    if (options.learningRate) configOverrides.learningRate = options.learningRate;
    if (options.loraRank) configOverrides.loraRank = options.loraRank;
    if (options.loraAlpha) configOverrides.loraAlpha = options.loraAlpha;
    if (options.resolution) configOverrides.resolution = options.resolution as 512 | 1024;

    const config = applyPreset(presetId, configOverrides);

    // Show configuration
    spinner.stop();
    console.log(chalk.bold('\n📋 Training Configuration:\n'));
    console.log(`  ${chalk.gray('Name:')}           ${chalk.white(config.name)}`);
    console.log(`  ${chalk.gray('Dataset:')}        ${chalk.white(config.datasetPath)}`);
    console.log(`  ${chalk.gray('Base Model:')}     ${chalk.white(config.baseModel)}`);
    console.log(`  ${chalk.gray('Resolution:')}     ${chalk.white(config.resolution)}`);
    console.log(`  ${chalk.gray('Epochs:')}         ${chalk.white(config.epochs)}`);
    console.log(`  ${chalk.gray('Batch Size:')}     ${chalk.white(config.batchSize)}`);
    console.log(`  ${chalk.gray('Learning Rate:')}  ${chalk.white(config.learningRate)}`);
    console.log(`  ${chalk.gray('LoRA Rank:')}      ${chalk.white(config.loraRank)}`);
    console.log(`  ${chalk.gray('LoRA Alpha:')}     ${chalk.white(config.loraAlpha)}`);
    console.log();

    if (preset.expectedTrainingTime) {
      console.log(chalk.dim(`  ⏱️  Expected time: ${preset.expectedTrainingTime}`));
    }
    if (preset.expectedGPUMemory) {
      console.log(chalk.dim(`  💾 GPU memory: ${preset.expectedGPUMemory}`));
    }
    if (preset.expectedModelSize) {
      console.log(chalk.dim(`  📦 Model size: ${preset.expectedModelSize}`));
    }
    console.log();

    // Confirm before starting
    if (!options.skipConfirmation) {
      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Start training?',
          default: true,
        },
      ]);

      if (!confirmed) {
        console.log(chalk.yellow('Training cancelled.'));
        process.exit(0);
      }
    }

    // Create trainer
    spinner.start('Connecting to ComfyUI...');

    const trainer = new LoRATrainer({
      comfyuiUrl: options.comfyuiUrl || 'http://localhost:8188',
      comfyuiWsUrl: options.comfyuiWs || 'ws://localhost:8188/ws',
    });

    await trainer.init();

    spinner.succeed(chalk.green('Connected to ComfyUI'));

    // Setup progress tracking
    let progressSpinner: Ora | null = null;
    let lastEpoch = 0;
    let lastProgress = 0;

    trainer.on(TRAINER_EVENTS.JOB_PREPARING, () => {
      progressSpinner = ora('Preparing dataset...').start();
    });

    trainer.on(TRAINER_EVENTS.JOB_STARTED, (job) => {
      if (progressSpinner) {
        progressSpinner.succeed(chalk.green('Dataset prepared'));
      }
      console.log(chalk.bold('\n🚀 Training started!\n'));
      progressSpinner = ora('Training...').start();
    });

    trainer.on(TRAINER_EVENTS.PROGRESS_UPDATE, (job, progress) => {
      if (!progressSpinner) return;

      const epoch = job.progress.currentEpoch;
      const totalEpochs = job.progress.totalEpochs;
      const percentage = job.progress.percentage;
      const loss = job.progress.currentLoss;
      const lr = job.progress.learningRate;
      const stepsPerSec = job.progress.stepsPerSecond;

      // Only update on significant progress change
      if (Math.abs(percentage - lastProgress) < 1 && epoch === lastEpoch) {
        return;
      }

      lastProgress = percentage;
      lastEpoch = epoch;

      // Build progress bar
      const barLength = 30;
      const filled = Math.round((percentage / 100) * barLength);
      const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);

      // Calculate ETA
      let etaText = '';
      if (job.estimatedEndTime) {
        const eta = Math.max(0, job.estimatedEndTime.getTime() - Date.now());
        const etaMinutes = Math.ceil(eta / 1000 / 60);
        const etaHours = Math.floor(etaMinutes / 60);
        const etaMins = etaMinutes % 60;

        if (etaHours > 0) {
          etaText = ` | ETA: ${etaHours}h ${etaMins}m`;
        } else {
          etaText = ` | ETA: ${etaMins}m`;
        }
      }

      progressSpinner.text = [
        chalk.cyan(`Epoch ${epoch}/${totalEpochs}`),
        chalk.white(`[${bar}]`),
        chalk.yellow(`${percentage.toFixed(1)}%`),
        chalk.gray(`| Loss: ${loss.toFixed(4)}`),
        chalk.gray(`| LR: ${lr.toExponential(2)}`),
        chalk.gray(`| Speed: ${stepsPerSec.toFixed(2)} steps/s`),
        chalk.gray(etaText),
      ].join(' ');
    });

    trainer.on(TRAINER_EVENTS.CHECKPOINT_SAVED, (data) => {
      if (progressSpinner) {
        const currentText = progressSpinner.text;
        progressSpinner.info(chalk.blue(`💾 Checkpoint saved: epoch ${data.epoch}`));
        progressSpinner = ora(currentText).start();
      }
    });

    trainer.on(TRAINER_EVENTS.VALIDATION_COMPLETED, (data) => {
      if (progressSpinner) {
        const currentText = progressSpinner.text;
        progressSpinner.info(chalk.magenta(`✓ Validation completed: epoch ${data.epoch}`));
        progressSpinner = ora(currentText).start();
      }
    });

    trainer.on(TRAINER_EVENTS.JOB_COMPLETED, (job) => {
      if (progressSpinner) {
        progressSpinner.succeed(chalk.green('Training completed!'));
      }

      const result = job.result!;
      const durationMinutes = Math.round(result.trainingDuration / 60);
      const durationHours = Math.floor(durationMinutes / 60);
      const durationMins = durationMinutes % 60;

      console.log(chalk.bold('\n✨ Training Results:\n'));
      console.log(`  ${chalk.gray('Model:')}          ${chalk.green(result.loraPath)}`);
      console.log(`  ${chalk.gray('Size:')}           ${chalk.white((result.modelSize / 1024 / 1024).toFixed(2))} MB`);
      console.log(`  ${chalk.gray('Final Loss:')}     ${chalk.white(result.finalLoss.toFixed(4))}`);
      console.log(`  ${chalk.gray('Avg Loss:')}       ${chalk.white(result.avgLoss.toFixed(4))}`);
      console.log(`  ${chalk.gray('Duration:')}       ${chalk.white(durationHours > 0 ? `${durationHours}h ${durationMins}m` : `${durationMins}m`)}`);
      console.log(`  ${chalk.gray('Avg Speed:')}      ${chalk.white(result.avgStepsPerSecond.toFixed(2))} steps/sec`);

      if (result.checkpoints.length > 0) {
        console.log(`  ${chalk.gray('Checkpoints:')}    ${chalk.white(result.checkpoints.length)}`);
      }

      console.log();
      console.log(chalk.green('✓ Model saved and ready to use!'));
      console.log();
    });

    trainer.on(TRAINER_EVENTS.JOB_FAILED, (job, error) => {
      if (progressSpinner) {
        progressSpinner.fail(chalk.red('Training failed'));
      }

      console.log(chalk.bold.red('\n❌ Training Failed:\n'));
      console.log(`  ${chalk.gray('Error:')}     ${chalk.red(error.message)}`);
      console.log(`  ${chalk.gray('Code:')}      ${chalk.red(error.code)}`);

      if (error.epoch !== undefined) {
        console.log(`  ${chalk.gray('Epoch:')}     ${chalk.white(error.epoch)}`);
      }

      if (error.suggestedAction) {
        console.log();
        console.log(chalk.yellow(`💡 Suggestion: ${error.suggestedAction}`));
      }

      console.log();
      process.exit(1);
    });

    trainer.on(TRAINER_EVENTS.JOB_CANCELLED, () => {
      if (progressSpinner) {
        progressSpinner.warn(chalk.yellow('Training cancelled'));
      }
      console.log();
      process.exit(0);
    });

    // Handle Ctrl+C
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n\nCancelling training...'));
      try {
        await trainer.cancel();
      } catch (error) {
        console.error(chalk.red('Error during cancellation:'), error);
        process.exit(1);
      }
    });

    // Start training
    await trainer.train(config);

    // Keep process alive until completion
    await new Promise(() => {}); // Infinite promise, events will handle exit
  } catch (error) {
    spinner.fail(chalk.red('Training initialization failed'));
    console.error(chalk.red('\nError:'), error instanceof Error ? error.message : error);

    if (options.verbose && error instanceof Error && error.stack) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(chalk.gray(error.stack));
    }

    process.exit(1);
  }
}
