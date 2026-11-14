import PatternLevel from "./scenes/PatternLevel";
import PatternPreload from "./scenes/PatternPreload";
import {
	defineGameTemplate,
	mountGameTemplate,
	type GameDiagnosticsSnapshot,
	type GameTemplateHandle,
	type GameTemplateMountOptions
} from "@edu-play/game-core";

export interface PatternGameMountOptions extends GameTemplateMountOptions {}
export type { GameDiagnosticsSnapshot };
export type GameHandle = GameTemplateHandle<PatternGameMountOptions>;

export const patternGameTemplate = defineGameTemplate<PatternGameMountOptions>({
	id: "pattern-game",
	defaultGameId: "shapes-pattern-01",
	scenes: [PatternPreload, PatternLevel]
});

export function mountPatternGame(
	container?: HTMLElement,
	initialOptions: PatternGameMountOptions = {}
): GameHandle {
	return mountGameTemplate(patternGameTemplate, container, initialOptions);
}

export function mountStandalonePatternGame(): GameHandle {
	return mountPatternGame(undefined, {});
}
