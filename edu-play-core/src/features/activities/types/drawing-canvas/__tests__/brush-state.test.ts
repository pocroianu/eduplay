import { describe, expect, it } from 'vitest';
import {
  brushReducer,
  initialBrushState,
  selectCanRedo,
  selectCanUndo,
  selectIsEmpty,
  selectStrokeCount,
} from '../brush-state';

const POINT_A = { x: 10, y: 20 };
const POINT_B = { x: 30, y: 40 };
const POINT_C = { x: 50, y: 60 };

describe('brushReducer — selection actions', () => {
  it('updates the active color', () => {
    const state = brushReducer(initialBrushState, {
      type: 'set-color',
      color: 'coral',
    });
    expect(state.color).toBe('coral');
  });

  it('updates the active brush size', () => {
    const state = brushReducer(initialBrushState, {
      type: 'set-size',
      size: 'large',
    });
    expect(state.size).toBe('large');
  });
});

describe('brushReducer — stroke lifecycle', () => {
  it('begins a stroke into pending without committing it', () => {
    const state = brushReducer(initialBrushState, {
      type: 'begin-stroke',
      point: POINT_A,
    });
    expect(state.pending?.points).toEqual([POINT_A]);
    expect(selectStrokeCount(state)).toBe(0);
    expect(selectIsEmpty(state)).toBe(false); // pending counts as not-empty
  });

  it('extends the pending stroke as more points come in', () => {
    let state = brushReducer(initialBrushState, {
      type: 'begin-stroke',
      point: POINT_A,
    });
    state = brushReducer(state, { type: 'extend-stroke', point: POINT_B });
    state = brushReducer(state, { type: 'extend-stroke', point: POINT_C });
    expect(state.pending?.points).toEqual([POINT_A, POINT_B, POINT_C]);
  });

  it('ignores extend-stroke when there is no pending stroke (defensive)', () => {
    const state = brushReducer(initialBrushState, {
      type: 'extend-stroke',
      point: POINT_A,
    });
    expect(state.pending).toBeNull();
    expect(selectStrokeCount(state)).toBe(0);
  });

  it('commits the pending stroke onto the strokes list', () => {
    let state = brushReducer(initialBrushState, {
      type: 'begin-stroke',
      point: POINT_A,
    });
    state = brushReducer(state, { type: 'extend-stroke', point: POINT_B });
    state = brushReducer(state, { type: 'commit-stroke' });
    expect(state.pending).toBeNull();
    expect(selectStrokeCount(state)).toBe(1);
    expect(state.strokes[0].points).toEqual([POINT_A, POINT_B]);
  });

  it('cancel-stroke discards a pending stroke without committing', () => {
    let state = brushReducer(initialBrushState, {
      type: 'begin-stroke',
      point: POINT_A,
    });
    state = brushReducer(state, { type: 'cancel-stroke' });
    expect(state.pending).toBeNull();
    expect(selectStrokeCount(state)).toBe(0);
  });

  it('captures the active color and size at stroke-begin time', () => {
    let state = brushReducer(initialBrushState, {
      type: 'set-color',
      color: 'gold',
    });
    state = brushReducer(state, { type: 'set-size', size: 'large' });
    state = brushReducer(state, { type: 'begin-stroke', point: POINT_A });
    state = brushReducer(state, { type: 'commit-stroke' });
    // Even if we change color/size after the commit, the stroke keeps its
    // values — strokes are immutable history.
    state = brushReducer(state, { type: 'set-color', color: 'blue' });
    expect(state.strokes[0].color).toBe('gold');
    expect(state.strokes[0].size).toBe('large');
  });

  it('assigns monotonically increasing stroke ids', () => {
    let state = brushReducer(initialBrushState, {
      type: 'begin-stroke',
      point: POINT_A,
    });
    state = brushReducer(state, { type: 'commit-stroke' });
    state = brushReducer(state, { type: 'begin-stroke', point: POINT_B });
    state = brushReducer(state, { type: 'commit-stroke' });
    expect(state.strokes.map((s) => s.id)).toEqual([1, 2]);
  });

  it('scales committed and pending stroke points when the canvas size changes', () => {
    let state = commitOneStroke(initialBrushState, POINT_A);
    state = brushReducer(state, { type: 'begin-stroke', point: POINT_B });
    state = brushReducer(state, {
      type: 'scale-strokes',
      scaleX: 2,
      scaleY: 0.5,
    });

    expect(state.strokes[0].points).toEqual([{ x: 20, y: 10 }]);
    expect(state.pending?.points).toEqual([{ x: 60, y: 20 }]);
  });
});

