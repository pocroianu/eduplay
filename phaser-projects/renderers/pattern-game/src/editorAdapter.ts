import {
    EditorGameAdapter,
    EditorMountOptions
} from "../../../packages/game-editor/src";
import { mountPatternGame } from "./gameHost";
import { Language } from "@edu-play/game-core";

function toTemplateLanguage(language?: string): Language | undefined {
    if (language === "ro" || language === "en") {
        return language;
    }

    return undefined;
}

export const patternGameEditorAdapter: EditorGameAdapter = {
    id: "pattern-game",
    label: "Pattern Game",
    description: "Preview the current Phaser pattern-game runtime inside the shared Submerged Studio shell.",
    templateBasePath: "./activities",
    catalogUrl: "./editor-catalogs/pattern-game.json",
    defaultState: {
        gameId: "shapes-pattern-01",
        language: "en",
        muted: false
    },
    mount(container: HTMLElement, options: EditorMountOptions) {
        return mountPatternGame(container, {
            ...options,
            language: toTemplateLanguage(options.language)
        });
    }
};
