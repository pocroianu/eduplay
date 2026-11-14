import Level from "./scenes/Level";
import {
	defineGameTemplate,
	mountGameTemplate,
	Preload,
	type GameDiagnosticsSnapshot,
	type GameTemplateHandle,
	type GameTemplateMountOptions
} from "@edu-play/game-core";

export interface GameMountOptions extends GameTemplateMountOptions {}
export type { GameDiagnosticsSnapshot };
export type GameHandle = GameTemplateHandle<GameMountOptions>;

export const multipleChoiceTemplate = defineGameTemplate<GameMountOptions>({
	id: "multiple-choice",
	defaultGameId: "fruits-01",
	scenes: [Preload, Level]
});

export function mountMultipleChoiceGame(
	container?: HTMLElement,
	initialOptions: GameMountOptions = {}
): GameHandle {
	return mountGameTemplate(multipleChoiceTemplate, container, initialOptions);
}

export function mountStandaloneMultipleChoiceGame(): GameHandle {
	return mountMultipleChoiceGame(undefined, {});
}
