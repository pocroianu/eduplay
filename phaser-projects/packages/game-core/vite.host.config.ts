import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const activitiesRoot = path.resolve(repoRoot, 'activities');
const assetLibraryRoot = path.resolve(repoRoot, 'assets/library');
const sharedAssetsRoot = path.resolve(repoRoot, 'assets/shared');
const activityContentPrefix = '/activities/';
const assetLibraryPrefix = '/assets/library/';
const sharedAssetsPrefix = '/assets/shared/';

function activityContentPlugin(): Plugin {
	return {
		name: 'activity-content',
		configureServer(server) {
			server.middlewares.use((request, response, next) => {
				const filePath = resolveActivityContentRequest(request.url ?? '')
					?? resolveAssetLibraryRequest(request.url ?? '')
					?? resolveSharedAssetsRequest(request.url ?? '');
				if (!filePath) {
					next();
					return;
				}

				response.setHeader('Content-Type', getContentType(filePath));
				fs.createReadStream(filePath).pipe(response);
			});
		},
		writeBundle(options) {
			const outDir = options.dir;
			if (!outDir || !fs.existsSync(activitiesRoot)) {
				return;
			}

			copyDirectory(activitiesRoot, path.resolve(outDir, 'activities'));
			if (fs.existsSync(assetLibraryRoot)) {
				copyDirectory(assetLibraryRoot, path.resolve(outDir, 'assets/library'));
			}
			if (fs.existsSync(sharedAssetsRoot)) {
				copyDirectory(sharedAssetsRoot, path.resolve(outDir, 'assets/shared'));
			}
		},
	};
}

function resolveActivityContentRequest(requestUrl: string): string | null {
	const [pathname] = requestUrl.split('?');
	if (!pathname.startsWith(activityContentPrefix) || !pathname.includes('/versions/')) {
		return null;
	}

	return resolveFileInsideRoot(activitiesRoot, pathname.slice(activityContentPrefix.length));
}

function resolveAssetLibraryRequest(requestUrl: string): string | null {
	const [pathname] = requestUrl.split('?');
	if (!pathname.startsWith(assetLibraryPrefix)) {
		return null;
	}

	return resolveFileInsideRoot(assetLibraryRoot, pathname.slice(assetLibraryPrefix.length));
}

function resolveSharedAssetsRequest(requestUrl: string): string | null {
	const [pathname] = requestUrl.split('?');
	if (!pathname.startsWith(sharedAssetsPrefix)) {
		return null;
	}

	return resolveFileInsideRoot(sharedAssetsRoot, pathname.slice(sharedAssetsPrefix.length));
}

function resolveFileInsideRoot(root: string, requestPath: string): string | null {
	const relativePath = safeDecodePath(requestPath);
	if (!relativePath || relativePath.includes('..')) {
		return null;
	}

	const candidate = path.resolve(root, relativePath);
	if (!candidate.startsWith(`${root}${path.sep}`)) {
		return null;
	}

	if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
		return candidate;
	}

	return null;
}

function safeDecodePath(value: string): string | null {
	try {
		return decodeURIComponent(value);
	} catch {
		return null;
	}
}

function copyDirectory(source: string, target: string): void {
	fs.mkdirSync(target, { recursive: true });
	for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
		const sourcePath = path.join(source, entry.name);
		const targetPath = path.join(target, entry.name);
		if (entry.isDirectory()) {
			copyDirectory(sourcePath, targetPath);
		} else if (entry.isFile()) {
			fs.copyFileSync(sourcePath, targetPath);
		}
	}
}

function getContentType(filePath: string): string {
	const extension = path.extname(filePath).toLowerCase();
	switch (extension) {
		case '.json':
			return 'application/json';
		case '.png':
			return 'image/png';
		case '.jpg':
		case '.jpeg':
			return 'image/jpeg';
		case '.svg':
			return 'image/svg+xml';
		case '.mp3':
			return 'audio/mpeg';
		case '.wav':
			return 'audio/wav';
		default:
			return 'application/octet-stream';
	}
}

export default defineConfig({
	root: path.resolve(__dirname, 'host'),
	publicDir: false,
	plugins: [activityContentPlugin()],
	resolve: {
		alias: {
			'@edu-play/game-core': path.resolve(__dirname, 'src/index.ts'),
			'@edu-play/validation': path.resolve(__dirname, '../validation/src/index.ts'),
		},
	},
	server: {
		port: Number(process.env.PORT ?? 5173),
		strictPort: process.env.STRICT_PORT === 'true',
	},
	build: {
		outDir: path.resolve(__dirname, 'dist/activity-host'),
		emptyOutDir: true,
	},
});
