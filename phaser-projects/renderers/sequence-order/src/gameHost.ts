import SequenceLevel from "./scenes/SequenceLevel";
import SequencePreload from "./scenes/SequencePreload";
import {
	defineGameTemplate,
	mountGameTemplate,
	type GameDiagnosticsSnapshot,
	type GameTemplateHandle,
	type GameTemplateMountOptions
} from "@edu-play/game-core";

export interface SequenceGameMountOptions extends GameTemplateMountOptions {}
export type { GameDiagnosticsSnapshot };
export type GameHandle = GameTemplateHandle<SequenceGameMountOptions>;

export const sequenceGameTemplate = defineGameTemplate<SequenceGameMountOptions>({
	id: "sequence-order",
	defaultGameId: "numbers-1-to-6",
	scenes: [SequencePreload, SequenceLevel]
});

export function mountSequenceGame(
	container?: HTMLElement,
	initialOptions: SequenceGameMountOptions = {}
): GameHandle {
	return mountGameTemplate(sequenceGameTemplate, container, initialOptions);
}

export function mountStandaloneSequenceGame(): GameHandle {
	return mountSequenceGame(undefined, {});
}
