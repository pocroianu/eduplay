/**
 * Content Analyzer
 *
 * Analyzes existing game content to identify patterns and best practices.
 */

import { readFile, readdir, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import sharp from 'sharp';
import { ContentAnalysis, ContentAnalyzerConfig, ExtractedGameData } from './types';

/**
 * Analyzes existing game content for patterns and characteristics.
 *
 * Responsibilities:
 * - Analyze image properties (colors, complexity, styles)
 * - Analyze text patterns (vocabulary, readability, sentence structure)
 * - Analyze audio properties (duration, pace, quality)
 * - Generate style guides from successful content
 * - Identify common themes and patterns
 */
export class ContentAnalyzer {
  constructor(private config: ContentAnalyzerConfig) {}

  /**
   * Analyze all content of specified type
   */
  async analyze(): Promise<ContentAnalysis> {
    switch (this.config.contentType) {
      case 'image':
        return this.analyzeImages();
      case 'text':
        return this.analyzeText();
      case 'audio':
        return this.analyzeAudio();
      default:
        throw new Error(`Unknown content type: ${this.config.contentType}`);
    }
  }

  /**
   * Save analysis results to output path
   */
  async save(analysis: ContentAnalysis): Promise<void> {
    const outputPath = join(
      this.config.outputPath,
      `${this.config.contentType}-analysis.json`
    );

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(analysis, null, 2));

    console.log(`✅ Analysis saved to: ${outputPath}`);
  }

  // Private methods - Image Analysis

  /**
   * Analyze image content
   */
  private async analyzeImages(): Promise<ContentAnalysis> {
    const gamesPath = join(this.config.inputPath, 'games');
    const games: ExtractedGameData[] = [];

    try {
      const files = await readdir(gamesPath);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await readFile(join(gamesPath, file), 'utf-8');
          games.push(JSON.parse(content));
        }
      }
    } catch (error) {
      console.warn('Failed to load games:', error);
    }

    const categories: Record<string, number> = {};
    const styles: Record<string, number> = {};
    const themes: string[] = [];
    const colors: string[] = [];

    let totalWidth = 0;
    let totalHeight = 0;
    let totalComplexity = 0;
    let imageCount = 0;
    const formats: Record<string, number> = {};

    // Analyze each game's assets
    for (const game of games) {
      // Count categories
      for (const question of game.questions) {
        categories[question.category] = (categories[question.category] || 0) + 1;
      }

      // Record themes
      if (game.meta.theme && !themes.includes(game.meta.theme)) {
        themes.push(game.meta.theme);
      }

      // Analyze assets
      for (const asset of game.assets) {
        if (asset.type === 'image' && asset.metadata) {
          if (asset.metadata.width) totalWidth += asset.metadata.width;
          if (asset.metadata.height) totalHeight += asset.metadata.height;
          if (asset.metadata.complexity) totalComplexity += asset.metadata.complexity;

          if (asset.metadata.format) {
            formats[asset.metadata.format] = (formats[asset.metadata.format] || 0) + 1;
          }

          if (asset.metadata.dominantColors) {
            colors.push(...asset.metadata.dominantColors);
          }

          imageCount++;
        }

        styles[asset.category] = (styles[asset.category] || 0) + 1;
      }
    }

    // Calculate averages
    const avgWidth = imageCount > 0 ? totalWidth / imageCount : 0;
    const avgHeight = imageCount > 0 ? totalHeight / imageCount : 0;
    const avgComplexity = imageCount > 0 ? totalComplexity / imageCount : 0;

    // Find most common colors
    const colorCounts: Record<string, number> = {};
    for (const color of colors) {
      colorCounts[color] = (colorCounts[color] || 0) + 1;
    }

    const commonColors = Object.entries(colorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([color]) => color);

    return {
      contentType: 'image',
      totalItems: imageCount,
      patterns: {
        categories,
        styles,
        commonThemes: themes
      },
      imageAnalysis: {
        averageWidth: Math.round(avgWidth),
        averageHeight: Math.round(avgHeight),
        commonColors,
        averageComplexity: avgComplexity,
        formats
      }
    };
  }

  /**
   * Analyze text content
   */
  private async analyzeText(): Promise<ContentAnalysis> {
    const gamesPath = join(this.config.inputPath, 'games');
    const games: ExtractedGameData[] = [];

    try {
      const files = await readdir(gamesPath);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await readFile(join(gamesPath, file), 'utf-8');
          games.push(JSON.parse(content));
        }
      }
    } catch (error) {
      console.warn('Failed to load games:', error);
    }

    const categories: Record<string, number> = {};
    const styles: Record<string, number> = {};
    const allWords: string[] = [];
    const sentencePatterns: string[] = [];

    let totalWordCount = 0;
    let totalReadability = 0;
    let textCount = 0;

    // Analyze questions
    for (const game of games) {
      for (const question of game.questions) {
        categories[question.category] = (categories[question.category] || 0) + 1;

        // Analyze English text
        const text = question.text.en || '';
        if (text) {
          const words = text.toLowerCase().split(/\s+/);
          allWords.push(...words);
          totalWordCount += words.length;

          // Simple readability estimate
          const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
          totalReadability += avgWordLength;

          // Extract sentence patterns
          if (text.includes('Which')) sentencePatterns.push('Which...');
          if (text.includes('What')) sentencePatterns.push('What...');
          if (text.includes('How')) sentencePatterns.push('How...');

          textCount++;
        }
      }
    }

    // Find most common words
    const wordCounts: Record<string, number> = {};
    for (const word of allWords) {
      const cleaned = word.replace(/[^a-z]/g, '');
      if (cleaned.length > 3) {
        // Skip short words
        wordCounts[cleaned] = (wordCounts[cleaned] || 0) + 1;
      }
    }

    const commonWords = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word]) => word);

    // Get unique sentence patterns
    const uniquePatterns = [...new Set(sentencePatterns)];

    return {
      contentType: 'text',
      totalItems: textCount,
      patterns: {
        categories,
        styles,
        commonThemes: []
      },
      textAnalysis: {
        averageWordCount: textCount > 0 ? totalWordCount / textCount : 0,
        averageReadability: textCount > 0 ? totalReadability / textCount : 0,
        commonWords,
        sentencePatterns: uniquePatterns
      }
    };
  }

  /**
   * Analyze audio content
   */
  private async analyzeAudio(): Promise<ContentAnalysis> {
    // Simplified analysis - would require audio processing libraries for full implementation
    return {
      contentType: 'audio',
      totalItems: 0,
      patterns: {
        categories: {},
        styles: {},
        commonThemes: []
      },
      audioAnalysis: {
        averageDuration: 0,
        sampleRates: {},
        languages: { en: 0, ro: 0 }
      }
    };
  }

  /**
   * Generate style guide from analysis
   */
  generateStyleGuide(analysis: ContentAnalysis): string {
    let guide = `# ${analysis.contentType.toUpperCase()} STYLE GUIDE\n\n`;
    guide += `Generated from analysis of ${analysis.totalItems} items\n\n`;

    if (analysis.imageAnalysis) {
      guide += `## Image Guidelines\n\n`;
      guide += `- **Dimensions**: ${analysis.imageAnalysis.averageWidth}x${analysis.imageAnalysis.averageHeight}px (average)\n`;
      guide += `- **Color Palette**: ${analysis.imageAnalysis.commonColors.join(', ')}\n`;
      guide += `- **Complexity**: ${analysis.imageAnalysis.averageComplexity.toFixed(2)} (lower = simpler)\n`;
      guide += `- **Formats**: ${Object.keys(analysis.imageAnalysis.formats).join(', ')}\n\n`;
    }

    if (analysis.textAnalysis) {
      guide += `## Text Guidelines\n\n`;
      guide += `- **Average Word Count**: ${analysis.textAnalysis.averageWordCount.toFixed(1)} words\n`;
      guide += `- **Common Question Patterns**: ${analysis.textAnalysis.sentencePatterns.join(', ')}\n`;
      guide += `- **Frequent Words**: ${analysis.textAnalysis.commonWords.slice(0, 10).join(', ')}\n\n`;
    }

    guide += `## Categories\n\n`;
    for (const [category, count] of Object.entries(analysis.patterns.categories)) {
      guide += `- ${category}: ${count} items\n`;
    }

    return guide;
  }
}
