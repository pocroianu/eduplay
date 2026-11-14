import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, cpSync, copyFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const packageRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(packageRoot, "../..");
const sourceRoot = join(packageRoot, "src");
const outputRoot = join(packageRoot, "dist");
const editorStylesPath = join(repoRoot, "packages/game-editor/src/styles.css");
const activitiesRoot = join(repoRoot, "activities");
const assetLibraryRoot = join(repoRoot, "assets/library");
const sharedAssetsRoot = join(repoRoot, "assets/shared");
const renderersRoot = join(repoRoot, "renderers");
const editorCatalogPrefix = "/editor-catalogs/";
const activitiesPrefix = "/activities/";
const assetLibraryPrefix = "/assets/library/";
const sharedAssetsPrefix = "/assets/shared/";

type EditorRenderer = {
    id: string;
};

type RendererMetadata = {
    rendererId: string;
    editorSupported?: boolean;
};

type ActivityMetadata = {
    activityId: string;
    version: number;
    gameId: string;
    renderer: {
        id: string;
        version: string;
    };
};

type ActivityConfig = {
    meta?: {
        difficulty?: "easy" | "medium" | "hard";
        supportedLanguages?: string[];
        totalSteps?: number;
    };
    questions?: unknown[];
    pairs?: unknown[];
    items?: unknown[];
    rounds?: unknown[];
};

type ActivityStrings = {
    meta?: {
        title?: string;
        description?: string;
    };
};

function readEditorRenderers(): EditorRenderer[] {
    return readdirSync(renderersRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => readJsonIfExists<RendererMetadata>(join(renderersRoot, entry.name, "renderer.json")))
        .filter((metadata): metadata is RendererMetadata => metadata !== null && metadata.editorSupported !== false)
        .map((metadata) => ({ id: metadata.rendererId }))
        .sort((left, right) => left.id.localeCompare(right.id));
}

