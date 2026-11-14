import {
    EditorGameAdapter,
    EditorMountOptions
} from "../../../packages/game-editor/src";
import { mountCategorizeGame } from "./gameHost";
import { Language } from "@edu-play/game-core";

function toTemplateLanguage(language?: string): Language | undefined {
    if (language === "ro" || language === "en") {
        return language;
    }

    return undefined;
}

export const categorizeGameEditorAdapter: EditorGameAdapter = {
    id: "categorize-game",
    label: "Categorize Game",
    description: "Preview the current Phaser categorize-game runtime inside the shared Submerged Studio shell.",
    templateBasePath: "./activities",
    catalogUrl: "./editor-catalogs/categorize-game.json",
    defaultState: {
        gameId: "animals-habitat-01",
        language: "en",
        muted: false
    },
    mount(container: HTMLElement, options: EditorMountOptions) {
        return mountCategorizeGame(container, {
            ...options,
            language: toTemplateLanguage(options.language)
        });
    }
};
