import MatchLevel from "./scenes/MatchLevel";
import MatchPreload from "./scenes/MatchPreload";
import {
	defineGameTemplate,
	mountGameTemplate,
	type GameDiagnosticsSnapshot,
	type GameTemplateHandle,
	type GameTemplateMountOptions
} from "@edu-play/game-core";

export interface MatchingGameMountOptions extends GameTemplateMountOptions {}
export type { GameDiagnosticsSnapshot };
export type GameHandle = GameTemplateHandle<MatchingGameMountOptions>;

export const matchingGameTemplate = defineGameTemplate<MatchingGameMountOptions>({
	id: "matching-game",
	defaultGameId: "animals-match-01",
	scenes: [MatchPreload, MatchLevel]
});

export function mountMatchingGame(
	container?: HTMLElement,
	initialOptions: MatchingGameMountOptions = {}
): GameHandle {
	return mountGameTemplate(matchingGameTemplate, container, initialOptions);
}

export function mountStandaloneMatchingGame(): GameHandle {
	return mountMatchingGame(undefined, {});
}
