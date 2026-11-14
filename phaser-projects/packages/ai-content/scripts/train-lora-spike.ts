import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { mkdir, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { applyPreset, listPresets } from '../src/training/TrainingConfig';
import type { LoRATrainingConfig, TrainingError, TrainingPreflightResult, TrainingResult } from '../src/training/types';
import { LoRATrainer, TRAINER_EVENTS } from '../src/training/LoRATrainer';

interface DatasetEntry {
  id: string;
  imagePath: string;
  prompt: string;
}

type Spinner = ReturnType<typeof ora>;

let activeSpinner: Spinner | null = null;

async function main(): Promise<void> {
  const program = new Command();
  program
    .option('--dataset <path>', 'Path to the image dataset JSONL file', './training-data/datasets/image/train.jsonl')
    .option('--name <name>', 'Training job name', 'animals-smoke')
    .option('--preset <preset>', 'Training preset', 'children-book')
    .option('--epochs <count>', 'Epoch count for the smoke run', '5')
    .option('--batch-size <count>', 'Batch size for the smoke run', '1')
    .option('--resolution <pixels>', 'Training resolution (512 or 1024)', '512')
    .option('--learning-rate <value>', 'Learning rate override', '0.0001')
    .option('--container <name>', 'ComfyUI Docker container name', 'edu-comfyui')
    .option('--comfyui-url <url>', 'ComfyUI base URL', 'http://localhost:8188')
    .option('--comfyui-ws <url>', 'ComfyUI websocket URL', 'ws://localhost:8188/ws')
    .parse(process.argv);

  const options = program.opts<{
    dataset: string;
    name: string;
    preset: string;
    epochs: string;
    batchSize: string;
    resolution: string;
    learningRate: string;
    container: string;
    comfyuiUrl: string;
    comfyuiWs: string;
  }>();

  const datasetPath = resolve(process.cwd(), options.dataset);
  if (!existsSync(datasetPath)) {
    throw new Error(`Dataset file not found: ${datasetPath}`);
  }

  await mkdir(join(process.cwd(), '.runtime', 'comfyui', 'input', 'training'), { recursive: true });
  await mkdir(join(process.cwd(), 'loras'), { recursive: true });

  const preset = listPresets().find((item) => item.id === options.preset);
  if (!preset) {
    throw new Error(`Unknown preset: ${options.preset}`);
  }

  const datasetEntries = await readDatasetEntries(datasetPath);
  validateDatasetEntries(datasetEntries, datasetPath);

  const mountSpinner = ora('Checking Docker mount visibility...').start();
  activeSpinner = mountSpinner;
  ensureContainerPathsVisible(options.container);
  mountSpinner.succeed(chalk.green('Docker mount visibility looks good'));
  activeSpinner = null;

  const trainer = new LoRATrainer({
    comfyuiUrl: options.comfyuiUrl,
    comfyuiWsUrl: options.comfyuiWs,
  });

  await trainer.init();

  const config = applyPreset(options.preset, {
    name: options.name,
    datasetPath,
    outputDir: join(process.cwd(), 'loras'),
    epochs: Number.parseInt(options.epochs, 10),
    batchSize: Number.parseInt(options.batchSize, 10),
    resolution: Number.parseInt(options.resolution, 10) as 512 | 1024,
    learningRate: Number.parseFloat(options.learningRate),
    saveEveryNEpochs: Math.max(1, Number.parseInt(options.epochs, 10)),
    validationEpochs: [Number.parseInt(options.epochs, 10)],
    validationPrompts: datasetEntries.slice(0, 3).map((entry) => entry.prompt),
    description: 'experimental-local-lora-spike',
  }) as LoRATrainingConfig;

  const preflightSpinner = ora('Running training preflight...').start();
  activeSpinner = preflightSpinner;
  const preflight = await trainer.preflight(config);
  preflightSpinner.succeed(chalk.green('Preflight passed'));
  activeSpinner = null;

  printPreflightSummary(preflight, preset.name, datasetPath);

  let lastPrintedEpoch = -1;
  let lastPrintedPercentage = -10;

  trainer.on(TRAINER_EVENTS.JOB_PREPARING, () => {
    console.log(chalk.cyan('\nPreparing staged dataset for ComfyUI...'));
  });

  trainer.on(TRAINER_EVENTS.JOB_STARTED, (job) => {
    console.log(chalk.cyan(`\nTraining started: ${job.name}`));
  });

  trainer.on(TRAINER_EVENTS.PROGRESS_UPDATE, (job, progress) => {
    const mergedProgress = { ...job.progress, ...progress };
    const epoch = mergedProgress.currentEpoch;
    const percentage = mergedProgress.percentage;

    if (epoch !== lastPrintedEpoch || percentage - lastPrintedPercentage >= 5) {
      lastPrintedEpoch = epoch;
      lastPrintedPercentage = percentage;
      console.log(
        chalk.gray(
          `Progress: epoch ${epoch}/${job.progress.totalEpochs}, ${percentage.toFixed(1)}%`,
        ),
      );
    }
  });

  const completion = new Promise<TrainingResult>((resolvePromise, rejectPromise) => {
    trainer.once(TRAINER_EVENTS.JOB_COMPLETED, (job) => {
      resolvePromise(job.result as TrainingResult);
    });

    trainer.once(TRAINER_EVENTS.JOB_FAILED, (_job, error: TrainingError) => {
      rejectPromise(new Error(`${error.code}: ${error.message}`));
    });

    trainer.once(TRAINER_EVENTS.JOB_CANCELLED, () => {
      rejectPromise(new Error('Training was cancelled'));
    });
  });

  await trainer.train(config);
  const result = await completion;

  console.log(chalk.green.bold('\nTraining completed successfully.\n'));
  console.log(`Model:       ${chalk.white(result.loraPath)}`);
  console.log(`Model Size:  ${chalk.white(`${(result.modelSize / 1024 / 1024).toFixed(2)} MB`)}`);
  console.log(`Duration:    ${chalk.white(`${Math.round(result.trainingDuration / 60)} min`)}`);
  console.log(`Checkpoints: ${chalk.white(String(result.checkpoints.length))}`);
}

async function readDatasetEntries(datasetPath: string): Promise<DatasetEntry[]> {
  const content = await readFile(datasetPath, 'utf-8');
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as DatasetEntry);
}

