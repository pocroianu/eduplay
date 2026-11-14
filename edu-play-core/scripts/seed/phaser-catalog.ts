import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

import { seedUuid } from './ids';
import type { SeedTierData } from './types';

export interface SeedActivity {
  id: string;
  versionId: string;
  typeId: string;
  rendererKey: string;
  sourceActivityId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  targetAgeMin: number;
  targetAgeMax: number;
  estimatedDuration: number;
  questionCount: number | null;
  tags: string[];
  subject: string;
  skills: string[];
  configData: unknown;
  schemaVersion: number;
  templateLabel: string;
  templateWorkspace: string;
  configPath: string;
}

interface TemplateRegistryEntry {
  id: string;
  label: string;
  gameType: string;
  workspace: string;
  defaultGameId?: string;
}

interface RendererMetadata {
  rendererId: string;
  version?: string;
  defaultGameId?: string;
  entry?: string;
  configGameType?: string;
}

interface ActivityPackageMetadata {
  activityId: string;
  version: number;
  renderer: {
    id: string;
    version: string;
  };
  gameId: string;
}

interface GameStrings {
  meta?: {
    title?: string;
    description?: string;
  };
}

const ACTIVITY_HOST_RENDERER_KEY = 'activity-host';

const MEDIUM_SELECTION: Array<{ template: string; sourceActivityId: string }> = [
  { template: 'multiple-choice', sourceActivityId: 'fruits-01' },
  { template: 'matching-game', sourceActivityId: 'animals-match-01' },
  { template: 'categorize-game', sourceActivityId: 'animals-habitat-01' },
  { template: 'sequence-order', sourceActivityId: 'numbers-1-to-6' },
  { template: 'memory-game', sourceActivityId: 'animals-memory-01' },
  { template: 'tracing-game', sourceActivityId: 'uppercase-a-to-f' },
  { template: 'counting-game', sourceActivityId: 'farm-count-01' },
  { template: 'pattern-game', sourceActivityId: 'shapes-pattern-01' },
  { template: 'repeat-sequence', sourceActivityId: 'colours-sequence-01' },
  { template: 'listen-tap', sourceActivityId: 'phonics-ro-01' },
];

const MINIMAL_SELECTION = [MEDIUM_SELECTION[0]];

export function resolvePhaserRoot(): string {
  return path.resolve(process.cwd(), '..', 'phaser-projects');
}

export function getTierSelection(
  tier: SeedTierData['tier'],
  phaserRoot = resolvePhaserRoot(),
): Array<{ template: string; sourceActivityId: string }> {
  if (tier === 'minimal') return MINIMAL_SELECTION;
  if (tier === 'medium') return MEDIUM_SELECTION;

  return discoverActivityPackages(phaserRoot).map((activity) => ({
    template: activity.renderer.id,
    sourceActivityId: activity.activityId,
  }));
}

export function loadSeedActivities(
  tier: SeedTierData['tier'],
  options: { phaserRoot?: string } = {},
): SeedActivity[] {
  const phaserRoot = options.phaserRoot ?? resolvePhaserRoot();
  assertDirectory(phaserRoot, 'phaser-projects checkout');

  const registry = readTemplateRegistry(phaserRoot);
  const selection = getTierSelection(tier, phaserRoot);
  const validator = loadPhaserConfigValidator(phaserRoot);

  return selection.map(({ template, sourceActivityId }) => {
    const templateEntry = registry.get(template);
    if (!templateEntry) {
      throw new Error(`Selected Activity uses unknown Renderer "${template}"`);
    }

    const activityPackage = readActivityPackage(phaserRoot, sourceActivityId);
    if (activityPackage.renderer.id !== template) {
      throw new Error(
        `Phaser Activity renderer mismatch ${sourceActivityId}: selection expected "${template}", ` +
        `activity.json declares "${activityPackage.renderer.id}"`,
      );
    }

    const configPath = activityConfigPath(phaserRoot, sourceActivityId, activityPackage.version);
    const configData = readJson(configPath);
    validatePhaserConfig(validator, configData, configPath, template, sourceActivityId);
    assertConfigMatchesRenderer(configData, templateEntry, configPath, template, sourceActivityId);

    const strings = readPreferredStrings(phaserRoot, sourceActivityId, activityPackage.version);
    const title = strings.meta?.title ?? sourceActivityId;
    const description = strings.meta?.description ?? null;
    const tags = uniqueStrings(['seed:baseline', template, sourceActivityId, ...inferTags(sourceActivityId, configData)]);

    return {
      id: seedUuid(`baseline:activity:${template}:${sourceActivityId}`),
      versionId: seedUuid(`baseline:activity-version:${template}:${sourceActivityId}:${activityPackage.version}`),
      typeId: template,
      rendererKey: ACTIVITY_HOST_RENDERER_KEY,
      sourceActivityId,
      title,
      description,
      thumbnailUrl: null,
      category: inferCategory(tags, templateEntry.gameType),
      difficulty: getDifficulty(configData),
      targetAgeMin: 3,
      targetAgeMax: 8,
      estimatedDuration: 5,
      questionCount: getTotalSteps(configData),
      tags,
      subject: inferSubject(tags),
      skills: inferSkills(tags, title),
      configData,
      schemaVersion: 1,
      templateLabel: templateEntry.label,
      templateWorkspace: templateEntry.workspace,
      configPath,
    };
  });
}

