import {
    EditorGameAdapter,
    EditorMountOptions
} from "../../../packages/game-editor/src";
import { mountRepeatSequence } from "./gameHost";
import { Language } from "@edu-play/game-core";

function toTemplateLanguage(language?: string): Language | undefined {
    if (language === "ro" || language === "en") {
        return language;
    }

    return undefined;
}

export const repeatSequenceEditorAdapter: EditorGameAdapter = {
    id: "repeat-sequence",
    label: "Repeat Sequence",
    description: "Preview the current Phaser repeat-sequence runtime inside the shared Submerged Studio shell.",
    templateBasePath: "./activities",
    catalogUrl: "./editor-catalogs/repeat-sequence.json",
    defaultState: {
        gameId: "animals-sequence-01",
        language: "en",
        muted: false
    },
    mount(container: HTMLElement, options: EditorMountOptions) {
        return mountRepeatSequence(container, {
            ...options,
            language: toTemplateLanguage(options.language)
        });
    }
};
