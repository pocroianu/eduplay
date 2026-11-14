import CountingLevel from "./scenes/CountingLevel";
import CountingPreload from "./scenes/CountingPreload";
import {
	defineGameTemplate,
	mountGameTemplate,
	type GameDiagnosticsSnapshot,
	type GameTemplateHandle,
	type GameTemplateMountOptions
} from "@edu-play/game-core";

export interface CountingGameMountOptions extends GameTemplateMountOptions {}
export type { GameDiagnosticsSnapshot };
export type GameHandle = GameTemplateHandle<CountingGameMountOptions>;

export const countingGameTemplate = defineGameTemplate<CountingGameMountOptions>({
	id: "counting-game",
	defaultGameId: "farm-count-01",
	scenes: [CountingPreload, CountingLevel]
});

export function mountCountingGame(
	container?: HTMLElement,
	initialOptions: CountingGameMountOptions = {}
): GameHandle {
	return mountGameTemplate(countingGameTemplate, container, initialOptions);
}

export function mountStandaloneCountingGame(): GameHandle {
	return mountCountingGame(undefined, {});
}
