import ListenTapLevel from "./scenes/ListenTapLevel";
import ListenTapPreload from "./scenes/ListenTapPreload";
import {
	defineGameTemplate,
	mountGameTemplate,
	type GameDiagnosticsSnapshot,
	type GameTemplateHandle,
	type GameTemplateMountOptions
} from "@edu-play/game-core";

export interface ListenTapMountOptions extends GameTemplateMountOptions {}
export type { GameDiagnosticsSnapshot };
export type GameHandle = GameTemplateHandle<ListenTapMountOptions>;

export const listenTapTemplate = defineGameTemplate<ListenTapMountOptions>({
	id: "listen-tap",
	defaultGameId: "phonics-ro-01",
	scenes: [ListenTapPreload, ListenTapLevel]
});

export function mountListenTapGame(
	container?: HTMLElement,
	initialOptions: ListenTapMountOptions = {}
): GameHandle {
	return mountGameTemplate(listenTapTemplate, container, initialOptions);
}

export function mountStandaloneListenTapGame(): GameHandle {
	return mountListenTapGame(undefined, {});
}
