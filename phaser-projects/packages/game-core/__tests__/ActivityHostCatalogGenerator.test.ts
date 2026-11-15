import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { generateActivityHostFiles } = require('../scripts/activityHostCatalogGenerator.js');

describe('activity host catalog generator', () => {
	it('writes generated activity catalog and lazy renderer loader files from self-describing folders', () => {
		const repoRoot = createCatalogFixture();
		writeRenderer(repoRoot);
		writeActivity(repoRoot, 'fruits-01');
		writeActivityVersionContent(repoRoot, 'fruits-01', 1);
		const outputDir = join(repoRoot, 'packages/game-core/host/generated');

		generateActivityHostFiles({ repoRoot, outputDir });

		const catalogSource = readFileSync(join(outputDir, 'activityHostCatalog.generated.ts'), 'utf8');
		expect(catalogSource).toContain("activityId: 'fruits-01'");
		expect(catalogSource).toContain("basePath: '/activities/fruits-01/versions/1'");
		expect(catalogSource).not.toContain('contentLayout');
		expect(catalogSource).not.toContain('__renderer_static');
		expect(readFileSync(join(outputDir, 'rendererLoaders.generated.ts'), 'utf8')).toContain("import('../../../../renderers/multiple-choice/src/template')");
	});

	it('discovers renderers from configured renderer roots', () => {
		const repoRoot = createCatalogFixture();
		writeRenderer(repoRoot, { rendererId: 'custom-choice', defaultGameId: 'fruits-01' }, 'custom-renderers');
		writeActivity(repoRoot, 'fruits-01', { renderer: { id: 'custom-choice', version: '^1.0.0' } });
		writeActivityVersionContent(repoRoot, 'fruits-01', 1);
		mkdirSync(join(repoRoot, 'custom-renderers', '_experimental'), { recursive: true });
		writeFileSync(join(repoRoot, 'activity-host.config.json'), JSON.stringify({
			rendererRoots: ['custom-renderers'],
			exclude: ['**/_experimental/**']
		}));
		const outputDir = join(repoRoot, 'packages/game-core/host/generated');

		generateActivityHostFiles({ repoRoot, outputDir });

		const loadersSource = readFileSync(join(outputDir, 'rendererLoaders.generated.ts'), 'utf8');
		expect(loadersSource).toContain("'custom-choice'");
		expect(loadersSource).toContain("import('../../../../custom-renderers/custom-choice/src/template')");
	});

	it('publishes every immutable Activity version directory for exact version routes', () => {
		const repoRoot = createCatalogFixture();
		writeRenderer(repoRoot);
		writeActivity(repoRoot, 'fruits-01', { version: 2 });
		writeActivityVersionContent(repoRoot, 'fruits-01', 1);
		writeActivityVersionContent(repoRoot, 'fruits-01', 2);
		const outputDir = join(repoRoot, 'packages/game-core/host/generated');

		generateActivityHostFiles({ repoRoot, outputDir });

		const catalogSource = readFileSync(join(outputDir, 'activityHostCatalog.generated.ts'), 'utf8');
		expect(catalogSource).toContain('version: 1');
		expect(catalogSource).toContain("basePath: '/activities/fruits-01/versions/1'");
		expect(catalogSource).toContain('version: 2');
		expect(catalogSource).toContain("basePath: '/activities/fruits-01/versions/2'");
		expect(catalogSource).toContain("rendererId: 'multiple-choice',\n\t\t\tdefaultGameId: 'fruits-01',\n\t\t\tbasePath: '/activities/fruits-01/versions/2'");
	});

    it('rejects an invalid older immutable config even when the selected version is valid', () => {
        const repoRoot = createCatalogFixture();
        writeRenderer(repoRoot);
        writeActivity(repoRoot, 'fruits-01', { version: 2 });
        writeActivityVersionContent(repoRoot, 'fruits-01', 1);
        writeActivityVersionContent(repoRoot, 'fruits-01', 2);
        writeFileSync(join(repoRoot, 'activities/fruits-01/versions/1/config.json'), '{}');
        expect(() => generateActivityHostFiles({ repoRoot })).toThrow('Invalid activity config for fruits-01@1');
    });

	it('rejects duplicate activity versions across activity folders', () => {
		const repoRoot = createCatalogFixture();
		writeRenderer(repoRoot);
		writeActivity(repoRoot, 'fruits-01');
		writeActivity(repoRoot, 'fruits-copy', { activityId: 'fruits-01' });
		writeActivityVersionContent(repoRoot, 'fruits-01', 1);
		writeActivityVersionContent(repoRoot, 'fruits-copy', 1, { gameId: 'fruits-01' });

		expect(() => generateActivityHostFiles({ repoRoot })).toThrow('Duplicate activity version: fruits-01@1');
	});

	it('rejects activities that reference an unknown renderer', () => {
		const repoRoot = createCatalogFixture();
		writeRenderer(repoRoot, { rendererId: 'multiple-choice' });
		writeActivity(repoRoot, 'fruits-01', {
			renderer: { id: 'missing-renderer', version: '^1.0.0' },
		});
		writeActivityVersionContent(repoRoot, 'fruits-01', 1);

		expect(() => generateActivityHostFiles({ repoRoot })).toThrow('Activity fruits-01@1 references unknown renderer: missing-renderer');
	});

	it('rejects activities without versioned content instead of falling back to root paths', () => {
		const repoRoot = createCatalogFixture();
		writeRenderer(repoRoot);
		writeActivity(repoRoot, 'fruits-01');

		expect(() => generateActivityHostFiles({ repoRoot })).toThrow('Missing activity version content: fruits-01@1');
	});

	it('rejects invalid activity metadata with schema diagnostics', () => {
		const repoRoot = createCatalogFixture();
		writeRenderer(repoRoot);
		writeActivity(repoRoot, 'fruits-01', {
			version: 'latest',
			renderer: { id: 'multiple-choice', version: 'latest' },
		});

		expect(() => generateActivityHostFiles({ repoRoot })).toThrow('Invalid activity metadata');
	});

	it('rejects invalid Activity-version asset manifests', () => {
		const repoRoot = createCatalogFixture();
		writeRenderer(repoRoot);
		writeActivity(repoRoot, 'fruits-01');
		writeActivityVersionContent(repoRoot, 'fruits-01', 1, { assets: { version: '2.0.0', baseUrl: 'assets', pinnedAssets: {} } });

		expect(() => generateActivityHostFiles({ repoRoot })).toThrow('Invalid activity asset manifest for fruits-01@1');
	});

	it('rejects selected Activity game asset keys without immutable pins', () => {
		const repoRoot = createCatalogFixture();
		writeRenderer(repoRoot);
		writeActivity(repoRoot, 'fruits-01');
		writeActivityVersionContent(repoRoot, 'fruits-01', 1, {
			assets: {
				version: '2.0.0',
				baseUrl: 'assets',
				pinnedAssets: {},
				games: {
					'fruits-01': {
						manifest: { images: ['apple'], audio: [], spritesheets: [] }
					}
				}
			}
		});

		expect(() => generateActivityHostFiles({ repoRoot })).toThrow('games.fruits-01.manifest.images.apple is missing an image pin');
	});
});

