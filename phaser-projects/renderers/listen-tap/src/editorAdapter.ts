import {
    EditorGameAdapter,
    EditorMountOptions
} from "../../../packages/game-editor/src";
import { mountListenTapGame } from "./gameHost";
import { Language } from "@edu-play/game-core";

function toTemplateLanguage(language?: string): Language | undefined {
    if (language === "ro" || language === "en") {
        return language;
    }

    return undefined;
}

export const listenTapEditorAdapter: EditorGameAdapter = {
    id: "listen-tap",
    label: "Listen & Tap",
    description: "Preview the current Phaser listen-tap runtime inside the shared Submerged Studio shell.",
    templateBasePath: "./activities",
    catalogUrl: "./editor-catalogs/listen-tap.json",
    defaultState: {
        gameId: "phonics-ro-01",
        language: "ro",
        muted: false
    },
    mount(container: HTMLElement, options: EditorMountOptions) {
        return mountListenTapGame(container, {
            ...options,
            language: toTemplateLanguage(options.language)
        });
    }
};
