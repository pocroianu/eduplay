const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

function loadSchemas() {
  try {
    return require('@edu-play/validation');
  } catch {
    require('ts-node/register');
    return require('../../packages/validation/src');
  }
}

const schemas = loadSchemas();

/** Read and validate the same package layout for publishing, importing and CI. */
function readActivityPackage(activityRoot, libraryRoot) {
  const diagnostics = [];
  const files = [];

  function read(file, kind, parser) {
    files.push({ file, kind });
    try {
      const result = parser(JSON.parse(fs.readFileSync(file, 'utf8')));
      if (!result.success) throw new Error(JSON.stringify(result.error.format()));
      return result.data;
    } catch (error) {
      diagnostics.push({ file, kind, message: error.message });
      return null;
    }
  }

  const activity = read(path.join(activityRoot, 'activity.json'), 'metadata', schemas.activityMetadataSchema.safeParse);
  if (!activity) return { activity, versions: [], diagnostics, files };
  for (const key of ['activityId', 'gameId']) {
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(activity[key])) {
      diagnostics.push({ file: path.join(activityRoot, 'activity.json'), kind: 'metadata', message: `Invalid ${key}: expected a safe slug` });
    }
  }
  const versionsRoot = path.join(activityRoot, 'versions');
  const entries = fs.existsSync(versionsRoot) ? fs.readdirSync(versionsRoot, { withFileTypes: true }) : [];
  const versionNumbers = entries.filter(entry => entry.isDirectory() && /^[1-9]\d*$/.test(entry.name))
    .map(entry => Number(entry.name)).sort((a, b) => a - b);
  if (!versionNumbers.includes(activity.version)) {
    diagnostics.push({ file: versionsRoot, kind: 'content', message: `Missing activity version content: ${activity.activityId}@${activity.version}` });
  }
  const versions = versionNumbers.map(version => {
    const root = path.join(versionsRoot, String(version));
    const config = read(path.join(root, 'config.json'), 'config', schemas.parseGameConfig);
    const stringsRoot = path.join(root, 'strings');
    const languageFiles = new Set((config?.meta?.supportedLanguages ?? ['en', 'ro']).map(language => `${language}.json`));
    if (fs.existsSync(stringsRoot)) {
      for (const entry of fs.readdirSync(stringsRoot, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith('.json')) languageFiles.add(entry.name);
      }
    }
    for (const name of languageFiles) {
      // Language identifiers come from content, so keep them inside strings/.
      if (!/^[a-zA-Z0-9_-]+\.json$/.test(name)) {
        diagnostics.push({ file: stringsRoot, kind: 'strings', message: `Invalid language file: ${name}` });
      } else {
        read(path.join(stringsRoot, name), 'strings', schemas.gameStringsSchema.safeParse);
      }
    }
    const assetsFile = path.join(root, 'assets.json');
    const assets = read(assetsFile, 'assets', schemas.activityAssetRegistrySchema.safeParse);
    const pins = [];
    if (assets) {
      const result = schemas.validateActivityAssetPins(assets, activity.gameId);
      if (!result.success) diagnostics.push({ file: assetsFile, kind: 'assets', message: result.errors.join('; ') });
      for (const pin of Object.values(assets.pinnedAssets ?? {})) {
        const relativePath = pin.path.replace(/^\//, '');
        const source = path.resolve(libraryRoot, relativePath);
        const library = path.resolve(libraryRoot, 'assets/library');
        const relative = path.relative(library, source);
        try {
          if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Unsafe asset path: ${pin.path}`);
          const digest = createHash('sha256').update(fs.readFileSync(source)).digest('hex');
          if (digest !== pin.sha256) throw new Error(`Pinned asset hash mismatch for ${pin.path}`);
          pins.push({ source, relativePath, sha256: pin.sha256 });
        } catch (error) {
          diagnostics.push({ file: assetsFile, kind: 'assets', message: `${pin.path}: ${error.message}` });
        }
      }
    }
    return { version, root, config, assets, pins };
  });
  return { activity, versions, diagnostics, files };
}

function assertValidActivityPackage(result, prefix = 'Invalid activity') {
  if (result.diagnostics.length) {
    throw new Error(result.diagnostics.map(diagnostic => {
      if (diagnostic.kind === 'metadata' && diagnostic.message.startsWith('Invalid ')) return `${prefix} ${diagnostic.message.slice(8)}`;
      const label = { metadata: 'metadata', content: 'content', config: 'config', strings: 'strings', assets: 'asset manifest' }[diagnostic.kind];
      const version = diagnostic.file.match(/[\\/]versions[\\/](\d+)[\\/]/)?.[1];
      return `${prefix} ${label} for ${result.activity?.activityId ?? 'unknown'}${version ? '@' + version : ''}: ${diagnostic.file}: ${diagnostic.message}`;
    }).join('\n'));
  }
  return result;
}

module.exports = { readActivityPackage, assertValidActivityPackage };
