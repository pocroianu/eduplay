import type { GameTemplateHandle, GameTemplateMountOptions } from '../src/templates/GameTemplateRuntime';
import type { Language } from '../src/i18n';
import { resolveActivityHostRoute, type ResolvedActivityHostRoute } from '../src/host/activityHostRoutes';
import { activityHostCatalog } from './generated/activityHostCatalog.generated';
import { rendererLoaders } from './generated/rendererLoaders.generated';

const root = document.querySelector<HTMLElement>('#game-root');
let activeGame: GameTemplateHandle | null = null;

void startActivityHost();

async function startActivityHost(): Promise<void> {
	if (!root) {
		throw new Error('Missing #game-root container');
	}

	const route = resolveActivityHostRoute(window.location.pathname, activityHostCatalog);
	if (route.kind === 'not-found') {
		renderRouteMessage(route);
		return;
	}

	const loadRenderer = rendererLoaders[route.rendererId];
	if (!loadRenderer) {
		renderRouteMessage({ kind: 'not-found', reason: `No renderer loader for: ${route.rendererId}` });
		return;
	}

	try {
		const [{ mountGameTemplate }, definition] = await Promise.all([
			import('../src/templates/GameTemplateRuntime'),
			loadRenderer(),
		]);
		activeGame?.destroy();
		activeGame = mountGameTemplate(definition, root, withQueryOptions(route.mountOptions));
	} catch (error) {
		renderRouteMessage({
			kind: 'not-found',
			reason: error instanceof Error ? error.message : String(error),
		});
	}
}

function withQueryOptions(mountOptions: GameTemplateMountOptions): GameTemplateMountOptions {
	const params = new URLSearchParams(window.location.search);
	const language = parseLanguage(params.get('lang') ?? params.get('language'));
	const muted = parseBoolean(params.get('muted'));
	const theme = params.get('theme')?.trim() || undefined;
	const configUrl = params.get('configUrl')?.trim() || mountOptions.configUrl;

	return {
		...mountOptions,
		language,
		muted,
		theme,
		configUrl,
	};
}

function parseLanguage(value: string | null): Language | undefined {
	return value === 'en' || value === 'ro' ? value : undefined;
}

function parseBoolean(value: string | null): boolean | undefined {
	if (value === null) {
		return undefined;
	}
	return value === '1' || value === 'true';
}

function renderRouteMessage(route: ResolvedActivityHostRoute): void {
	if (!root) {
		return;
	}

	root.innerHTML = `
		<main class="host-message" role="main">
			<h1>Activity host</h1>
			<p>${escapeHtml(route.reason)}</p>
			<nav aria-label="Available routes">
				<a href="/activities/fruits-01">Play fruits-01</a>
				<a href="/templates/multiple-choice/">Debug multiple-choice renderer</a>
			</nav>
		</main>
	`;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}
