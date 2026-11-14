import chalk from 'chalk';
import ora from 'ora';
import { ModelManager, type ModelFilter } from '../../training/index';
import inquirer from 'inquirer';
import { join } from 'path';

interface ModelsListOptions {
  baseModel?: string;
  tags?: string;
  pattern?: string;
  verbose?: boolean;
}

interface ModelsShowOptions {
  id?: string;
  name?: string;
  verbose?: boolean;
}

interface ModelsExportOptions {
  id?: string;
  name?: string;
  output: string;
  includeCheckpoints?: boolean;
  includeValidation?: boolean;
  includeMetadata?: boolean;
}

interface ModelsDeleteOptions {
  id?: string;
  name?: string;
  keepCheckpoints?: boolean;
  force?: boolean;
}

/**
 * List all LoRA models
 */
export async function modelsListCommand(options: ModelsListOptions): Promise<void> {
  const spinner = ora('Loading models...').start();

  try {
    const modelManager = new ModelManager();
    await modelManager.init();

    // Build filter
    const filter: ModelFilter = {};
    if (options.baseModel) {
      filter.baseModel = options.baseModel as any;
    }
    if (options.tags) {
      filter.tags = options.tags.split(',').map((t) => t.trim());
    }
    if (options.pattern) {
      filter.namePattern = options.pattern;
    }

    const models = await modelManager.listModels(filter);

    if (models.length === 0) {
      spinner.info(chalk.yellow('No models found'));
      return;
    }

    spinner.succeed(chalk.green(`Found ${models.length} model(s)`));

    console.log();

    // Display models
    models.forEach((model, index) => {
      const number = chalk.gray(`${index + 1}.`);
      const name = chalk.cyan(model.name);
      const baseModel = chalk.gray(`[${model.baseModel}]`);
      const size = chalk.white(`${(model.size / 1024 / 1024).toFixed(2)} MB`);
      const created = chalk.gray(model.createdAt.toLocaleDateString());

      console.log(`  ${number} ${name} ${baseModel} - ${size} (${created})`);

      if (options.verbose) {
        console.log(`     ${chalk.gray('ID:')} ${model.id}`);
        console.log(`     ${chalk.gray('Path:')} ${model.path}`);
        if (model.description) {
          console.log(`     ${chalk.gray('Description:')} ${model.description}`);
        }
        if (model.tags && model.tags.length > 0) {
          console.log(`     ${chalk.gray('Tags:')} ${model.tags.join(', ')}`);
        }
        if (model.generationCount) {
          console.log(`     ${chalk.gray('Generations:')} ${model.generationCount}`);
        }
        console.log();
      }
    });

    if (!options.verbose) {
      console.log();
      console.log(chalk.dim('  💡 Use --verbose for more details'));
    }

    // Show statistics
    const stats = await modelManager.getStats();
    console.log();
    console.log(chalk.bold('📊 Statistics:'));
    console.log(`  ${chalk.gray('Total models:')}  ${chalk.white(stats.totalModels)}`);
    console.log(`  ${chalk.gray('Total size:')}    ${chalk.white((stats.totalSize / 1024 / 1024 / 1024).toFixed(2))} GB`);
    console.log(`  ${chalk.gray('Average size:')}  ${chalk.white((stats.averageSize / 1024 / 1024).toFixed(2))} MB`);
    console.log();

    if (Object.keys(stats.baseModelCounts).length > 0) {
      console.log(chalk.bold('By Base Model:'));
      Object.entries(stats.baseModelCounts).forEach(([model, count]) => {
        console.log(`  ${chalk.gray(model.padEnd(15))} ${chalk.white(count)} model(s)`);
      });
      console.log();
    }
  } catch (error) {
    spinner.fail(chalk.red('Failed to list models'));
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Show details of a specific model
 */
export async function modelsShowCommand(options: ModelsShowOptions): Promise<void> {
  if (!options.id && !options.name) {
    console.error(chalk.red('Error: Either --id or --name must be specified'));
    process.exit(1);
  }

  const spinner = ora('Loading model...').start();

  try {
    const modelManager = new ModelManager();
    await modelManager.init();

    let model;
    if (options.id) {
      model = await modelManager.getModel(options.id);
    } else {
      model = await modelManager.getModelByName(options.name!);
    }

    if (!model) {
      spinner.fail(chalk.red('Model not found'));
      process.exit(1);
    }

    spinner.succeed(chalk.green('Model loaded'));

    // Display model details
    console.log();
    console.log(chalk.bold.cyan(`📦 ${model.name}`));
    console.log();

    console.log(chalk.bold('Basic Information:'));
    console.log(`  ${chalk.gray('ID:')}          ${model.id}`);
    console.log(`  ${chalk.gray('Name:')}        ${model.name}`);
    console.log(`  ${chalk.gray('Version:')}     ${model.version}`);
    console.log(`  ${chalk.gray('Path:')}        ${model.path}`);
    console.log(`  ${chalk.gray('Size:')}        ${(model.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  ${chalk.gray('Checksum:')}    ${model.checksum.substring(0, 16)}...`);
    console.log(`  ${chalk.gray('Created:')}     ${model.createdAt.toLocaleString()}`);
    console.log();

    if (model.description) {
      console.log(chalk.bold('Description:'));
      console.log(`  ${model.description}`);
      console.log();
    }

    if (model.tags && model.tags.length > 0) {
      console.log(chalk.bold('Tags:'));
      console.log(`  ${model.tags.join(', ')}`);
      console.log();
    }

    console.log(chalk.bold('Training Configuration:'));
    console.log(`  ${chalk.gray('Base Model:')}       ${model.trainingConfig.baseModel}`);
    console.log(`  ${chalk.gray('Resolution:')}       ${model.trainingConfig.resolution}`);
    console.log(`  ${chalk.gray('Epochs:')}           ${model.trainingConfig.epochs}`);
    console.log(`  ${chalk.gray('Batch Size:')}       ${model.trainingConfig.batchSize}`);
    console.log(`  ${chalk.gray('Learning Rate:')}    ${model.trainingConfig.learningRate}`);
    console.log(`  ${chalk.gray('LoRA Rank:')}        ${model.trainingConfig.loraRank}`);
    console.log(`  ${chalk.gray('LoRA Alpha:')}       ${model.trainingConfig.loraAlpha}`);
    console.log(`  ${chalk.gray('Optimizer:')}        ${model.trainingConfig.optimizer}`);
    console.log(`  ${chalk.gray('LR Scheduler:')}     ${model.trainingConfig.lrScheduler}`);
    console.log();

    console.log(chalk.bold('Training Results:'));
    console.log(`  ${chalk.gray('Final Loss:')}       ${model.trainingResult.finalLoss.toFixed(4)}`);
    console.log(`  ${chalk.gray('Average Loss:')}     ${model.trainingResult.avgLoss.toFixed(4)}`);
    console.log(`  ${chalk.gray('Total Steps:')}      ${model.trainingResult.totalSteps}`);
    console.log(`  ${chalk.gray('Total Epochs:')}     ${model.trainingResult.totalEpochs}`);
    console.log(`  ${chalk.gray('Duration:')}         ${(model.trainingResult.trainingDuration / 60).toFixed(1)} minutes`);
    console.log(`  ${chalk.gray('Avg Speed:')}        ${model.trainingResult.avgStepsPerSecond.toFixed(2)} steps/sec`);
    console.log(`  ${chalk.gray('Completed:')}        ${model.trainingResult.completedAt.toLocaleString()}`);
    console.log();

    if (model.trainingResult.checkpoints.length > 0) {
      console.log(chalk.bold(`Checkpoints (${model.trainingResult.checkpoints.length}):`));
      model.trainingResult.checkpoints.forEach((cp, i) => {
        console.log(`  ${chalk.gray(`${i + 1}.`)} ${cp}`);
      });
      console.log();
    }

    if (model.generationCount !== undefined && model.generationCount > 0) {
      console.log(chalk.bold('Usage Statistics:'));
      console.log(`  ${chalk.gray('Generations:')}  ${model.generationCount}`);
      if (model.lastUsedAt) {
        console.log(`  ${chalk.gray('Last Used:')}    ${model.lastUsedAt.toLocaleString()}`);
      }
      console.log();
    }

    // Verify integrity
    if (options.verbose) {
      const verifySpinner = ora('Verifying model integrity...').start();
      const isValid = await modelManager.verifyModel(model.id);

      if (isValid) {
        verifySpinner.succeed(chalk.green('Model integrity verified'));
      } else {
        verifySpinner.fail(chalk.red('Model integrity check failed'));
      }
      console.log();
    }
  } catch (error) {
    spinner.fail(chalk.red('Failed to load model'));
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Export a model
 */
export async function modelsExportCommand(options: ModelsExportOptions): Promise<void> {
  if (!options.id && !options.name) {
    console.error(chalk.red('Error: Either --id or --name must be specified'));
    process.exit(1);
  }

  const spinner = ora('Exporting model...').start();

  try {
    const modelManager = new ModelManager();
    await modelManager.init();

    // Get model
    let model;
    if (options.id) {
      model = await modelManager.getModel(options.id);
    } else {
      model = await modelManager.getModelByName(options.name!);
    }

    if (!model) {
      spinner.fail(chalk.red('Model not found'));
      process.exit(1);
    }

    spinner.text = `Exporting ${model.name}...`;

    // Export model
    const exportedPath = await modelManager.exportModel(model.id, options.output, {
      includeMetadata: options.includeMetadata ?? true,
      includeCheckpoints: options.includeCheckpoints ?? false,
      includeValidationImages: options.includeValidation ?? false,
    });

    spinner.succeed(chalk.green('Model exported successfully'));

    console.log();
    console.log(chalk.bold('📤 Export Details:'));
    console.log(`  ${chalk.gray('Model:')}        ${model.name}`);
    console.log(`  ${chalk.gray('Location:')}     ${exportedPath}`);
    console.log(`  ${chalk.gray('Size:')}         ${(model.size / 1024 / 1024).toFixed(2)} MB`);
    console.log();

    if (options.includeMetadata) {
      console.log(`  ${chalk.green('✓')} Metadata included`);
    }
    if (options.includeCheckpoints) {
      console.log(`  ${chalk.green('✓')} Checkpoints included (${model.trainingResult.checkpoints.length})`);
    }
    if (options.includeValidation) {
      console.log(`  ${chalk.green('✓')} Validation images included`);
    }
    console.log();
  } catch (error) {
    spinner.fail(chalk.red('Export failed'));
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Delete a model
 */
export async function modelsDeleteCommand(options: ModelsDeleteOptions): Promise<void> {
  if (!options.id && !options.name) {
    console.error(chalk.red('Error: Either --id or --name must be specified'));
    process.exit(1);
  }

  const spinner = ora('Loading model...').start();

  try {
    const modelManager = new ModelManager();
    await modelManager.init();

    // Get model
    let model;
    if (options.id) {
      model = await modelManager.getModel(options.id);
    } else {
      model = await modelManager.getModelByName(options.name!);
    }

    if (!model) {
      spinner.fail(chalk.red('Model not found'));
      process.exit(1);
    }

    spinner.stop();

    // Show model details
    console.log();
    console.log(chalk.bold.red('⚠️  Delete Model'));
    console.log();
    console.log(`  ${chalk.gray('Name:')}     ${chalk.white(model.name)}`);
    console.log(`  ${chalk.gray('ID:')}       ${chalk.white(model.id)}`);
    console.log(`  ${chalk.gray('Size:')}     ${chalk.white((model.size / 1024 / 1024).toFixed(2))} MB`);
    console.log(`  ${chalk.gray('Created:')}  ${chalk.white(model.createdAt.toLocaleDateString())}`);
    console.log();

    if (!options.keepCheckpoints && model.trainingResult.checkpoints.length > 0) {
      console.log(chalk.yellow(`  Will also delete ${model.trainingResult.checkpoints.length} checkpoint(s)`));
      console.log();
    }

    // Confirm deletion
    if (!options.force) {
      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: chalk.red('Are you sure you want to delete this model?'),
          default: false,
        },
      ]);

      if (!confirmed) {
        console.log(chalk.yellow('Deletion cancelled.'));
        process.exit(0);
      }
    }

    // Delete model
    spinner.start('Deleting model...');

    await modelManager.deleteModel(model.id, !options.keepCheckpoints);

    spinner.succeed(chalk.green('Model deleted successfully'));
    console.log();
  } catch (error) {
    spinner.fail(chalk.red('Deletion failed'));
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
