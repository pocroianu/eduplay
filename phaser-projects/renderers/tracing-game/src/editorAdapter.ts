import {
    EditorGameAdapter,
    EditorMountOptions
} from "../../../packages/game-editor/src";
import { mountTracingGame } from "./gameHost";
import { Language } from "@edu-play/game-core";

function toTemplateLanguage(language?: string): Language | undefined {
    if (language === "ro" || language === "en") {
        return language;
    }

    return undefined;
}

export const tracingGameEditorAdapter: EditorGameAdapter = {
    id: "tracing-game",
    label: "Tracing Game",
    description: "Preview the current Phaser tracing-game runtime inside the shared Submerged Studio shell.",
    templateBasePath: "./activities",
    catalogUrl: "./editor-catalogs/tracing-game.json",
    defaultState: {
        gameId: "uppercase-a-to-f",
        language: "en",
        muted: false
    },
    mount(container: HTMLElement, options: EditorMountOptions) {
        return mountTracingGame(container, {
            ...options,
            language: toTemplateLanguage(options.language)
        });
    }
};
