import {
    EditorGameAdapter,
    EditorMountOptions
} from "../../../packages/game-editor/src";
import { mountSequenceGame } from "./gameHost";
import { Language } from "@edu-play/game-core";

function toTemplateLanguage(language?: string): Language | undefined {
    if (language === "ro" || language === "en") {
        return language;
    }

    return undefined;
}

export const sequenceOrderEditorAdapter: EditorGameAdapter = {
    id: "sequence-order",
    label: "Sequence Order",
    description: "Preview the current Phaser sequence-order runtime inside the shared Submerged Studio shell.",
    templateBasePath: "./activities",
    catalogUrl: "./editor-catalogs/sequence-order.json",
    defaultState: {
        gameId: "numbers-1-to-6",
        language: "en",
        muted: false
    },
    mount(container: HTMLElement, options: EditorMountOptions) {
        return mountSequenceGame(container, {
            ...options,
            language: toTemplateLanguage(options.language)
        });
    }
};
