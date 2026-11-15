const fs = require('fs');
const path = require('path');
const { readActivityPackage, assertValidActivityPackage } = require('../../../scripts/lib/activity-package.cjs');

function generateActivityHostFiles(options = {}) {
    const repoRoot = path.resolve(options.repoRoot ?? path.resolve(__dirname, '../../..'));
    const outputDir = path.resolve(options.outputDir ?? path.join(repoRoot, 'packages/game-core/host/generated'));
    const hostConfig = loadActivityHostConfig(repoRoot, options);
    const activityRoot = path.join(repoRoot, 'activities');

    const renderers = hostConfig.rendererRoots.flatMap((rendererRoot) => discoverRenderers(path.resolve(repoRoot, rendererRoot), repoRoot, hostConfig.exclude));
    const activities = discoverActivities(activityRoot);
    validateCatalog({ renderers, activities });

    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(
        path.join(outputDir, 'activityHostCatalog.generated.ts'),
        renderActivityCatalogSource({ activities, renderers })
    );
    fs.writeFileSync(
        path.join(outputDir, 'rendererLoaders.generated.ts'),
        renderRendererLoadersSource({ renderers, outputDir })
    );
}

function loadActivityHostConfig(repoRoot, options) {
    if (Array.isArray(options.rendererRoots) && options.rendererRoots.length > 0) {
        return { rendererRoots: options.rendererRoots, exclude: normalizeExclude(options.exclude) };
    }

    const configPath = path.join(repoRoot, 'activity-host.config.json');
    if (fs.existsSync(configPath)) {
        const config = readJson(configPath);
        if (Array.isArray(config.rendererRoots) && config.rendererRoots.length > 0) {
            return { rendererRoots: config.rendererRoots, exclude: normalizeExclude(config.exclude) };
        }
    }

    return { rendererRoots: ['renderers'], exclude: [] };
}

function normalizeExclude(exclude) {
    return Array.isArray(exclude) ? exclude.filter((entry) => typeof entry === 'string' && entry.length > 0) : [];
}

function discoverRenderers(rendererRoot, repoRoot, exclude = []) {
    if (!fs.existsSync(rendererRoot)) {
        return [];
    }

    return fs.readdirSync(rendererRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(rendererRoot, entry.name))
        .filter((rendererDir) => !isExcluded(rendererDir, repoRoot, exclude))
        .map((rendererDir) => {
            const metadata = readJson(path.join(rendererDir, 'renderer.json'));
            return {
                rendererId: metadata.rendererId,
                version: metadata.version,
                defaultGameId: metadata.defaultGameId,
                entry: metadata.entry ?? 'src/template.ts',
                basePath: metadata.basePath,
                rendererDir,
            };
        })
        .sort((left, right) => left.rendererId.localeCompare(right.rendererId));
}

function isExcluded(targetPath, repoRoot, exclude) {
    const relativePath = path.relative(repoRoot, targetPath).replace(/\\/g, '/');
    return exclude.some((pattern) => matchesSimpleGlob(relativePath, pattern));
}

