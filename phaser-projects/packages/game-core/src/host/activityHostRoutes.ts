import type { GameTemplateMountOptions } from '../templates/GameTemplateRuntime';

export interface ActivityCatalogEntry {
	activityId: string;
	version: number;
	renderer: {
		id: string;
		version: string;
	};
	gameId: string;
	basePath?: string;
	configUrl?: string;
}

export interface RendererCatalogEntry {
	rendererId: string;
	defaultGameId: string;
	basePath?: string;
}

export interface ActivityHostCatalog {
	activities: ActivityCatalogEntry[];
	renderers: RendererCatalogEntry[];
}

export interface ResolvedActivityRoute {
	kind: 'activity';
	activityId: string;
	version: number;
	rendererId: string;
	rendererVersionRange: string;
	mountOptions: GameTemplateMountOptions;
}

export interface ResolvedTemplateRoute {
	kind: 'template';
	templateId: string;
	rendererId: string;
	mountOptions: GameTemplateMountOptions;
}

export interface ResolvedNotFoundRoute {
	kind: 'not-found';
	reason: string;
}

export type ResolvedActivityHostRoute = ResolvedActivityRoute | ResolvedTemplateRoute | ResolvedNotFoundRoute;

export function resolveActivityHostRoute(
	pathname: string,
	catalog: ActivityHostCatalog
): ResolvedActivityHostRoute {
	const activityMatch = normalizePath(pathname).match(/^\/activities\/([^/@]+)(?:@(\d+))?$/);
	if (activityMatch) {
		const activityId = decodeURIComponent(activityMatch[1]);
		const requestedVersion = activityMatch[2] ? Number(activityMatch[2]) : undefined;
		const activity = findActivity(catalog.activities, activityId, requestedVersion);
		if (!activity) {
			const label = requestedVersion ? `${activityId}@${requestedVersion}` : activityId;
			return { kind: 'not-found', reason: `Unknown activity: ${label}` };
		}

		return {
			kind: 'activity',
			activityId: activity.activityId,
			version: activity.version,
			rendererId: activity.renderer.id,
			rendererVersionRange: activity.renderer.version,
			mountOptions: stripUndefined({
				gameId: activity.gameId,
				basePath: activity.basePath,
				configUrl: activity.configUrl,
			}),
		};
	}

	const templateMatch = normalizePath(pathname).match(/^\/templates\/([^/]+)$/);
	if (templateMatch) {
		const templateId = decodeURIComponent(templateMatch[1]);
		const renderer = catalog.renderers.find((candidate) => candidate.rendererId === templateId);
		if (!renderer) {
			return { kind: 'not-found', reason: `Unknown template: ${templateId}` };
		}

		return {
			kind: 'template',
			templateId,
			rendererId: renderer.rendererId,
			mountOptions: stripUndefined({
				gameId: renderer.defaultGameId,
				basePath: renderer.basePath,
			}),
		};
	}

	return { kind: 'not-found', reason: `Unsupported route: ${pathname}` };
}

function findActivity(
	activities: ActivityCatalogEntry[],
	activityId: string,
	requestedVersion?: number
): ActivityCatalogEntry | undefined {
	const matches = activities.filter((candidate) => candidate.activityId === activityId);
	if (requestedVersion !== undefined) {
		return matches.find((candidate) => candidate.version === requestedVersion);
	}
	return matches.sort((left, right) => right.version - left.version)[0];
}

function normalizePath(pathname: string): string {
	const normalized = pathname.replace(/\/+$/, '') || '/';
	const embeddedRoute = normalized.match(/\/(?:activities\/[^/]+(?:@\d+)?|templates\/[^/]+)$/);
	return embeddedRoute?.[0] ?? normalized;
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
	return Object.fromEntries(
		Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
	) as T;
}
