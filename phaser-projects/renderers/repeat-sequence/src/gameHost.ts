import SequenceLevel from "./scenes/SequenceLevel";
import SequencePreload from "./scenes/SequencePreload";
import {
	defineGameTemplate,
	mountGameTemplate,
	type GameDiagnosticsSnapshot,
	type GameTemplateHandle,
	type GameTemplateMountOptions
} from "@edu-play/game-core";

export interface RepeatSequenceMountOptions extends GameTemplateMountOptions {}
export type { GameDiagnosticsSnapshot };
export type GameHandle = GameTemplateHandle<RepeatSequenceMountOptions>;

export const repeatSequenceTemplate = defineGameTemplate<RepeatSequenceMountOptions>({
	id: "repeat-sequence",
	defaultGameId: "animals-sequence-01",
	scenes: [SequencePreload, SequenceLevel]
});

export function mountRepeatSequence(
	container?: HTMLElement,
	initialOptions: RepeatSequenceMountOptions = {}
): GameHandle {
	return mountGameTemplate(repeatSequenceTemplate, container, initialOptions);
}

export function mountStandaloneRepeatSequence(): GameHandle {
	return mountRepeatSequence(undefined, {});
}
