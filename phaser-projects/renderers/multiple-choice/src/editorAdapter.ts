import {
	EditorGameAdapter,
	EditorMountOptions
} from "../../../packages/game-editor/src";
import { mountMultipleChoiceGame } from "./gameHost";
import { Language } from "@edu-play/game-core";

function toTemplateLanguage(language?: string): Language | undefined {
	if (language === "ro" || language === "en") {
		return language;
	}

	return undefined;
}

export const multipleChoiceEditorAdapter: EditorGameAdapter = {
	id: "multiple-choice",
	label: "Multiple Choice",
	description: "Preview the current Phaser multiple-choice runtime inside the shared Submerged Studio shell.",
	templateBasePath: "./activities",
	catalogUrl: "./editor-catalogs/multiple-choice.json",
	defaultState: {
		gameId: "fruits-01",
		language: "en",
		muted: false
	},
	mount(container: HTMLElement, options: EditorMountOptions) {
		return mountMultipleChoiceGame(container, {
			...options,
			language: toTemplateLanguage(options.language)
		});
	}
};