describe('brushReducer — undo / redo', () => {
  it('cannot undo when no strokes are committed', () => {
    expect(selectCanUndo(initialBrushState)).toBe(false);
    const noop = brushReducer(initialBrushState, { type: 'undo' });
    expect(noop).toBe(initialBrushState);
  });

  it('moves the most recent stroke into the redo stack on undo', () => {
    let state = commitOneStroke(initialBrushState, POINT_A);
    state = commitOneStroke(state, POINT_B);
    expect(selectStrokeCount(state)).toBe(2);

    state = brushReducer(state, { type: 'undo' });
    expect(selectStrokeCount(state)).toBe(1);
    expect(state.redoStack).toHaveLength(1);
    expect(selectCanRedo(state)).toBe(true);
  });

  it('redo replays the most recently undone stroke', () => {
    let state = commitOneStroke(initialBrushState, POINT_A);
    state = commitOneStroke(state, POINT_B);
    state = brushReducer(state, { type: 'undo' });
    state = brushReducer(state, { type: 'redo' });
    expect(selectStrokeCount(state)).toBe(2);
    expect(selectCanRedo(state)).toBe(false);
  });

  it('supports nested undo / redo across multiple strokes', () => {
    let state = initialBrushState;
    state = commitOneStroke(state, POINT_A);
    state = commitOneStroke(state, POINT_B);
    state = commitOneStroke(state, POINT_C);

    state = brushReducer(state, { type: 'undo' });
    state = brushReducer(state, { type: 'undo' });
    expect(selectStrokeCount(state)).toBe(1);
    expect(state.redoStack).toHaveLength(2);

    state = brushReducer(state, { type: 'redo' });
    state = brushReducer(state, { type: 'redo' });
    expect(selectStrokeCount(state)).toBe(3);
    expect(selectCanRedo(state)).toBe(false);
  });

  it('committing a fresh stroke discards the redo stack (new branch)', () => {
    let state = commitOneStroke(initialBrushState, POINT_A);
    state = commitOneStroke(state, POINT_B);
    state = brushReducer(state, { type: 'undo' });
    expect(state.redoStack).toHaveLength(1);

    state = commitOneStroke(state, POINT_C);
    expect(state.redoStack).toHaveLength(0);
    expect(selectCanRedo(state)).toBe(false);
  });

  it('clear empties strokes, pending, and redoStack atomically', () => {
    let state = commitOneStroke(initialBrushState, POINT_A);
    state = commitOneStroke(state, POINT_B);
    state = brushReducer(state, { type: 'undo' });
    state = brushReducer(state, { type: 'begin-stroke', point: POINT_C });
    expect(state.redoStack).toHaveLength(1);
    expect(state.pending).not.toBeNull();

    state = brushReducer(state, { type: 'clear' });
    expect(selectStrokeCount(state)).toBe(0);
    expect(state.redoStack).toHaveLength(0);
    expect(state.pending).toBeNull();
    expect(selectIsEmpty(state)).toBe(true);
  });
});

function commitOneStroke(
  state: ReturnType<typeof brushReducer> | typeof initialBrushState,
  point: { x: number; y: number },
) {
  const begun = brushReducer(state, { type: 'begin-stroke', point });
  return brushReducer(begun, { type: 'commit-stroke' });
}