function matchesSimpleGlob(relativePath, pattern) {
    const normalizedPattern = pattern.replace(/\\/g, '/');
    if (normalizedPattern === '**/_experimental/**') {
        return relativePath === '_experimental' || relativePath.includes('/_experimental') || relativePath.startsWith('_experimental/');
    }
    if (normalizedPattern.endsWith('/**')) {
        const prefix = normalizedPattern.slice(0, -3).replace(/^\*\*\//, '');
        return relativePath === prefix || relativePath.includes(`/${prefix}`) || relativePath.startsWith(`${prefix}/`);
    }
    return relativePath === normalizedPattern;
}

function discoverActivities(activityRoot) {
    if (!fs.existsSync(activityRoot)) {
        return [];
    }

    return fs.readdirSync(activityRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .flatMap((entry) => readActivityVersions(activityRoot, entry.name))
        .sort((left, right) => left.activityId.localeCompare(right.activityId) || left.version - right.version);
}

function readActivityVersions(activityRoot, folderName) {
    const result = assertValidActivityPackage(readActivityPackage(path.join(activityRoot, folderName), path.dirname(activityRoot)));
    return result.versions.map(({ version }) => ({
        ...result.activity,
        version,
        basePath: `/activities/${encodePathSegment(result.activity.activityId)}/versions/${version}`,
    }));
}

function validateCatalog({ renderers, activities }) {
    const rendererIds = new Set();
    for (const renderer of renderers) {
        requireString(renderer.rendererId, 'renderer.rendererId');
        requireString(renderer.defaultGameId, `${renderer.rendererId}.defaultGameId`);
        requireString(renderer.entry, `${renderer.rendererId}.entry`);
        if (rendererIds.has(renderer.rendererId)) {
            throw new Error(`Duplicate renderer id: ${renderer.rendererId}`);
        }
        rendererIds.add(renderer.rendererId);
    }

    const activityKeys = new Set();
    for (const activity of activities) {
        requireString(activity.activityId, 'activity.activityId');
        requireNumber(activity.version, `${activity.activityId}.version`);
        requireString(activity.renderer?.id, `${activity.activityId}.renderer.id`);
        requireString(activity.renderer?.version, `${activity.activityId}.renderer.version`);
        requireString(activity.gameId, `${activity.activityId}.gameId`);

        const key = `${activity.activityId}@${activity.version}`;
        if (activityKeys.has(key)) {
            throw new Error(`Duplicate activity version: ${key}`);
        }
        activityKeys.add(key);

        if (!rendererIds.has(activity.renderer.id)) {
            throw new Error(`Activity ${key} references unknown renderer: ${activity.renderer.id}`);
        }
    }
}

function renderActivityCatalogSource({ activities, renderers }) {
    const activityEntries = activities.map((activity) => `\n\t\t{\n\t\t\tactivityId: '${escapeString(activity.activityId)}',\n\t\t\tversion: ${activity.version},\n\t\t\trenderer: { id: '${escapeString(activity.renderer.id)}', version: '${escapeString(activity.renderer.version)}' },\n\t\t\tgameId: '${escapeString(activity.gameId)}',${optionalStringProperty('basePath', activity.basePath)}${optionalStringProperty('configUrl', activity.configUrl)}\n\t\t}`).join(',');
    const rendererEntries = renderers.map((renderer) => {
        const defaultActivity = findDefaultActivityForRenderer(activities, renderer);
        const basePath = defaultActivity?.basePath ?? renderer.basePath;
        return `\n\t\t{\n\t\t\trendererId: '${escapeString(renderer.rendererId)}',\n\t\t\tdefaultGameId: '${escapeString(renderer.defaultGameId)}',${optionalStringProperty('basePath', basePath)}\n\t\t}`;
    }).join(',');

    return `// Generated by packages/game-core/scripts/activityHostCatalogGenerator.js. Do not edit by hand.\nimport type { ActivityHostCatalog } from '../../src/host/activityHostRoutes';\n\nexport const activityHostCatalog: ActivityHostCatalog = {\n\tactivities: [${activityEntries}\n\t],\n\trenderers: [${rendererEntries}\n\t],\n};\n`;
}

function renderRendererLoadersSource({ renderers, outputDir }) {
    const entries = renderers.map((renderer) => {
        const importPath = toImportPath(path.relative(outputDir, path.join(renderer.rendererDir, renderer.entry)));
        return `\n\t'${escapeString(renderer.rendererId)}': async () => {\n\t\tconst renderer = await import('${importPath}');\n\t\treturn renderer.default ?? renderer.template ?? renderer.${toIdentifier(renderer.rendererId)}Template;\n\t}`;
    }).join(',');

    return `// Generated by packages/game-core/scripts/activityHostCatalogGenerator.js. Do not edit by hand.\nimport type { GameTemplateDefinition } from '../../src/templates/GameTemplateRuntime';\n\nexport const rendererLoaders: Record<string, () => Promise<GameTemplateDefinition>> = {${entries}\n};\n`;
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function findDefaultActivityForRenderer(activities, renderer) {
    return latestActivity(activities.filter((activity) => activity.renderer.id === renderer.rendererId && activity.gameId === renderer.defaultGameId))
        ?? latestActivity(activities.filter((activity) => activity.renderer.id === renderer.rendererId));
}

function latestActivity(activities) {
    return [...activities].sort((left, right) => right.version - left.version)[0];
}

function optionalStringProperty(name, value) {
    return typeof value === 'string' ? `\n\t\t\t${name}: '${escapeString(value)}',` : '';
}

function requireString(value, label) {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`Missing ${label}`);
    }
}

function formatZodError(error) {
    return JSON.stringify(error.format());
}

function requireNumber(value, label) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`Missing ${label}`);
    }
}

function escapeString(value) {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function encodePathSegment(value) {
    return encodeURIComponent(value).replace(/'/g, '%27');
}

function toImportPath(relativePath) {
    const normalized = relativePath.replace(/\\/g, '/').replace(/\.tsx?$/, '');
    return normalized.startsWith('.') ? normalized : `./${normalized}`;
}

function toIdentifier(value) {
    return value.replace(/(^|[-_])(\w)/g, (_match, _separator, character) => character.toUpperCase()).replace(/^\w/, (character) => character.toLowerCase());
}

if (require.main === module) {
    generateActivityHostFiles();
}

module.exports = {
    generateActivityHostFiles,
    discoverRenderers,
    discoverActivities,
};