function getSelectedTemplates(activities: readonly SeedActivity[]): string[] {
  return [...new Set(activities.map((activity) => activity.typeId))];
}

function getActivityHostRendererKey(): string {
  return ACTIVITY_HOST_RENDERER_KEY;
}

function readTemplateRegistry(phaserRoot: string): Map<string, TemplateRegistryEntry> {
  const legacyTemplates = readLegacyTemplateRegistry(phaserRoot);
  const rendererRoot = path.join(phaserRoot, 'renderers');
  assertDirectory(rendererRoot, 'Phaser renderer directory');

  const entries = fs.readdirSync(rendererRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const metadata = readJson(path.join(rendererRoot, entry.name, 'renderer.json')) as RendererMetadata;
      if (!metadata.rendererId) {
        throw new Error(`Invalid Phaser renderer metadata: ${path.join(rendererRoot, entry.name, 'renderer.json')}`);
      }
      const legacy = legacyTemplates.get(metadata.rendererId);
      return [
        metadata.rendererId,
        {
          id: metadata.rendererId,
          label: legacy?.label ?? humanizeId(metadata.rendererId),
          gameType: metadata.configGameType ?? legacy?.gameType ?? metadata.rendererId,
          workspace: '@edu-play/game-core',
          defaultGameId: metadata.defaultGameId ?? legacy?.defaultGameId,
        },
      ] as const;
    });

  return new Map(entries);
}

function readLegacyTemplateRegistry(phaserRoot: string): Map<string, Partial<TemplateRegistryEntry>> {
  const registryPath = path.join(phaserRoot, 'packages', 'game-core', 'templates', 'registry.json');
  if (!fs.existsSync(registryPath)) return new Map();

  const registry = readJson(registryPath) as {
    templates?: Array<{ id: string; label?: string; gameType?: string; defaultGameId?: string }>;
  };
  return new Map(
    (registry.templates ?? []).map((entry) => [
      entry.id,
      {
        label: entry.label,
        gameType: entry.gameType,
        defaultGameId: entry.defaultGameId,
      },
    ]),
  );
}

function discoverActivityPackages(phaserRoot: string): ActivityPackageMetadata[] {
  const activitiesRoot = path.join(phaserRoot, 'activities');
  assertDirectory(activitiesRoot, 'Phaser activities directory');

  return fs.readdirSync(activitiesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readActivityPackage(phaserRoot, entry.name))
    .sort((left, right) => left.activityId.localeCompare(right.activityId));
}

function readActivityPackage(phaserRoot: string, sourceActivityId: string): ActivityPackageMetadata {
  const metadataPath = path.join(phaserRoot, 'activities', sourceActivityId, 'activity.json');
  const metadata = readJson(metadataPath) as ActivityPackageMetadata;
  if (!metadata.activityId || typeof metadata.version !== 'number' || !metadata.renderer?.id || !metadata.gameId) {
    throw new Error(`Invalid Phaser Activity metadata: ${metadataPath}`);
  }
  if (metadata.activityId !== sourceActivityId) {
    throw new Error(`Phaser Activity folder/id mismatch: ${sourceActivityId} contains ${metadata.activityId}`);
  }
  return metadata;
}

function activityConfigPath(phaserRoot: string, sourceActivityId: string, version: number): string {
  return path.join(
    phaserRoot,
    'activities',
    sourceActivityId,
    'versions',
    String(version),
    'config.json',
  );
}

function readPreferredStrings(phaserRoot: string, sourceActivityId: string, version: number): GameStrings {
  const stringsDir = path.join(phaserRoot, 'activities', sourceActivityId, 'versions', String(version), 'strings');
  const preferred = path.join(stringsDir, 'ro.json');
  const fallback = path.join(stringsDir, 'en.json');
  const stringsPath = fs.existsSync(preferred) ? preferred : fallback;
  return readJson(stringsPath) as GameStrings;
}