function readJson<T>(filePath: string): T {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function readJsonIfExists<T>(filePath: string): T | null {
    return existsSync(filePath) ? readJson<T>(filePath) : null;
}

function resolveInside(root: string, requestPath: string): string | null {
    const resolvedPath = resolve(root, requestPath);
    const relativePath = relative(root, resolvedPath);

    if (relativePath === "" || (!relativePath.startsWith("..") && !relativePath.includes(`..${sep}`))) {
        return resolvedPath;
    }

    return null;
}

function buildEditorCatalog(rendererId: string) {
    const games = readdirSync(activitiesRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => readActivityCatalogEntry(entry.name, rendererId))
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .sort((left, right) => left.id.localeCompare(right.id));

    return {
        version: "1.0.0",
        games
    };
}

function readActivityCatalogEntry(activityFolder: string, rendererId: string) {
    const activityPath = join(activitiesRoot, activityFolder, "activity.json");
    if (!existsSync(activityPath)) {
        return null;
    }

    const activity = readJson<ActivityMetadata>(activityPath);
    if (activity.renderer.id !== rendererId) {
        return null;
    }

    const versionRoot = join(activitiesRoot, activityFolder, "versions", String(activity.version));
    const config = readJsonIfExists<ActivityConfig>(join(versionRoot, "config.json")) ?? {};
    const languages = config.meta?.supportedLanguages?.length
        ? config.meta.supportedLanguages
        : ["en", "ro"].filter((language) => existsSync(join(versionRoot, "strings", `${language}.json`)));

    const stringsByLanguage = Object.fromEntries(
        languages.map((language) => [
            language,
            readJsonIfExists<ActivityStrings>(join(versionRoot, "strings", `${language}.json`)) ?? {}
        ])
    ) as Record<string, ActivityStrings>;

    return {
        id: activity.gameId,
        name: mapByLanguage(languages, stringsByLanguage, "title", activity.gameId),
        description: mapByLanguage(languages, stringsByLanguage, "description", ""),
        languages,
        difficulty: config.meta?.difficulty ?? "easy",
        ...countForConfig(config)
    };
}

function mapByLanguage(
    languages: string[],
    stringsByLanguage: Record<string, ActivityStrings>,
    key: "title" | "description",
    fallback: string
): Record<string, string> {
    return Object.fromEntries(
        languages.map((language) => [language, stringsByLanguage[language]?.meta?.[key] ?? fallback])
    );
}

function countForConfig(config: ActivityConfig): Record<string, number> {
    if (config.questions?.length) {
        return { questionCount: config.questions.length };
    }
    if (config.pairs?.length) {
        return { pairCount: config.pairs.length };
    }
    if (config.items?.length) {
        return { itemCount: config.items.length };
    }
    if (config.rounds?.length) {
        return { roundCount: config.rounds.length };
    }
    if (config.meta?.totalSteps) {
        return { itemCount: config.meta.totalSteps };
    }
    return { itemCount: 1 };
}

function writeEditorCatalogs(): void {
    const catalogRoot = join(outputRoot, "editor-catalogs");
    rmSync(catalogRoot, { recursive: true, force: true });
    mkdirSync(catalogRoot, { recursive: true });

    for (const renderer of readEditorRenderers()) {
        writeFileSync(
            join(catalogRoot, `${renderer.id}.json`),
            `${JSON.stringify(buildEditorCatalog(renderer.id), null, 2)}\n`
        );
    }
}

function mimeTypeFor(filePath: string): string {
    switch (extname(filePath).toLowerCase()) {
        case ".css":
            return "text/css; charset=utf-8";
        case ".html":
            return "text/html; charset=utf-8";
        case ".json":
            return "application/json; charset=utf-8";
        case ".js":
            return "text/javascript; charset=utf-8";
        case ".png":
            return "image/png";
        case ".jpg":
        case ".jpeg":
            return "image/jpeg";
        case ".gif":
            return "image/gif";
        case ".svg":
            return "image/svg+xml";
        case ".mp3":
            return "audio/mpeg";
        case ".wav":
            return "audio/wav";
        default:
            return "application/octet-stream";
    }
}

function sendJson(response: import("node:http").ServerResponse, value: unknown): void {
    response.statusCode = 200;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(`${JSON.stringify(value, null, 2)}\n`);
}

function sendFile(response: import("node:http").ServerResponse, filePath: string): void {
    response.statusCode = 200;
    response.setHeader("Content-Type", mimeTypeFor(filePath));
    createReadStream(filePath).pipe(response);
}

function safeDecode(value: string): string | null {
    try {
        return decodeURIComponent(value);
    } catch {
        return null;
    }
}

function configEditorStaticPlugin(): Plugin {
    return {
        name: "config-editor-static-assets",
        configureServer(server) {
            server.middlewares.use((request, response, next) => {
                const requestUrl = new URL(request.url ?? "/", "http://localhost");
                const requestPath = safeDecode(requestUrl.pathname);
                if (!requestPath) {
                    next();
                    return;
                }

                if (requestPath === "/styles.css") {
                    sendFile(response, editorStylesPath);
                    return;
                }

                if (requestPath.startsWith(editorCatalogPrefix)) {
                    const rendererId = requestPath.slice(editorCatalogPrefix.length).replace(/\.json$/, "");
                    const renderer = readEditorRenderers().find((entry) => entry.id === rendererId);
                    if (renderer) {
                        sendJson(response, buildEditorCatalog(renderer.id));
                        return;
                    }
                }

                if (requestPath.startsWith(activitiesPrefix)) {
                    const relativeActivityPath = requestPath.slice(activitiesPrefix.length);
                    const activityPath = resolveInside(activitiesRoot, relativeActivityPath);
                    if (activityPath && existsSync(activityPath) && statSync(activityPath).isFile()) {
                        sendFile(response, activityPath);
                        return;
                    }
                }

                if (requestPath.startsWith(assetLibraryPrefix)) {
                    const relativeAssetPath = requestPath.slice(assetLibraryPrefix.length);
                    const assetPath = resolveInside(assetLibraryRoot, relativeAssetPath);
                    if (assetPath && existsSync(assetPath) && statSync(assetPath).isFile()) {
                        sendFile(response, assetPath);
                        return;
                    }
                }

                if (requestPath.startsWith(sharedAssetsPrefix)) {
                    const relativeAssetPath = requestPath.slice(sharedAssetsPrefix.length);
                    const assetPath = resolveInside(sharedAssetsRoot, relativeAssetPath);
                    if (assetPath && existsSync(assetPath) && statSync(assetPath).isFile()) {
                        sendFile(response, assetPath);
                        return;
                    }
                }

                next();
            });
        },
        writeBundle() {
            mkdirSync(outputRoot, { recursive: true });
            copyFileSync(editorStylesPath, join(outputRoot, "styles.css"));

            rmSync(join(outputRoot, "templates"), { recursive: true, force: true });
            rmSync(join(outputRoot, "activities"), { recursive: true, force: true });
            rmSync(join(outputRoot, "assets", "library"), { recursive: true, force: true });
            rmSync(join(outputRoot, "assets", "shared"), { recursive: true, force: true });
            cpSync(activitiesRoot, join(outputRoot, "activities"), { recursive: true });
            if (existsSync(assetLibraryRoot)) {
                cpSync(assetLibraryRoot, join(outputRoot, "assets", "library"), { recursive: true });
            }
            if (existsSync(sharedAssetsRoot)) {
                cpSync(sharedAssetsRoot, join(outputRoot, "assets", "shared"), { recursive: true });
            }
            writeEditorCatalogs();
        }
    };
}

export default defineConfig({
    root: sourceRoot,
    plugins: [configEditorStaticPlugin()],
    resolve: {
        alias: {
            "@edu-play/validation": join(repoRoot, "packages/validation/src/index.ts")
        }
    },
    server: {
        host: "0.0.0.0",
        port: 8091
    },
    build: {
        outDir: outputRoot,
        emptyOutDir: true
    }
});
