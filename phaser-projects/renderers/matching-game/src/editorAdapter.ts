import {
	EditorGameAdapter,
	EditorMountOptions
} from "../../../packages/game-editor/src";
import { mountMatchingGame } from "./gameHost";
import { Language } from "@edu-play/game-core";

function toTemplateLanguage(language?: string): Language | undefined {
	if (language === "ro" || language === "en") {
		return language;
	}

	return undefined;
}

export const matchingGameEditorAdapter: EditorGameAdapter = {
	id: "matching-game",
	label: "Matching Game",
	description: "Preview the current Phaser matching-game runtime inside the shared Submerged Studio shell.",
	templateBasePath: "./activities",
	catalogUrl: "./editor-catalogs/matching-game.json",
	defaultState: {
		gameId: "animals-match-01",
		language: "en",
		muted: false
	},
	mount(container: HTMLElement, options: EditorMountOptions) {
		return mountMatchingGame(container, {
			...options,
			language: toTemplateLanguage(options.language)
		});
	}
};
