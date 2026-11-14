import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('renderer source layout', () => {
	const repoRoot = resolve(__dirname, '../../..');
	const rendererRoot = join(repoRoot, 'renderers');
	const templateRoot = join(repoRoot, 'templates');

	it('keeps renderer entries implemented inside renderer folders, not legacy template source folders', () => {
		const rendererIds = readRendererIds(rendererRoot);

		expect(rendererIds.length).toBeGreaterThan(0);

		for (const rendererId of rendererIds) {
			const rendererDir = join(rendererRoot, rendererId);
			const metadata = readJson(join(rendererDir, 'renderer.json')) as { entry?: string };
			const entry = metadata.entry ?? 'src/template.ts';
			const entryPath = join(rendererDir, entry);
			const entrySource = readFileSync(entryPath, 'utf8');

			expect(existsSync(entryPath), `${rendererId} entry should exist under renderers`).toBe(true);
			expect(entrySource, `${rendererId} should not re-export legacy template source`).not.toContain('../../../templates/');
			expect(existsSync(join(templateRoot, rendererId, 'src')), `${rendererId} legacy template source folder should be removed`).toBe(false);
		}
	});

	it('preload scenes resolve assets through the shared Activity asset manifest pins', () => {
		for (const rendererId of readRendererIds(rendererRoot)) {
			const rendererDir = join(rendererRoot, rendererId);
			const sources = readFiles(rendererDir, '.ts');
			for (const [filePath, source] of sources) {
				expect(source, `${filePath} should not load pruned per-Activity assets directly`).not.toContain('resolvePreviewPath(`assets/');
				expect(source, `${filePath} should not load pruned placeholder audio directly`).not.toContain('assets/audio/placeholder');
			}
		}
	});

	it('keeps persistent player chrome out of renderer scenes', () => {
		for (const rendererId of readRendererIds(rendererRoot)) {
			const rendererDir = join(rendererRoot, rendererId);
			for (const [filePath, source] of readFiles(rendererDir, '.ts')) {
				expect(source, `${filePath} should not instantiate host-owned player chrome`).not.toContain('BottomNavbar');
			}
		}
	});

	it('unsubscribes host control listeners from Phaser scene shutdown', () => {
		for (const rendererId of readRendererIds(rendererRoot)) {
			const rendererDir = join(rendererRoot, rendererId);
			for (const [filePath, source] of readFiles(rendererDir, '.ts')) {
				if (!source.includes('GameManager.EVENTS.CONTROL_')) continue;

				expect(
					source,
					`${filePath} registers host control listeners and should clean them up via the Phaser shutdown event`,
				).toMatch(/events\.once\(['"]shutdown['"],\s*this\.shutdown,\s*this\)/);
			}
		}
	});

	it('declares the config game type accepted by each renderer default Activity', () => {
		for (const rendererId of readRendererIds(rendererRoot)) {
			const renderer = readJson(join(rendererRoot, rendererId, 'renderer.json')) as {
				configGameType?: string;
				defaultGameId?: string;
			};
			expect(renderer.configGameType, `${rendererId} should declare configGameType`).toEqual(expect.any(String));
			expect(renderer.defaultGameId, `${rendererId} should declare defaultGameId`).toEqual(expect.any(String));

			const activity = readJson(join(repoRoot, 'activities', renderer.defaultGameId!, 'activity.json')) as { version: number };
			const config = readJson(join(repoRoot, 'activities', renderer.defaultGameId!, 'versions', String(activity.version), 'config.json')) as {
				meta?: { gameType?: string };
			};

			expect(config.meta?.gameType, `${rendererId} configGameType should match its default Activity`).toBe(renderer.configGameType);
		}
	});
});

function readRendererIds(rendererRoot: string): string[] {
	return readdirSync(rendererRoot)
		.filter((entry) => statSync(join(rendererRoot, entry)).isDirectory())
		.sort();
}

function readJson(filePath: string): unknown {
	return JSON.parse(readFileSync(filePath, 'utf8'));
}

function readFiles(dir: string, extension: string): Array<[string, string]> {
	const files: Array<[string, string]> = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...readFiles(fullPath, extension));
		} else if (entry.isFile() && fullPath.endsWith(extension)) {
			files.push([fullPath, readFileSync(fullPath, 'utf8')]);
		}
	}
	return files;
}
