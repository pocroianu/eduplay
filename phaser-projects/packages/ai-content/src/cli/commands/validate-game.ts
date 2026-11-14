/**
 * CLI Command: Validate Game
 *
 * Validate generated game packages using the comprehensive validation pipeline.
 *
 * @module cli/commands/validate-game
 */

import chalk from 'chalk';
import ora from 'ora';
import { resolve, join } from 'path';
import { readdir, stat } from 'fs/promises';
import {
  ValidationPipeline,
  ValidationEvents,
  DEFAULT_PIPELINE_CONFIG,
  type ValidationPipelineConfig,
  type ValidationReport
} from '../../validation';

/**
 * Validate game command options
 */
interface ValidateGameOptions {
  game?: string;
  all?: boolean;
  gamesPath?: string;
  strict?: boolean;
  remediate?: boolean;
  report?: string;
  reportFormat?: 'json' | 'html' | 'both';
  failFast?: boolean;
  verbose?: boolean;
}

/**
 * Validate game command
 */
export async function validateGameCommand(options: ValidateGameOptions): Promise<void> {
  const spinner = ora('Initializing validation pipeline...').start();

  try {
    // Validate options
    if (!options.game && !options.all) {
      throw new Error('Must specify --game <id> or --all');
    }

    const gamesPath = resolve(options.gamesPath || './generated-games');

    // Build pipeline configuration
    const pipelineConfig: ValidationPipelineConfig = {
      ...DEFAULT_PIPELINE_CONFIG,
      failFast: options.failFast || false,
      enableRemediation: options.remediate || false,
      generateReport: !!options.report,
      reportFormat: options.reportFormat || 'both',
      reportOutputPath: options.report ? resolve(options.report) : undefined
    };

    // Adjust rules for strict mode
    if (options.strict) {
      pipelineConfig.rules.quality.minOverallQuality = 90;
      pipelineConfig.rules.quality.minImageQuality = 85;
      pipelineConfig.rules.quality.minTextQuality = 85;
    }

    // Create pipeline
    const pipeline = new ValidationPipeline(pipelineConfig);

    // Setup event listeners
    if (options.verbose) {
      pipeline.on(ValidationEvents.STAGE_STARTED, (stage: string) => {
        spinner.text = chalk.blue(`Running ${stage} validation...`);
      });

      pipeline.on(ValidationEvents.STAGE_COMPLETED, ({ stage }: any) => {
        spinner.text = chalk.green(`✓ ${stage} validation complete`);
      });

      pipeline.on(ValidationEvents.PROGRESS, ({ stage, progress, message }: any) => {
        spinner.text = chalk.gray(`${stage}: ${message} (${progress}%)`);
      });
    }

    // Get games to validate
    const gameIds: string[] = [];

    if (options.all) {
      spinner.text = 'Discovering games...';
      const entries = await readdir(gamesPath);

      for (const entry of entries) {
        const entryPath = join(gamesPath, entry);
        const entryStat = await stat(entryPath);

        if (entryStat.isDirectory()) {
          // Check if it's a game directory (has config.json)
          try {
            await stat(join(entryPath, 'config.json'));
            gameIds.push(entry);
          } catch {
            // Not a game directory
          }
        }
      }

      if (gameIds.length === 0) {
        throw new Error(`No games found in ${gamesPath}`);
      }

      spinner.succeed(chalk.green(`Found ${gameIds.length} games to validate`));
    } else if (options.game) {
      gameIds.push(options.game);
    }

    // Validate each game
    const results: Map<string, ValidationReport> = new Map();
    let passedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < gameIds.length; i++) {
      const gameId = gameIds[i];
      const gamePath = join(gamesPath, gameId);

      spinner.start(
        chalk.blue(`Validating ${gameId} (${i + 1}/${gameIds.length})...`)
      );

      try {
        const report = await pipeline.validate(gamePath, gameId);
        results.set(gameId, report);

        if (report.passed) {
          passedCount++;
          spinner.succeed(
            chalk.green(
              `✓ ${gameId}: PASSED (score: ${report.overallScore.toFixed(1)})`
            )
          );
        } else {
          failedCount++;
          spinner.warn(
            chalk.yellow(
              `⚠ ${gameId}: FAILED (score: ${report.overallScore.toFixed(1)}, issues: ${report.summary.totalIssues})`
            )
          );
        }

        // Show critical issues immediately
        const criticalIssues = [
          ...(report.stages.basic?.issues || []),
          ...(report.stages.quality?.issues || []),
          ...(report.stages.compliance?.issues || [])
        ].filter(i => i.severity === 'critical');

        if (criticalIssues.length > 0 && options.verbose) {
          console.log(chalk.red(`  Critical issues:`));
          criticalIssues.forEach(issue => {
            console.log(chalk.red(`    - ${issue.message}`));
          });
        }
      } catch (error) {
        failedCount++;
        spinner.fail(
          chalk.red(
            `✗ ${gameId}: ERROR - ${error instanceof Error ? error.message : String(error)}`
          )
        );
      }

      console.log(); // Add spacing
    }

    // Display summary
    console.log(chalk.bold('\n' + '='.repeat(60)));
    console.log(chalk.bold('Validation Summary'));
    console.log(chalk.bold('='.repeat(60) + '\n'));

    console.log(chalk.cyan(`Total games validated: ${gameIds.length}`));
    console.log(chalk.green(`✓ Passed: ${passedCount}`));
    console.log(chalk.red(`✗ Failed: ${failedCount}`));
    console.log(
      chalk.cyan(`Pass rate: ${((passedCount / gameIds.length) * 100).toFixed(1)}%`)
    );

    // Calculate aggregate statistics
    let totalIssues = 0;
    let totalCritical = 0;
    let totalHigh = 0;
    let totalAutoRemediated = 0;
    let avgScore = 0;

    for (const report of results.values()) {
      totalIssues += report.summary.totalIssues;
      totalCritical += report.summary.criticalIssues;
      totalHigh += report.summary.highIssues;
      totalAutoRemediated += report.summary.autoRemediatedIssues;
      avgScore += report.overallScore;
    }

    avgScore /= results.size;

    console.log('\n' + chalk.bold('Aggregate Statistics:'));
    console.log(chalk.cyan(`  Average score: ${avgScore.toFixed(1)}`));
    console.log(chalk.cyan(`  Total issues: ${totalIssues}`));
    console.log(chalk.red(`  Critical issues: ${totalCritical}`));
    console.log(chalk.yellow(`  High priority issues: ${totalHigh}`));

    if (totalAutoRemediated > 0) {
      console.log(
        chalk.green(`  Auto-remediated issues: ${totalAutoRemediated}`)
      );
    }

    // Display common issues
    const issuesByMessage = new Map<string, number>();
    for (const report of results.values()) {
      const allIssues = [
        ...(report.stages.basic?.issues || []),
        ...(report.stages.quality?.issues || []),
        ...(report.stages.compliance?.issues || [])
      ];

      for (const issue of allIssues) {
        const count = issuesByMessage.get(issue.message) || 0;
        issuesByMessage.set(issue.message, count + 1);
      }
    }

    if (issuesByMessage.size > 0) {
      console.log('\n' + chalk.bold('Most Common Issues:'));
      const sortedIssues = Array.from(issuesByMessage.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      sortedIssues.forEach(([message, count]) => {
        console.log(chalk.yellow(`  - ${message} (${count}x)`));
      });
    }

    // Report locations
    if (options.report) {
      console.log('\n' + chalk.bold('Reports Generated:'));
      for (const gameId of results.keys()) {
        const reportPath = join(options.report, gameId);
        if (options.reportFormat === 'both' || options.reportFormat === 'json') {
          console.log(
            chalk.cyan(`  ${gameId}: ${reportPath}/validation-report.json`)
          );
        }
        if (options.reportFormat === 'both' || options.reportFormat === 'html') {
          console.log(
            chalk.cyan(`  ${gameId}: ${reportPath}/validation-report.html`)
          );
        }
      }
    }

    // Exit with appropriate code
    if (failedCount > 0) {
      console.log('\n' + chalk.yellow('⚠ Validation completed with failures'));
      if (options.strict) {
        process.exit(1);
      }
    } else {
      console.log('\n' + chalk.green('✅ All validations passed!'));
    }
  } catch (error) {
    spinner.fail(chalk.red('Validation failed'));
    console.error(
      chalk.red('Error:', error instanceof Error ? error.message : String(error))
    );
    if (options.verbose && error instanceof Error && error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}
