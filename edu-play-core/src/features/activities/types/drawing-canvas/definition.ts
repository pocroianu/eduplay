import type { ActivityTypeDefinition } from '../../types';
import { DrawingCanvasRenderer } from './DrawingCanvasRenderer';
import {
  drawingCanvasConfigSchema,
  type DrawingCanvasConfig,
  type DrawingCanvasResult,
} from './config';

/**
 * Registry definition for the drawing-canvas activity type.
 *
 * The renderer owns the submit pipeline (PNG dataURL → server action →
 * portfolio row), so `resultCollector` is unreachable on the happy path.
 * Throwing keeps a future shell wiring loud-and-broken if it ever tries to
 * round-trip the result through the legacy collector contract — quieter
 * stubs hid latent data-integrity bugs in code review.
 */
export const drawingCanvasDefinition: ActivityTypeDefinition<
  DrawingCanvasConfig,
  DrawingCanvasResult
> = {
  typeId: 'drawing-canvas',
  displayName: 'Desenul tău',
  icon: 'Palette',
  configSchema: drawingCanvasConfigSchema,
  RendererComponent: DrawingCanvasRenderer,
  resultCollector: async () => {
    throw new Error(
      'drawing-canvas: use submitDrawingArtifact action directly; resultCollector is not the submit path',
    );
  },
};
