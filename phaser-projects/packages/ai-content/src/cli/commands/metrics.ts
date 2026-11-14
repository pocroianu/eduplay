/**
 * CLI command for metrics reporting.
 *
 * @module cli/commands/metrics
 */

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { MetricsCollector } from '../../batch/MetricsCollector';

/**
 * Format duration
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
 * Create metrics command
 */
export function createMetricsCommand(): Command {
  const command = new Command('metrics');
  command.description('View and export metrics');

  // Subcommand: metrics report
  command
    .command('report')
    .description('Generate metrics report')
    .option('--start <date>', 'Start date (ISO format)')
    .option('--end <date>', 'End date (ISO format)')
    .option('--format <type>', 'Output format (console, json, csv)', 'console')
    .option('-o, --output <file>', 'Output file (for json/csv formats)')
    .action(async (options) => {
      const spinner = ora('Generating metrics report...').start();

      try {
        const collector = new MetricsCollector();

        // Parse dates
        const startDate = options.start ? new Date(options.start) : undefined;
        const endDate = options.end ? new Date(options.end) : undefined;

        // Generate report
        const report = collector.generateReport(startDate, endDate);

        spinner.succeed('Report generated');

        // Output based on format
        if (options.format === 'console') {
          // Display in console
          console.log(chalk.blue('\n📊 Metrics Report'));
          console.log(chalk.gray(`   Period:         ${report.period.start.toLocaleDateString()} - ${report.period.end.toLocaleDateString()}`));
          console.log(chalk.gray(`   Total Batches:  ${report.totalBatches}`));
          console.log(chalk.gray(`   Total Jobs:     ${report.totalJobs}`));

          console.log(chalk.blue('\n✅ Success Metrics'));
          console.log(chalk.green(`   Success Rate:   ${(report.successRate * 100).toFixed(1)}%`));
          console.log(chalk.gray(`   Throughput:     ${report.averageThroughput.toFixed(1)} jobs/hour`));

          console.log(chalk.blue('\n⏱️  Duration Metrics'));
          console.log(chalk.gray(`   Average:        ${formatDuration(report.averageJobDuration)}`));
          console.log(chalk.gray(`   Median:         ${formatDuration(report.medianJobDuration)}`));
          console.log(chalk.gray(`   P95:            ${formatDuration(report.p95JobDuration)}`));
          console.log(chalk.gray(`   P99:            ${formatDuration(report.p99JobDuration)}`));

          if (Object.keys(report.errorBreakdown).length > 0) {
            console.log(chalk.blue('\n❌ Error Breakdown'));
            for (const [errorType, count] of Object.entries(report.errorBreakdown)) {
              console.log(chalk.red(`   ${errorType}: ${count}`));
            }
          }

        } else if (options.format === 'json') {
          if (!options.output) {
            console.error(chalk.red('Output file required for JSON format'));
            process.exit(1);
          }

          await collector.exportToJSON(options.output);
          console.log(chalk.green(`\n✓ Report exported to ${options.output}`));

        } else if (options.format === 'csv') {
          if (!options.output) {
            console.error(chalk.red('Output file required for CSV format'));
            process.exit(1);
          }

          await collector.exportToCSV(options.output);
          console.log(chalk.green(`\n✓ Report exported to ${options.output}`));
        }

      } catch (error: any) {
        spinner.fail('Failed to generate report');
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  // Subcommand: metrics summary
  command
    .command('summary')
    .description('Show quick metrics summary')
    .action(async () => {
      const spinner = ora('Loading metrics...').start();

      try {
        const collector = new MetricsCollector();
        const summary = collector.getSummary();

        spinner.succeed('Metrics loaded');

        console.log(chalk.blue('\n📊 Quick Summary'));
        console.log(chalk.gray(`   Total Jobs:      ${summary.totalJobs}`));
        console.log(chalk.gray(`   Average Duration: ${formatDuration(summary.averageDuration)}`));
        console.log(chalk.green(`   Success Rate:    ${(summary.successRate * 100).toFixed(1)}%`));
        console.log(chalk.gray(`   Throughput:      ${summary.throughput.toFixed(1)} jobs/hour`));

      } catch (error: any) {
        spinner.fail('Failed to load metrics');
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  // Subcommand: metrics clear
  command
    .command('clear')
    .description('Clear all metrics data')
    .option('--confirm', 'Skip confirmation prompt')
    .action(async (options) => {
      if (!options.confirm) {
        const inquirer = await import('inquirer');
        const { confirm } = await inquirer.default.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Are you sure you want to clear all metrics?',
            default: false
          }
        ]);

        if (!confirm) {
          console.log(chalk.yellow('Operation cancelled'));
          return;
        }
      }

      const spinner = ora('Clearing metrics...').start();

      try {
        const collector = new MetricsCollector();
        collector.clear();

        spinner.succeed('Metrics cleared');

      } catch (error: any) {
        spinner.fail('Failed to clear metrics');
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  return command;
}
