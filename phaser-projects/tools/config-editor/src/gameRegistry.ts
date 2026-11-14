import { EditorGameAdapter } from "../../../packages/game-editor/src";
import { multipleChoiceEditorAdapter } from "../../../renderers/multiple-choice/src/editorAdapter";
import { matchingGameEditorAdapter } from "../../../renderers/matching-game/src/editorAdapter";
import { categorizeGameEditorAdapter } from "../../../renderers/categorize-game/src/editorAdapter";
import { sequenceOrderEditorAdapter } from "../../../renderers/sequence-order/src/editorAdapter";
import { memoryGameEditorAdapter } from "../../../renderers/memory-game/src/editorAdapter";
import { countingGameEditorAdapter } from "../../../renderers/counting-game/src/editorAdapter";
import { patternGameEditorAdapter } from "../../../renderers/pattern-game/src/editorAdapter";
import { repeatSequenceEditorAdapter } from "../../../renderers/repeat-sequence/src/editorAdapter";
import { listenTapEditorAdapter } from "../../../renderers/listen-tap/src/editorAdapter";
import { tracingGameEditorAdapter } from "../../../renderers/tracing-game/src/editorAdapter";
export const editorGameRegistry: EditorGameAdapter[] = [
    multipleChoiceEditorAdapter,
    matchingGameEditorAdapter,
    categorizeGameEditorAdapter,
    sequenceOrderEditorAdapter,
    memoryGameEditorAdapter,
    countingGameEditorAdapter,
    patternGameEditorAdapter,
    repeatSequenceEditorAdapter,
    listenTapEditorAdapter,
    tracingGameEditorAdapter
];

export function getAdapter(adapterId: string): EditorGameAdapter {
    return editorGameRegistry.find((adapter) => adapter.id === adapterId) ?? editorGameRegistry[0];
}
