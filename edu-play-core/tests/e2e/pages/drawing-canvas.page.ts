import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page Object for the F9 drawing-canvas activity player.
 *
 * The drawing canvas is rendered inside `<ActivityPlayer>` at
 * `/student/activities/[instanceId]/play` whenever the instance has
 * `type_id='drawing-canvas'`. Selectors target the renderer-owned
 * `data-testid` hooks so the page object survives copy / styling changes.
 */
export class DrawingCanvasPage extends BasePage {
  readonly canvas: Locator;
  readonly clearAction: Locator;
  readonly undoAction: Locator;
  readonly redoAction: Locator;
  readonly submitAction: Locator;

  constructor(page: Page) {
    super(page);
    this.canvas = page.getByTestId('drawing-canvas-surface');
    this.clearAction = page.getByTestId('drawing-action-clear');
    this.undoAction = page.getByTestId('drawing-action-undo');
    this.redoAction = page.getByTestId('drawing-action-redo');
    this.submitAction = page.getByTestId('drawing-action-submit');
  }

  /** No standalone goto — callers navigate to a specific instance id. */
  async goto(): Promise<void> {
    throw new Error('Use page.goto with the instance-specific play URL');
  }

  get urlPattern(): RegExp {
    return /\/student\/activities\/[^/]+\/play/;
  }

  /**
   * Drive a stroke across the canvas via pointer events. Coordinates are
   * relative to the canvas's bounding box; the stroke walks `steps`
   * intermediate points for stable rasterization.
   */
  async drawStroke(
    from: { x: number; y: number },
    to: { x: number; y: number },
    steps = 12,
  ): Promise<void> {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Drawing canvas is not visible');
    const start = { x: box.x + from.x, y: box.y + from.y };
    const end = { x: box.x + to.x, y: box.y + to.y };

    await this.page.mouse.move(start.x, start.y);
    await this.page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      await this.page.mouse.move(
        start.x + (end.x - start.x) * t,
        start.y + (end.y - start.y) * t,
      );
    }
    await this.page.mouse.up();
  }

  async pickColor(colorId: string): Promise<void> {
    await this.page.getByTestId(`drawing-color-${colorId}`).click();
  }

  async submit(): Promise<void> {
    await this.submitAction.click();
  }
}