function createCatalogFixture(): string {
	return mkdtempSync(join(tmpdir(), 'activity-host-generator-'));
}

function writeRenderer(repoRoot: string, overrides: Record<string, unknown> = {}, rootName = 'renderers'): void {
	const renderer = {
		rendererId: 'multiple-choice',
		version: '1.0.0',
		defaultGameId: 'fruits-01',
		entry: 'src/template.ts',
		basePath: '/',
		...overrides,
	};
	const rendererDir = join(repoRoot, rootName, String(renderer.rendererId));
	mkdirSync(join(rendererDir, 'src'), { recursive: true });
	writeFileSync(join(rendererDir, 'renderer.json'), JSON.stringify(renderer));
}

function writeActivity(repoRoot: string, folderName: string, overrides: Record<string, unknown> = {}): void {
	const activity = {
		activityId: 'fruits-01',
		version: 1,
		renderer: { id: 'multiple-choice', version: '^1.0.0' },
		gameId: 'fruits-01',
		...overrides,
	};
	const activityDir = join(repoRoot, 'activities', folderName);
	mkdirSync(activityDir, { recursive: true });
	writeFileSync(join(activityDir, 'activity.json'), JSON.stringify(activity));
}

function writeActivityVersionContent(
	repoRoot: string,
	activityId: string,
	version: number,
	overrides: { assets?: unknown; gameId?: string } = {}
): void {
	const versionDir = join(repoRoot, 'activities', activityId, 'versions', String(version));
	mkdirSync(versionDir, { recursive: true });
	writeFileSync(join(versionDir, 'config.json'), JSON.stringify({
        meta: { gameId: overrides.gameId ?? activityId, version: '1.0.0', gameType: 'multipleChoice', totalSteps: 1, supportedLanguages: ['en'] },
        questions: [{ id: 'q1', questionKey: 'q1', choices: [
            { type: 'image', value: 'a', isCorrect: true }, { type: 'image', value: 'b', isCorrect: false },
        ] }],
    }));
    mkdirSync(join(versionDir, 'strings'), { recursive: true });
    writeFileSync(join(versionDir, 'strings/en.json'), JSON.stringify({ meta: { title: 'Fixture' } }));
	writeFileSync(join(versionDir, 'assets.json'), JSON.stringify(overrides.assets ?? {
		version: '2.0.0',
		baseUrl: 'assets',
		pinnedAssets: {},
		games: {
			[overrides.gameId ?? activityId]: {
				manifest: { images: [], audio: [], spritesheets: [] }
			}
		}
	}));
}
