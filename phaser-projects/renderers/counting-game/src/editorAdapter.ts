import {
    EditorGameAdapter,
    EditorMountOptions
} from "../../../packages/game-editor/src";
import { mountCountingGame } from "./gameHost";
import { Language } from "@edu-play/game-core";

function toTemplateLanguage(language?: string): Language | undefined {
    if (language === "ro" || language === "en") {
        return language;
    }

    return undefined;
}

export const countingGameEditorAdapter: EditorGameAdapter = {
    id: "counting-game",
    label: "Counting Game",
    description: "Preview the current Phaser counting-game runtime inside the shared Submerged Studio shell.",
    templateBasePath: "./activities",
    catalogUrl: "./editor-catalogs/counting-game.json",
    defaultState: {
        gameId: "farm-count-01",
        language: "en",
        muted: false
    },
    mount(container: HTMLElement, options: EditorMountOptions) {
        return mountCountingGame(container, {
            ...options,
            language: toTemplateLanguage(options.language)
        });
    }
};
