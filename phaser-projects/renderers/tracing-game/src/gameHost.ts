import TracingLevel from "./scenes/TracingLevel";
import TracingPreload from "./scenes/TracingPreload";
import {
	defineGameTemplate,
	mountGameTemplate,
	type GameDiagnosticsSnapshot,
	type GameTemplateHandle,
	type GameTemplateMountOptions
} from "@edu-play/game-core";

export interface TracingGameMountOptions extends GameTemplateMountOptions {}
export type { GameDiagnosticsSnapshot };
export type GameHandle = GameTemplateHandle<TracingGameMountOptions>;

export const tracingGameTemplate = defineGameTemplate<TracingGameMountOptions>({
	id: "tracing-game",
	defaultGameId: "shapes-basic",
	scenes: [TracingPreload, TracingLevel]
});

export function mountTracingGame(
	container?: HTMLElement,
	initialOptions: TracingGameMountOptions = {}
): GameHandle {
	return mountGameTemplate(tracingGameTemplate, container, initialOptions);
}

export function mountStandaloneTracingGame(): GameHandle {
	return mountTracingGame(undefined, {});
}
