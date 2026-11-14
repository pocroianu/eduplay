/**
 * CLI command for workflow execution.
 *
 * @module cli/commands/workflow
 */

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { readFile } from 'fs/promises';
import { WorkflowEngine, WorkflowBuilder } from '../../batch/WorkflowEngine';
import { WorkflowDefinition } from '../../batch/types';

/**
 * Format duration
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Create workflow command
 */
export function createWorkflowCommand(): Command {
  const command = new Command('workflow');
  command.description('Multi-step workflow execution');

  // Subcommand: workflow run
  command
    .command('run')
    .description('Execute a workflow from definition file')
    .argument('<file>', 'Workflow definition file (JSON or YAML)')
    .option('--continue-on-error', 'Continue workflow on step errors')
    .option('--verbose', 'Show detailed output')
    .action(async (file, options) => {
      const spinner = ora('Loading workflow...').start();

      try {
        // Load workflow definition
        const content = await readFile(file, 'utf-8');
        let workflow: WorkflowDefinition;

        try {
          workflow = JSON.parse(content);
        } catch (error) {
          spinner.fail('Invalid workflow file');
          console.error(chalk.red('Workflow file must be valid JSON'));
          process.exit(1);
        }

        // Override continue-on-error if specified
        if (options.continueOnError !== undefined) {
          workflow.continueOnError = options.continueOnError;
        }

        spinner.succeed('Workflow loaded');

        // Initialize workflow engine
        const engine = new WorkflowEngine({
          // Components would be initialized here
          // For now, using empty components for demonstration
        });

        // Validate workflow
        const validation = engine.validateWorkflow(workflow);
        if (!validation.valid) {
          console.error(chalk.red('\n❌ Workflow validation failed:'));
          for (const error of validation.errors) {
            console.error(chalk.red(`   - ${error}`));
          }
          process.exit(1);
        }

        console.log(chalk.green('✓ Workflow validated'));

        // Execute workflow
        console.log(chalk.blue(`\n🚀 Executing workflow (${workflow.steps.length} steps)...\n`));

        const execution = await engine.execute(workflow);

        // Display results
        if (execution.status === 'completed') {
          spinner.succeed(chalk.green('Workflow completed successfully'));

          const summary = engine.getSummary(execution);

          console.log(chalk.blue('\n📊 Workflow Summary:'));
          console.log(chalk.gray(`   Total Steps:     ${summary.totalSteps}`));
          console.log(chalk.green(`   Completed:       ${summary.completedSteps}`));
          console.log(chalk.red(`   Failed:          ${summary.failedSteps}`));
          console.log(chalk.yellow(`   Skipped:         ${summary.skippedSteps}`));
          console.log(chalk.gray(`   Duration:        ${formatDuration(summary.duration)}`));

          if (options.verbose && execution.result) {
            console.log(chalk.blue('\n📦 Results:'));
            console.log(JSON.stringify(execution.result, null, 2));
          }

        } else {
          spinner.fail(chalk.red('Workflow failed'));

          if (execution.error) {
            console.error(chalk.red(`\nError: ${execution.error.message}`));
            if (options.verbose && execution.error.stack) {
              console.error(chalk.gray(execution.error.stack));
            }
          }

          // Show which step failed
          const failedStep = execution.steps.find(s => s.status === 'failed');
          if (failedStep) {
            console.error(chalk.red(`\nFailed at step: ${failedStep.step.id} (${failedStep.step.type})`));
          }

          process.exit(1);
        }

      } catch (error: any) {
        spinner.fail('Workflow execution failed');
        console.error(chalk.red(error.message));
        if (options.verbose && error.stack) {
          console.error(chalk.gray(error.stack));
        }
        process.exit(1);
      }
    });

  // Subcommand: workflow validate
  command
    .command('validate')
    .description('Validate a workflow definition')
    .argument('<file>', 'Workflow definition file')
    .action(async (file) => {
      const spinner = ora('Validating workflow...').start();

      try {
        // Load workflow definition
        const content = await readFile(file, 'utf-8');
        const workflow: WorkflowDefinition = JSON.parse(content);

        // Initialize engine
        const engine = new WorkflowEngine();

        // Validate
        const validation = engine.validateWorkflow(workflow);

        if (validation.valid) {
          spinner.succeed(chalk.green('Workflow is valid'));

          console.log(chalk.blue('\n📋 Workflow Info:'));
          console.log(chalk.gray(`   Steps:           ${workflow.steps.length}`));
          console.log(chalk.gray(`   Continue on Error: ${workflow.continueOnError}`));

          console.log(chalk.blue('\n📝 Steps:'));
          for (const step of workflow.steps) {
            console.log(chalk.gray(`   ${step.id} (${step.type})`));
          }

        } else {
          spinner.fail(chalk.red('Workflow validation failed'));

          console.error(chalk.red('\n❌ Errors:'));
          for (const error of validation.errors) {
            console.error(chalk.red(`   - ${error}`));
          }

          process.exit(1);
        }

      } catch (error: any) {
        spinner.fail('Validation failed');
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  // Subcommand: workflow create
  command
    .command('create')
    .description('Create a workflow template')
    .option('-t, --type <type>', 'Workflow type (full, generate-only, train-generate)', 'generate-only')
    .option('-o, --output <file>', 'Output file', 'workflow.json')
    .action(async (options) => {
      const spinner = ora('Creating workflow template...').start();

      try {
        let workflow: WorkflowDefinition;

        switch (options.type) {
          case 'full':
            workflow = new WorkflowBuilder()
              .extract('extract-data', { outputDir: './training-data' })
              .train('train-lora', { dataset: './training-data/dataset.jsonl' })
              .generate('generate-games', { count: 10 })
              .validate('validate-output', { minQuality: 0.8 })
              .build();
            break;

          case 'train-generate':
            workflow = new WorkflowBuilder()
              .train('train-lora', { dataset: './training-data/dataset.jsonl' })
              .generate('generate-games', { count: 10 })
              .validate('validate-output', { minQuality: 0.8 })
              .build();
            break;

          case 'generate-only':
          default:
            workflow = new WorkflowBuilder()
              .generate('generate-games', { count: 10 })
              .validate('validate-output', { minQuality: 0.8 })
              .build();
            break;
        }

        // Write to file
        const { writeFile } = await import('fs/promises');
        await writeFile(options.output, JSON.stringify(workflow, null, 2), 'utf-8');

        spinner.succeed(`Workflow template created: ${options.output}`);

        console.log(chalk.blue('\n📝 Template created with steps:'));
        for (const step of workflow.steps) {
          console.log(chalk.gray(`   ${step.id} (${step.type})`));
        }

        console.log(chalk.blue('\n💡 Next steps:'));
        console.log(chalk.gray(`   1. Edit ${options.output} to customize the workflow`));
        console.log(chalk.gray(`   2. Run with: edu-generate workflow run ${options.output}`));

      } catch (error: any) {
        spinner.fail('Failed to create template');
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  return command;
}