function readJson(filePath: string): unknown {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required Phaser seed file: ${filePath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    throw new Error(`Failed to parse JSON at ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertDirectory(dir: string, label: string): void {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`Missing ${label}: ${dir}`);
  }
}

function loadPhaserConfigValidator(phaserRoot: string): (data: unknown) => unknown {
  const validationEntry = path.join(phaserRoot, 'packages', 'validation', 'dist', 'index.js');
  if (!fs.existsSync(validationEntry)) {
    throw new Error(
      `Missing Phaser validation build: ${validationEntry}. Run npm run build --workspace=@edu-play/validation in phaser-projects.`,
    );
  }
  const require = createRequire(import.meta.url);
  const mod = require(validationEntry) as { parseGameConfig?: (data: unknown) => unknown };
  if (typeof mod.parseGameConfig !== 'function') {
    throw new Error(`Phaser validation build does not export parseGameConfig: ${validationEntry}`);
  }
  return mod.parseGameConfig;
}

function validatePhaserConfig(
  parseGameConfig: (data: unknown) => unknown,
  configData: unknown,
  configPath: string,
  template: string,
  sourceActivityId: string,
): void {
  const result = parseGameConfig(configData) as {
    success: boolean;
    error?: { issues?: Array<{ path: Array<string | number>; message: string }> };
  };
  if (result.success) return;

  const issues = result.error?.issues ?? [];
  const formatted = issues.length
    ? issues.map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`).join('\n')
    : '  - Unknown validation error';
  throw new Error(
    `Invalid Phaser Activity config ${template}/${sourceActivityId}\nPath: ${configPath}\n${formatted}`,
  );
}

function assertConfigMatchesRenderer(
  configData: unknown,
  templateEntry: TemplateRegistryEntry,
  configPath: string,
  template: string,
  sourceActivityId: string,
): void {
  if (typeof configData !== 'object' || configData === null || Array.isArray(configData)) return;
  const meta = (configData as { meta?: unknown }).meta;
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return;
  const rawGameType = (meta as { gameType?: unknown }).gameType;
  if (typeof rawGameType !== 'string') return;
  if (rawGameType !== templateEntry.gameType) {
    throw new Error(
      `Phaser Activity config renderer mismatch ${template}/${sourceActivityId}\n` +
      `Path: ${configPath}\n` +
      `  - expected meta.gameType "${templateEntry.gameType}" for Renderer "${template}", got "${rawGameType}"`,
    );
  }
}

function getDifficulty(configData: unknown): 'easy' | 'medium' | 'hard' {
  if (typeof configData !== 'object' || configData === null || Array.isArray(configData)) return 'easy';
  const meta = (configData as { meta?: unknown }).meta;
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return 'easy';
  const value = (meta as { difficulty?: unknown }).difficulty;
  return value === 'medium' || value === 'hard' ? value : 'easy';
}

function getTotalSteps(configData: unknown): number | null {
  if (typeof configData !== 'object' || configData === null || Array.isArray(configData)) return null;
  const meta = (configData as { meta?: unknown }).meta;
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return null;
  const totalSteps = (meta as { totalSteps?: unknown }).totalSteps;
  return typeof totalSteps === 'number' ? totalSteps : null;
}

function inferTags(sourceActivityId: string, configData: unknown): string[] {
  const haystack = `${sourceActivityId} ${getGameType(configData)}`.toLowerCase();
  const tags: string[] = [];
  for (const tag of ['animals', 'food', 'fruits', 'objects', 'nature', 'numbers', 'counting', 'colors', 'colours', 'shapes', 'phonics', 'letters']) {
    if (haystack.includes(tag)) tags.push(tag);
  }
  return tags;
}

function getGameType(configData: unknown): string {
  if (typeof configData !== 'object' || configData === null || Array.isArray(configData)) return '';
  const meta = (configData as { meta?: unknown }).meta;
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return '';
  const gameType = (meta as { gameType?: unknown }).gameType;
  return typeof gameType === 'string' ? gameType : '';
}

function inferCategory(tags: string[] | undefined, rendererType: string): string {
  const values = new Set(tags ?? []);
  if (values.has('phonics') || values.has('letters')) return 'phonics';
  if (values.has('numbers') || values.has('counting')) return 'math';
  if (values.has('colors') || values.has('colours') || values.has('shapes')) return 'colors';
  if (values.has('animals') || values.has('food') || values.has('fruits') || values.has('vocabulary')) return 'vocabulary';
  if (rendererType === 'tracing') return 'literacy';
  return 'vocabulary';
}

function inferSubject(tags: string[] | undefined): string {
  const values = new Set(tags ?? []);
  if (values.has('numbers') || values.has('counting')) return 'math';
  return 'romanian';
}

function inferSkills(tags: string[] | undefined, title: string): string[] {
  const values = new Set(tags ?? []);
  if (values.has('phonics') || values.has('letters')) return ['recunoașterea literelor', 'ascultare activă'];
  if (values.has('numbers') || values.has('counting')) return ['numărare', 'recunoașterea numerelor'];
  if (values.has('shapes')) return ['recunoașterea formelor'];
  if (values.has('animals')) return ['vocabular despre animale'];
  if (values.has('food') || values.has('fruits')) return ['vocabular alimentar'];
  return [`Activitate: ${title}`];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function humanizeId(value: string): string {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
