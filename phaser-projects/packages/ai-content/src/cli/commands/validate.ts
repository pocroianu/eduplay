import chalk from 'chalk';
import ora from 'ora';
import { readFile, writeFile, stat } from 'fs/promises';
import {
  QualityValidator,
  type QualityMetrics
} from '../../training/index';

interface ValidateOptions {
  input: string;
  type: 'image' | 'text' | 'audio';
  output?: string;
  minQuality: number;
  strict?: boolean;
  verbose?: boolean;
}

interface ValidationResult {
  index: number;
  content: string;
  metrics: QualityMetrics;
  passed: boolean;
  issues: string[];
  warnings: string[];
}

export async function validateCommand(options: ValidateOptions): Promise<void> {
  const spinner = ora('Initializing content validation...').start();

  try {
    // Validate type
    if (!['image', 'text', 'audio'].includes(options.type)) {
      throw new Error(`Invalid content type: ${options.type}. Must be 'image', 'text', or 'audio'`);
    }

    // Validate quality threshold
    if (options.minQuality < 0 || options.minQuality > 100) {
      throw new Error(`Invalid minimum quality score: ${options.minQuality}. Must be between 0 and 100`);
    }

    if (options.verbose) {
      spinner.info(chalk.blue(`Input path: ${options.input}`));
      spinner.info(chalk.blue(`Content type: ${options.type}`));
      spinner.info(chalk.blue(`Min quality score: ${options.minQuality}`));
      spinner.info(chalk.blue(`Strict mode: ${options.strict || false}`));
      spinner.start('Validating content...');
    }

    // Check if input is file or directory
    const inputStat = await stat(options.input);
    const isFile = inputStat.isFile();

    // Load items to validate
    spinner.text = 'Loading items...';
    let items: any[] = [];

    if (isFile) {
      // Single file (likely JSONL)
      const content = await readFile(options.input, 'utf-8');
      if (options.input.endsWith('.jsonl')) {
        // Parse JSONL (one JSON object per line)
        items = content
          .split('\n')
          .filter(line => line.trim())
          .map(line => JSON.parse(line));
      } else {
        // Regular JSON file
        const parsed = JSON.parse(content);
        items = Array.isArray(parsed) ? parsed : [parsed];
      }
    } else {
      throw new Error('Directory validation not yet implemented. Please provide a file path.');
    }

    if (items.length === 0) {
      throw new Error('No items found to validate');
    }

    // Create validator
    const validator = new QualityValidator();

    // Validate items
    spinner.text = `Validating ${items.length} items...`;
    const results: ValidationResult[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let metrics: QualityMetrics;
      let contentToValidate: string = '';

      // Extract content based on type
      if (options.type === 'text') {
        contentToValidate = item.text || item.prompt || item.question || '';
      } else if (options.type === 'image') {
        contentToValidate = item.imagePath || item.image || item.path || '';
      } else if (options.type === 'audio') {
        contentToValidate = item.audioPath || item.audio || item.path || '';
      }

      if (!contentToValidate) {
        results.push({
          index: i,
          content: 'N/A',
          metrics: { overallScore: 0, passed: false, issues: ['No content found'] },
          passed: false,
          issues: ['No content found to validate'],
          warnings: []
        });
        continue;
      }

      // Validate based on type
      try {
        if (options.type === 'text') {
          metrics = await validator.validateText(contentToValidate);
        } else if (options.type === 'image') {
          metrics = await validator.validateImage(contentToValidate);
        } else {
          // validateAudio requires both audioPath and text
          const audioText = item.text || '';
          metrics = await validator.validateAudio(contentToValidate, audioText);
        }

        // Determine if passed (use metrics.passed if available, otherwise check score)
        const passed = metrics.passed !== undefined
          ? metrics.passed && metrics.overallScore >= options.minQuality
          : metrics.overallScore >= options.minQuality;

        const issues: string[] = [...(metrics.issues || [])];
        const warnings: string[] = [];

        if (!passed && metrics.overallScore < options.minQuality) {
          issues.push(`Quality score ${metrics.overallScore.toFixed(1)} below minimum ${options.minQuality}`);
        }

        // Add specific metric warnings from type-specific metrics
        const typeMetrics = metrics[options.type];
        if (typeMetrics && typeof typeMetrics === 'object') {
          Object.entries(typeMetrics).forEach(([key, value]) => {
            if (typeof value === 'number' && value < 70) {
              warnings.push(`${key}: ${value.toFixed(1)} (low)`);
            } else if (typeof value === 'number' && value < 85) {
              warnings.push(`${key}: ${value.toFixed(1)} (could be improved)`);
            }
          });
        }

        results.push({
          index: i,
          content: contentToValidate,
          metrics,
          passed,
          issues,
          warnings
        });
      } catch (error) {
        results.push({
          index: i,
          content: contentToValidate,
          metrics: { overallScore: 0, passed: false, issues: [error instanceof Error ? error.message : String(error)] },
          passed: false,
          issues: [`Validation error: ${error instanceof Error ? error.message : String(error)}`],
          warnings: []
        });
      }

      if (options.verbose && (i + 1) % 10 === 0) {
        spinner.text = `Validated ${i + 1}/${items.length} items...`;
      }
    }

    // Calculate statistics
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const warnings = results.filter(r => r.warnings && r.warnings.length > 0).length;
    const passRate = ((passed / results.length) * 100).toFixed(1);

    // Collect issues
    const allIssues = results
      .filter(r => r.issues && r.issues.length > 0)
      .flatMap(r => r.issues || []);

    const allWarnings = results
      .filter(r => r.warnings && r.warnings.length > 0)
      .flatMap(r => r.warnings || []);

    // Group issues by type
    const issuesByType = allIssues.reduce((acc, issue) => {
      acc[issue] = (acc[issue] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const warningsByType = allWarnings.reduce((acc, warning) => {
      acc[warning] = (acc[warning] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Determine overall success
    const success = failed === 0 && (!options.strict || warnings === 0);

    if (success) {
      spinner.succeed(chalk.green('Validation complete - all checks passed!'));
    } else {
      spinner.warn(chalk.yellow('Validation complete - issues found'));
    }

    // Display results
    console.log('\n' + chalk.bold('Validation Results:'));
    console.log(chalk.cyan(`  📊 Total items: ${results.length}`));
    console.log(chalk.green(`  ✅ Passed: ${passed}`));
    if (failed > 0) {
      console.log(chalk.red(`  ❌ Failed: ${failed}`));
    }
    if (warnings > 0) {
      console.log(chalk.yellow(`  ⚠️  Warnings: ${warnings}`));
    }
    console.log(chalk.cyan(`  📈 Pass rate: ${passRate}%`));

    if (Object.keys(issuesByType).length > 0) {
      console.log('\n' + chalk.bold('Issues Found:'));
      Object.entries(issuesByType)
        .sort((a, b) => b[1] - a[1])
        .forEach(([issue, count]) => {
          console.log(chalk.red(`  ❌ ${issue}: ${count}`));
        });
    }

    if (Object.keys(warningsByType).length > 0 && options.verbose) {
      console.log('\n' + chalk.bold('Warnings:'));
      Object.entries(warningsByType)
        .sort((a, b) => b[1] - a[1])
        .forEach(([warning, count]) => {
          console.log(chalk.yellow(`  ⚠️  ${warning}: ${count}`));
        });
    }

    // Save report if requested
    if (options.output) {
      const report = {
        timestamp: new Date().toISOString(),
        input: options.input,
        type: options.type,
        config: {
          minQualityScore: options.minQuality,
          strictMode: options.strict || false
        },
        summary: {
          total: results.length,
          passed,
          failed,
          warnings,
          passRate: parseFloat(passRate)
        },
        issuesByType,
        warningsByType,
        results: options.verbose ? results : undefined
      };

      await writeFile(options.output, JSON.stringify(report, null, 2));
      console.log(chalk.cyan(`\n  💾 Report saved to: ${options.output}`));
    }

    if (options.verbose && failed > 0) {
      console.log('\n' + chalk.gray('Failed Items:'));
      results
        .filter(r => !r.passed)
        .slice(0, 10) // Show first 10 failed items
        .forEach((result, idx) => {
          console.log(chalk.gray(`  ${idx + 1}. Score: ${result.metrics.overallScore?.toFixed(1) || 'N/A'}`));
          if (result.issues) {
            result.issues.forEach(issue => {
              console.log(chalk.gray(`     - ${issue}`));
            });
          }
        });
      if (failed > 10) {
        console.log(chalk.gray(`  ... and ${failed - 10} more`));
      }
    }

    // Exit with appropriate code
    if (!success) {
      console.log('\n' + chalk.yellow('⚠️  Validation completed with issues'));
      if (options.strict) {
        process.exit(1);
      }
    } else {
      console.log('\n' + chalk.green('✅ Validation completed successfully!'));
    }

  } catch (error) {
    spinner.fail(chalk.red('Validation failed'));
    console.error(chalk.red('❌ Error:', error instanceof Error ? error.message : String(error)));
    if (options.verbose && error instanceof Error && error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}
