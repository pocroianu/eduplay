import CategorizeLevel from "./scenes/CategorizeLevel";
import CategorizePreload from "./scenes/CategorizePreload";
import {
	defineGameTemplate,
	mountGameTemplate,
	type GameDiagnosticsSnapshot,
	type GameTemplateHandle,
	type GameTemplateMountOptions
} from "@edu-play/game-core";

export interface CategorizeGameMountOptions extends GameTemplateMountOptions {}
export type { GameDiagnosticsSnapshot };
export type GameHandle = GameTemplateHandle<CategorizeGameMountOptions>;

export const categorizeGameTemplate = defineGameTemplate<CategorizeGameMountOptions>({
	id: "categorize-game",
	defaultGameId: "animals-habitat-01",
	scenes: [CategorizePreload, CategorizeLevel]
});

export function mountCategorizeGame(
	container?: HTMLElement,
	initialOptions: CategorizeGameMountOptions = {}
): GameHandle {
	return mountGameTemplate(categorizeGameTemplate, container, initialOptions);
}

export function mountStandaloneCategorizeGame(): GameHandle {
	return mountCategorizeGame(undefined, {});
}
