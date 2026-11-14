import {
    EditorGameAdapter,
    EditorMountOptions
} from "../../../packages/game-editor/src";
import { mountMemoryGame } from "./gameHost";
import { Language } from "@edu-play/game-core";

function toTemplateLanguage(language?: string): Language | undefined {
    if (language === "ro" || language === "en") {
        return language;
    }

    return undefined;
}

export const memoryGameEditorAdapter: EditorGameAdapter = {
    id: "memory-game",
    label: "Memory Game",
    description: "Preview the current Phaser memory-game runtime inside the shared Submerged Studio shell.",
    templateBasePath: "./activities",
    catalogUrl: "./editor-catalogs/memory-game.json",
    defaultState: {
        gameId: "animals-memory-01",
        language: "en",
        muted: false
    },
    mount(container: HTMLElement, options: EditorMountOptions) {
        return mountMemoryGame(container, {
            ...options,
            language: toTemplateLanguage(options.language)
        });
    }
};
