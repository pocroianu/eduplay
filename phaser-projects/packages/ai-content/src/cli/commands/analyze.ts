import chalk from 'chalk';
import ora from 'ora';
import { join } from 'path';
import { mkdir, writeFile, readdir, readFile } from 'fs/promises';
import {
  ContentAnalyzer,
  type ContentAnalyzerConfig
} from '../../training/index';

interface AnalyzeOptions {
  input: string;
  output: string;
  type: 'image' | 'text' | 'audio';
  verbose?: boolean;
}

export async function analyzeCommand(options: AnalyzeOptions): Promise<void> {
  const spinner = ora('Initializing content analysis...').start();

  try {
    // Validate type
    if (!['image', 'text', 'audio'].includes(options.type)) {
      throw new Error(`Invalid content type: ${options.type}. Must be 'image', 'text', or 'audio'`);
    }

    if (options.verbose) {
      spinner.info(chalk.blue(`Input path: ${options.input}`));
      spinner.info(chalk.blue(`Output path: ${options.output}`));
      spinner.info(chalk.blue(`Content type: ${options.type}`));
      spinner.start('Analyzing content...');
    }

    // Create analyzer config
    const config: ContentAnalyzerConfig = {
      inputPath: options.input,
      outputPath: options.output,
      contentType: options.type
    };

    // Create analyzer
    const analyzer = new ContentAnalyzer(config);

    // Run analysis
    spinner.text = `Analyzing ${options.type} content...`;
    const analysis = await analyzer.analyze();

    // Create output directory
    await mkdir(options.output, { recursive: true });

    // Save analysis results
    const outputFile = join(options.output, `${options.type}-analysis.json`);
    await writeFile(outputFile, JSON.stringify(analysis, null, 2));

    spinner.succeed(chalk.green('Content analysis complete!'));

    // Display insights
    console.log('\n' + chalk.bold('Analysis Results:'));
    console.log(chalk.cyan(`  📊 Content type: ${options.type}`));
    console.log(chalk.cyan(`  📈 Items analyzed: ${analysis.totalItems || 0}`));
    const categoryCount = analysis.patterns?.categories ? Object.keys(analysis.patterns.categories).length : 0;
    console.log(chalk.cyan(`  🏷️  Unique categories: ${categoryCount}`));

    if (analysis.patterns?.categories) {
      const categories = Object.keys(analysis.patterns.categories);
      console.log(chalk.cyan(`  📋 Categories: ${categories.join(', ')}`));
    }

    if (options.type === 'text' && analysis.textAnalysis) {
      console.log('\n' + chalk.bold('Text Patterns:'));
      if (analysis.textAnalysis.commonWords && analysis.textAnalysis.commonWords.length > 0) {
        const topWords = analysis.textAnalysis.commonWords.slice(0, 10);
        console.log(chalk.cyan(`  🔤 Top words: ${topWords.join(', ')}`));
      }
      if (analysis.textAnalysis.averageWordCount) {
        console.log(chalk.cyan(`  📏 Avg word count: ${analysis.textAnalysis.averageWordCount.toFixed(1)} words`));
      }
      if (analysis.textAnalysis.averageReadability) {
        console.log(chalk.cyan(`  📝 Avg readability: ${analysis.textAnalysis.averageReadability.toFixed(1)}`));
      }
    }

    if (options.type === 'image' && analysis.imageAnalysis) {
      console.log('\n' + chalk.bold('Image Patterns:'));
      if (analysis.imageAnalysis.formats) {
        console.log(chalk.cyan(`  🖼️  Formats: ${Object.keys(analysis.imageAnalysis.formats).join(', ')}`));
      }
      if (analysis.imageAnalysis.averageWidth && analysis.imageAnalysis.averageHeight) {
        console.log(chalk.cyan(`  📐 Avg dimensions: ${analysis.imageAnalysis.averageWidth.toFixed(0)}x${analysis.imageAnalysis.averageHeight.toFixed(0)}`));
      }
    }

    if (options.type === 'audio' && analysis.audioAnalysis) {
      console.log('\n' + chalk.bold('Audio Patterns:'));
      if (analysis.audioAnalysis.sampleRates) {
        console.log(chalk.cyan(`  🎵 Sample rates: ${Object.keys(analysis.audioAnalysis.sampleRates).join(', ')}`));
      }
      if (analysis.audioAnalysis.averageDuration) {
        console.log(chalk.cyan(`  ⏱️  Avg duration: ${analysis.audioAnalysis.averageDuration.toFixed(1)}s`));
      }
    }

    console.log(chalk.cyan(`\n  💾 Analysis saved to: ${outputFile}`));

    if (options.verbose && analysis.patterns?.commonThemes) {
      console.log('\n' + chalk.gray('Common Themes:'));
      analysis.patterns.commonThemes.forEach((theme: string) => {
        console.log(chalk.gray(`  - ${theme}`));
      });
    }

    console.log('\n' + chalk.green('✅ Analysis completed successfully!'));

  } catch (error) {
    spinner.fail(chalk.red('Analysis failed'));
    console.error(chalk.red('❌ Error:', error instanceof Error ? error.message : String(error)));
    if (options.verbose && error instanceof Error && error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}
