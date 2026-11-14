import MemoryLevel from "./scenes/MemoryLevel";
import MemoryPreload from "./scenes/MemoryPreload";
import {
	defineGameTemplate,
	mountGameTemplate,
	type GameDiagnosticsSnapshot,
	type GameTemplateHandle,
	type GameTemplateMountOptions
} from "@edu-play/game-core";

export interface MemoryGameMountOptions extends GameTemplateMountOptions {}
export type { GameDiagnosticsSnapshot };
export type GameHandle = GameTemplateHandle<MemoryGameMountOptions>;

export const memoryGameTemplate = defineGameTemplate<MemoryGameMountOptions>({
	id: "memory-game",
	defaultGameId: "animals-memory-01",
	scenes: [MemoryPreload, MemoryLevel]
});

export function mountMemoryGame(
	container?: HTMLElement,
	initialOptions: MemoryGameMountOptions = {}
): GameHandle {
	return mountGameTemplate(memoryGameTemplate, container, initialOptions);
}

export function mountStandaloneMemoryGame(): GameHandle {
	return mountMemoryGame(undefined, {});
}
