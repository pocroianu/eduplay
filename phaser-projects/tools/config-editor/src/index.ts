import "../../../packages/game-editor/src/styles.css";
import { createGameEditor } from "../../../packages/game-editor/src";
import { editorGameRegistry } from "./gameRegistry";

const root = document.getElementById("app");

if (!root) {
	throw new Error("Missing #app mount point");
}

void createGameEditor({
	root,
	adapters: editorGameRegistry
});
