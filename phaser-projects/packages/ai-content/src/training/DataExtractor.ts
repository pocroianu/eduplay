/**
 * Data Extractor
 *
 * Extracts training data from existing game configurations.
 */

import { readFile, readdir, stat, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import {
  ExtractedGameData,
  ExtractedQuestion,
  ExtractedAsset,
  ExtractedChoice,
  ExtractionStatistics,
  DataExtractorConfig
} from './types';

type ActivityMetadata = {
  activityId?: string;
  gameId?: string;
  version: number | string;
};

/**
 * Extracts game data from existing game configurations.
 *
 * Responsibilities:
 * - Parse game config files
 * - Extract questions and choices
 * - Catalog assets (images, audio)
 * - Categorize content
 * - Generate statistics
 */
export class DataExtractor {
  constructor(private config: DataExtractorConfig) {}

  /**
   * Extract data from a single game
   */
  async extractGame(gameId: string): Promise<ExtractedGameData> {
    const gamePath = await this.resolveGameContentPath(gameId);

    // Load config files
    const config = await this.loadGameConfig(gamePath);
    const i18n = await this.loadI18nFiles(gamePath, this.config.languages);

    // Extract questions
    const questions = await this.extractQuestions(config, i18n);

    // Extract assets if enabled
    const assets = this.config.includeAssets
      ? await this.extractAssets(gamePath)
      : [];

    // Generate statistics
    const statistics = this.generateStatistics(questions, assets);

    return {
      gameId,
      meta: {
        title: i18n.en?.meta?.title || gameId,
        theme: config.meta.themeName,
        difficulty: config.meta.difficulty || 'easy',
        languages: this.config.languages
      },
      questions,
      assets,
      statistics
    };
  }

  /**
   * Extract data from all games
   */
  async extractAll(): Promise<ExtractedGameData[]> {
    const games = await this.discoverGames();
    const results: ExtractedGameData[] = [];

    for (const gameId of games) {
      try {
        const data = await this.extractGame(gameId);
        results.push(data);
      } catch (error) {
        console.error(`Failed to extract game ${gameId}:`, error);
      }
    }

    return results;
  }

  /**
   * Save extracted data to output path
   */
  async save(data: ExtractedGameData[]): Promise<void> {
    // Save aggregated file
    const outputPath = join(this.config.outputPath, 'extracted-games.json');
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(data, null, 2));

    // Save individual game files
    for (const game of data) {
      const gamePath = join(this.config.outputPath, 'games', `${game.gameId}.json`);
      await mkdir(dirname(gamePath), { recursive: true });
      await writeFile(gamePath, JSON.stringify(game, null, 2));
    }

    // Save summary statistics
    const summary = this.generateSummaryStatistics(data);
    const summaryPath = join(this.config.outputPath, 'summary.json');
    await writeFile(summaryPath, JSON.stringify(summary, null, 2));
  }

  // Private methods

  /**
   * Discover all Activity directories.
   */
  private async discoverGames(): Promise<string[]> {
    const entries = await readdir(this.config.gamesPath);
    const games: string[] = [];

    for (const entry of entries) {
      const activityRoot = join(this.config.gamesPath, entry);
      try {
        const stats = await stat(activityRoot);

        if (stats.isDirectory() && await this.hasActivityVersionConfig(activityRoot)) {
          games.push(entry);
        }
      } catch {
        // Skip entries that can't be accessed
      }
    }

    return games;
  }

  private async resolveGameContentPath(activityId: string): Promise<string> {
    const activityRoot = join(this.config.gamesPath, activityId);
    const activity = await this.loadActivityMetadata(activityRoot);
    return this.resolveActivityVersionPath(activityRoot, activity);
  }

  private async hasActivityVersionConfig(activityRoot: string): Promise<boolean> {
    try {
      const activity = await this.loadActivityMetadata(activityRoot);
      await stat(join(this.resolveActivityVersionPath(activityRoot, activity), 'config.json'));
      return true;
    } catch {
      return false;
    }
  }

  private async loadActivityMetadata(activityRoot: string): Promise<ActivityMetadata> {
    const content = await readFile(join(activityRoot, 'activity.json'), 'utf-8');
    const activity = JSON.parse(content) as ActivityMetadata;

    if (activity.version === undefined || activity.version === null || activity.version === '') {
      throw new Error(`Activity version missing: ${activityRoot}`);
    }

    return activity;
  }

  private resolveActivityVersionPath(activityRoot: string, activity: ActivityMetadata): string {
    return join(activityRoot, 'versions', String(activity.version));
  }

  /**
   * Load game configuration file
   */
  private async loadGameConfig(gamePath: string): Promise<any> {
    const configPath = join(gamePath, 'config.json');
    const content = await readFile(configPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Load i18n files for all languages
   */
  private async loadI18nFiles(
    gamePath: string,
    languages: string[]
  ): Promise<Record<string, any>> {
    const i18n: Record<string, any> = {};

    for (const lang of languages) {
      const langPath = join(gamePath, 'strings', `${lang}.json`);
      try {
        const content = await readFile(langPath, 'utf-8');
        i18n[lang] = JSON.parse(content);
      } catch {
        // Language file not found
        console.warn(`Language file not found: ${langPath}`);
      }
    }

    return i18n;
  }

  /**
   * Extract questions from config and i18n data
   */
  private async extractQuestions(
    config: any,
    i18n: Record<string, any>
  ): Promise<ExtractedQuestion[]> {
    const questions: ExtractedQuestion[] = [];

    for (const q of config.questions || []) {
      const question: ExtractedQuestion = {
        id: q.id,
        text: {},
        category: this.inferCategory(q),
        choices: [],
        correctChoice: '',
        difficulty: this.calculateDifficulty(q)
      };

      // Extract text for each language
      for (const [lang, data] of Object.entries(i18n)) {
        const langData = data as any;
        const qKey = q.questionKey.split('.')[0]; // "q1.question" -> "q1"

        if (langData.questions?.[qKey]?.question) {
          question.text[lang] = langData.questions[qKey].question;
        }
      }

      // Extract choices
      for (const choice of q.choices || []) {
        const choiceId = choice.id ?? choice.value;
        const extractedChoice: ExtractedChoice = {
          id: choiceId,
          text: {},
          assetPath: choice.assetPath,
          category: this.inferCategory(choice)
        };

        // Extract choice text for each language
        for (const [lang, data] of Object.entries(i18n)) {
          const langData = data as any;
          const qKey = q.questionKey.split('.')[0];
          const choiceKey = choice.textKey?.split('.').pop() ?? choiceId; // "q1.choices.apple" -> "apple"

          if (langData.questions?.[qKey]?.choices?.[choiceKey]) {
            extractedChoice.text[lang] = langData.questions[qKey].choices[choiceKey];
          } else if (langData.choices?.[choiceKey]) {
            extractedChoice.text[lang] = langData.choices[choiceKey];
          }
        }

        question.choices.push(extractedChoice);

        if (choice.correct ?? choice.isCorrect) {
          question.correctChoice = choiceId;
        }
      }

      questions.push(question);
    }

    return questions;
  }

  /**
   * Extract assets from game directory
   */
  private async extractAssets(gamePath: string): Promise<ExtractedAsset[]> {
    const assets: ExtractedAsset[] = [];
    const assetsPath = join(gamePath, 'assets');

    try {
      await stat(assetsPath);
      // TODO: Implement asset scanning
      // Would recursively scan assets directory for images and audio
    } catch {
      // Assets directory not found
    }

    return assets;
  }

  /**
   * Infer category from question/choice keys or content
   */
  private inferCategory(item: any): string {
    const key = (item.questionKey || item.textKey || item.value || '').toLowerCase();
    const assetPath = (item.assetPath || '').toLowerCase();

    // Check key patterns
    if (key.includes('fruit') || key.includes('apple') || key.includes('banana') ||
        key.includes('orange') || key.includes('grape') || key.includes('strawberry') ||
        assetPath.includes('fruit') || assetPath.includes('apple')) {
      return 'fruits';
    }

    if (key.includes('animal') || key.includes('dog') || key.includes('cat') ||
        key.includes('rabbit') || key.includes('bird') || key.includes('fish') ||
        assetPath.includes('animal') || assetPath.includes('dog')) {
      return 'animals';
    }

    if (key.includes('color') || key.includes('red') || key.includes('blue') ||
        key.includes('yellow') || key.includes('green') || key.includes('purple') ||
        assetPath.includes('color')) {
      return 'colors';
    }

    if (key.includes('shape') || key.includes('circle') || key.includes('square') ||
        key.includes('triangle') || key.includes('rectangle') ||
        assetPath.includes('shape')) {
      return 'shapes';
    }

    if (key.includes('number') || key.includes('count') || key.includes('one') ||
        key.includes('two') || key.includes('three') ||
        assetPath.includes('number')) {
      return 'numbers';
    }

    if (key.includes('letter') || key.includes('alphabet') ||
        assetPath.includes('letter')) {
      return 'letters';
    }

    return 'general';
  }

  /**
   * Calculate difficulty based on question complexity
   */
  private calculateDifficulty(question: any): number {
    const numChoices = question.choices?.length || 0;

    // Simple heuristic: more choices = harder
    if (numChoices <= 2) return 1;
    if (numChoices <= 3) return 2;
    return 3;
  }

  /**
   * Generate statistics for extracted data
   */
  private generateStatistics(
    questions: ExtractedQuestion[],
    assets: ExtractedAsset[]
  ): ExtractionStatistics {
    const categoryCounts: Record<string, number> = {};
    const languageCounts: Record<string, number> = {};
    const difficultyDistribution: Record<string, number> = { '1': 0, '2': 0, '3': 0 };

    for (const q of questions) {
      // Count categories
      categoryCounts[q.category] = (categoryCounts[q.category] || 0) + 1;

      // Count difficulty
      difficultyDistribution[q.difficulty] = (difficultyDistribution[q.difficulty] || 0) + 1;

      // Count languages
      for (const lang of Object.keys(q.text)) {
        languageCounts[lang] = (languageCounts[lang] || 0) + 1;
      }
    }

    return {
      totalQuestions: questions.length,
      totalChoices: questions.reduce((sum, q) => sum + q.choices.length, 0),
      totalAssets: assets.length,
      categoryCounts,
      languageCounts,
      difficultyDistribution
    };
  }

  /**
   * Generate summary statistics across all games
   */
  private generateSummaryStatistics(games: ExtractedGameData[]): any {
    const summary = {
      totalGames: games.length,
      totalQuestions: 0,
      totalChoices: 0,
      totalAssets: 0,
      categoryCounts: {} as Record<string, number>,
      languageCounts: {} as Record<string, number>,
      difficultyDistribution: { '1': 0, '2': 0, '3': 0 } as Record<string, number>,
      themes: {} as Record<string, number>
    };

    for (const game of games) {
      summary.totalQuestions += game.statistics.totalQuestions;
      summary.totalChoices += game.statistics.totalChoices;
      summary.totalAssets += game.statistics.totalAssets;

      // Aggregate categories
      for (const [cat, count] of Object.entries(game.statistics.categoryCounts)) {
        summary.categoryCounts[cat] = (summary.categoryCounts[cat] || 0) + count;
      }

      // Aggregate languages
      for (const [lang, count] of Object.entries(game.statistics.languageCounts)) {
        summary.languageCounts[lang] = (summary.languageCounts[lang] || 0) + count;
      }

      // Aggregate difficulty
      for (const [diff, count] of Object.entries(game.statistics.difficultyDistribution)) {
        summary.difficultyDistribution[diff] = (summary.difficultyDistribution[diff] || 0) + count;
      }

      // Count themes
      summary.themes[game.meta.theme] = (summary.themes[game.meta.theme] || 0) + 1;
    }

    return summary;
  }
}