function validateDatasetEntries(entries: DatasetEntry[], datasetPath: string): void {
  if (entries.length === 0) {
    throw new Error(`Dataset is empty: ${datasetPath}`);
  }

  for (const entry of entries) {
    if (!entry.id) {
      throw new Error(`Dataset entry missing id in ${datasetPath}`);
    }

    if (!entry.imagePath) {
      throw new Error(`Dataset entry missing imagePath: ${entry.id}`);
    }

    if (!entry.prompt?.trim()) {
      throw new Error(`Dataset entry missing prompt: ${entry.id}`);
    }

    const resolvedImagePath = resolve(process.cwd(), entry.imagePath);
    if (!existsSync(resolvedImagePath)) {
      throw new Error(`Image file not found: ${resolvedImagePath}`);
    }
  }
}

function ensureContainerPathsVisible(containerName: string): void {
  execFileSync('docker', [
    'exec',
    containerName,
    'sh',
    '-lc',
    'test -d /app/input/training && test -d /app/models/loras && test -d /app/training/sd-scripts'
  ], { stdio: 'ignore' });
}

function printPreflightSummary(
  preflight: TrainingPreflightResult,
  presetName: string,
  datasetPath: string,
): void {
  console.log(chalk.bold('\nExperimental LoRA Spike\n'));
  console.log(`Preset:               ${chalk.white(presetName)}`);
  console.log(`Dataset:              ${chalk.white(datasetPath)}`);
  console.log(`Dataset entries:      ${chalk.white(String(preflight.datasetEntries))}`);
  console.log(`Resolved images:      ${chalk.white(String(preflight.imageCount))}`);
  console.log(`Host training root:   ${chalk.white(preflight.hostTrainingRoot)}`);
  console.log(`Container root:       ${chalk.white(preflight.containerTrainingRoot)}`);
  console.log(`Required nodes:       ${chalk.white(preflight.requiredNodes.join(', '))}`);
}

main().catch((error) => {
  if (activeSpinner) {
    activeSpinner.fail('Training spike aborted');
    activeSpinner = null;
  }

  console.error(chalk.red.bold('\nLoRA spike run failed.\n'));
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
