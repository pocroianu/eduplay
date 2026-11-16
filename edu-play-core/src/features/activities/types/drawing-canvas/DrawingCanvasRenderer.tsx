'use client';

import {
  useCallback,
  useId,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Radio } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Button,
  ConfirmDialog,
  MantineBoundary,
  RewardModal,
} from '@/shared/components/ui/kit';
import { Icon } from '@/shared/components/ui/Icon';
import { ROUTES } from '@/shared/lib/constants/routes';
import { cn } from '@/shared/lib/utils/cn';
import type { ActivityRendererProps } from '../../types';
import { submitDrawingArtifact } from './actions';
import {
  useNativeSubmission,
  NativeSubmissionNotice,
} from '../../submission/use-native-submission';
import {
  BACKGROUND_COLOR_TOKENS,
  BRUSH_INDICATOR_PX,
  BRUSH_LABELS,
  BRUSH_SIZES,
  BRUSH_STROKE_PX,
  PALETTE,
  getPaletteSwatch,
  type DrawingCanvasConfig,
  type DrawingCanvasResult,
  type PaletteColorId,
} from './config';
import {
  brushReducer,
  initialBrushState,
  scaleBrushState,
  selectCanRedo,
  selectCanUndo,
  selectIsEmpty,
  type CanvasPoint,
  type Stroke,
} from './brush-state';

const CANVAS_HEIGHT_PX = 480;

type RendererProps = ActivityRendererProps<
  DrawingCanvasConfig,
  DrawingCanvasResult
>;

/**
 * Drawing-canvas renderer for the F9 player shell.
 *
 * Owns its own pointer-event loop, a pure brush-state reducer (see
 * `./brush-state`), and the submit pipeline (PNG dataURL → server-action
 * `submitDrawingArtifact` → `<RewardModal>` → student dashboard).
 *
 * Pointer events are normalized via `setPointerCapture` so a stroke that
 * leaves the canvas keeps tracking until pointerup, matching native paint
 * apps' behavior. The canvas is rendered at devicePixelRatio for crisp
 * lines on retina displays; export size matches the on-screen render.
 */
export function DrawingCanvasRenderer({
  instanceId,
  config,
  onComplete,
  onCancel,
}: RendererProps) {
  const reduceMotion = useReducedMotion();
  const submission = useNativeSubmission(instanceId);
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const [state, dispatch] = useReducer(brushReducer, initialBrushState);
  const stateRef = useRef(state);
  const canvasSizeRef = useRef<CanvasDisplaySize | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [retryOnly, setRetryOnly] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rewardArtifact, setRewardArtifact] = useState<string | null>(null);
  const submittedImage = useRef<string | null>(null);

  const canUndo = selectCanUndo(state);
  const canRedo = selectCanRedo(state);
  const isEmpty = selectIsEmpty(state);

  const backgroundCssVar = BACKGROUND_COLOR_TOKENS[config.backgroundColor];
  const encouragementText = useMemo(() => {
    if (config.mode === 'guided' && config.prompt) {
      return `${config.prompt} Eu te ascult.`;
    }
    return 'Hai să desenăm! Alege o culoare și începe.';
  }, [config.mode, config.prompt]);

  // Refs that always point at the latest stroke state. The resize observer
  // captures these once when its effect mounts, so without the refs it would
  // close over `state.strokes`/`state.pending` as they were at observer-mount
  // time and repaint a blank canvas after a window resize / orientation
  // change. Refs let the observer always see the live strokes.
  const strokesRef = useRef(state.strokes);
  const pendingRef = useRef(state.pending);
  stateRef.current = state;
  strokesRef.current = state.strokes;
  pendingRef.current = state.pending;

  // Repaint the canvas whenever strokes change. Cheap full-redraw —
  // <50 strokes is the realistic ceiling for a kid drawing in a single
  // session, well within frame budget on a low-end Chromebook.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    redrawCanvas(canvas, state.strokes, state.pending, backgroundCssVar);
  }, [state.strokes, state.pending, backgroundCssVar]);

  // Resize the backing store on first paint and whenever the layout box
  // changes, so the canvas stays crisp when a parent panel reflows. The
  // observer reads from refs, not the captured state, so a resize after
  // the child has drawn a few strokes still repaints the live work.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      const previousSize = canvasSizeRef.current;
      const nextSize = getCanvasDisplaySize(canvas);
      let strokesForRedraw = strokesRef.current;
      let pendingForRedraw = pendingRef.current;

      if (
        previousSize &&
        previousSize.width > 0 &&
        previousSize.height > 0 &&
        nextSize.width > 0 &&
        nextSize.height > 0 &&
        (previousSize.width !== nextSize.width ||
          previousSize.height !== nextSize.height)
      ) {
        const scaleX = nextSize.width / previousSize.width;
        const scaleY = nextSize.height / previousSize.height;
        const scaledState = scaleBrushState(stateRef.current, scaleX, scaleY);
        stateRef.current = scaledState;
        strokesRef.current = scaledState.strokes;
        pendingRef.current = scaledState.pending;
        strokesForRedraw = scaledState.strokes;
        pendingForRedraw = scaledState.pending;
        dispatch({ type: 'scale-strokes', scaleX, scaleY });
      }

      canvasSizeRef.current = nextSize;
      sizeCanvasToDisplay(canvas, nextSize);
      redrawCanvas(
        canvas,
        strokesForRedraw,
        pendingForRedraw,
        backgroundCssVar,
      );
    };

    handleResize();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(handleResize);
    if (typeof observer?.observe !== 'function') return;
    observer.observe(canvas);
    return () => {
      if (typeof observer?.disconnect === 'function') observer.disconnect();
    };
  }, [backgroundCssVar]);

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (
        submitting ||
        retryOnly ||
        submission.recovering ||
        submission.recoveryError ||
        submission.alreadySaved
      )
        return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (activePointerIdRef.current !== null || e.isPrimary === false) return;
      e.preventDefault();
      activePointerIdRef.current = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      dispatch({ type: 'begin-stroke', point: pointFromEvent(canvas, e) });
    },
    [submitting, retryOnly, submission],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (submitting) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (activePointerIdRef.current !== e.pointerId) return;
      // Only extend if the pointer is currently captured by us — avoids
      // hover-tracking noise from a mouse hovering over the canvas.
      if (!canvas.hasPointerCapture(e.pointerId)) return;
      dispatch({ type: 'extend-stroke', point: pointFromEvent(canvas, e) });
    },
    [submitting],
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (activePointerIdRef.current !== e.pointerId) return;
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      activePointerIdRef.current = null;
      dispatch({ type: 'commit-stroke' });
    },
    [],
  );

  const handlePointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (activePointerIdRef.current !== e.pointerId) return;
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      activePointerIdRef.current = null;
      dispatch({ type: 'cancel-stroke' });
    },
    [],
  );

  const handleColorSelect = useCallback((color: PaletteColorId) => {
    dispatch({ type: 'set-color', color });
  }, []);

  const handleSubmit = useCallback(async () => {
    const canvas = canvasRef.current;
    if (
      !canvas ||
      isEmpty ||
      submitting ||
      submission.recovering ||
      submission.recoveryError ||
      submission.alreadySaved
    )
      return;
    setSubmitError(null);
    setSubmitting(true);
    const dataUrl = submittedImage.current ?? canvas.toDataURL('image/png');
    submittedImage.current = dataUrl;
    try {
      const result = await submitDrawingArtifact({
        instanceId,
        submissionId: submission.submissionId(),
        dataUrl,
      });
      if (!result.success) {
        setRetryOnly(!result.canEdit);
        if (result.canEdit) {
          submittedImage.current = null;
          submission.startAgain();
        }
        setSubmitError(
          result.error ?? 'Hopa, n-am reușit să trimit. Încearcă încă o dată.',
        );
        return;
      }
      if (result.data) submission.saved(result.data);
      setRewardArtifact(dataUrl);
      // Forward only the durable artifact id. The shell's preview line
      // stringifies whatever it gets, so passing the raw PNG dataURL would
      // dump multi-megabyte base64 under the canvas (especially in the
      // "Mai desenez" path where the modal closes without navigating away).
      onComplete({ artifactId: result.data?.artifactId ?? '' });
    } catch {
      setRetryOnly(true);
      setSubmitError('Hopa, n-am reușit să trimit. Încearcă încă o dată.');
    } finally {
      setSubmitting(false);
    }
  }, [instanceId, isEmpty, onComplete, submission, submitting]);

  const handleClearConfirm = useCallback(() => {
    if (retryOnly) return;
    dispatch({ type: 'clear' });
    setConfirmingClear(false);
  }, [retryOnly]);

  const handleRewardDismiss = useCallback(() => {
    setRewardArtifact(null);
    router.push(ROUTES.STUDENT.DASHBOARD);
    onCancel();
  }, [router, onCancel]);

  const handleRewardAgain = useCallback(() => {
    submittedImage.current = null;
    setRetryOnly(false);
    submission.startAgain();
    setRewardArtifact(null);
    setSubmitError(null);
    dispatch({ type: 'clear' });
  }, [submission]);

  return (
    <div className="flex flex-col gap-5" data-testid="drawing-canvas-renderer">
      <NativeSubmissionNotice
        submission={submission}
        onStartAgain={handleRewardAgain}
      />
      <p className="text-body text-on-surface text-center" role="status">
        {encouragementText}
      </p>

      <ToolBar
        currentSize={state.size}
        currentColor={state.color}
        onSelectSize={(size) => dispatch({ type: 'set-size', size })}
        onSelectColor={handleColorSelect}
        disabled={submitting}
      />

      <motion.div
        initial={false}
        className="relative w-full"
        animate={
          reduceMotion ? { opacity: 1 } : { opacity: submitting ? 0.85 : 1 }
        }
      >
        <canvas
          ref={canvasRef}
          role={isEmpty ? 'application' : 'img'}
          aria-busy={submission.recovering}
          aria-label={
            isEmpty ? 'Suprafață de desen — atinge să desenezi' : 'Desenul tău'
          }
          className="block w-full rounded-xl border border-outline-variant shadow-soft-sm"
          style={{
            height: `${CANVAS_HEIGHT_PX}px`,
            backgroundColor: `var(${backgroundCssVar})`,
            touchAction: 'none',
            cursor: submitting ? 'progress' : 'crosshair',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          data-testid="drawing-canvas-surface"
        />
      </motion.div>

      <ActionBar
        canUndo={canUndo && !retryOnly}
        canRedo={canRedo && !retryOnly}
        canSubmit={
          !isEmpty &&
          !submission.recovering &&
          !submission.recoveryError &&
          !submission.alreadySaved
        }
        submitting={submitting}
        onClear={() => setConfirmingClear(true)}
        onUndo={() => dispatch({ type: 'undo' })}
        onRedo={() => dispatch({ type: 'redo' })}
        onSubmit={handleSubmit}
      />

      {submitError ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant bg-error-soft px-4 py-3 text-error shadow-soft-sm"
        >
          <span className="flex items-center gap-2 text-body">
            <Icon name="WarningCircle" size={20} weight="fill" />
            {submitError}
          </span>
          <Button
            variant="primary"
            mode="kid"
            size="lg"
            onClick={handleSubmit}
            disabled={submitting}
          >
            Încearcă din nou
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmingClear}
        title="Ștergi tot desenul?"
        body="Asta nu se poate desface. Tot ce ai desenat dispare."
        confirmLabel="Da, șterge"
        cancelLabel="Nu, mai stau"
        destructive
        icon="Trash"
        onConfirm={handleClearConfirm}
        onCancel={() => setConfirmingClear(false)}
      />

      <RewardModal
        open={rewardArtifact !== null}
        eyebrow="Trimis!"
        title="Frumos desen!"
        subtitle="L-am trimis familiei. Pot să-l vadă diseară."
        mascotMood="cheer"
        rewards={[
          { id: 'xp', tone: 'green', glyph: 'xp', value: '+10', label: 'XP' },
        ]}
        onDismiss={handleRewardDismiss}
        actions={(dismiss) => (
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:gap-3">
            <Button
              mode="kid"
              variant="ghost"
              tone="cream"
              size="lg"
              fullWidth
              onClick={handleRewardAgain}
            >
              Mai desenez
            </Button>
            <Button
              mode="kid"
              variant="primary"
              size="lg"
              fullWidth
              onClick={dismiss}
            >
              Gata
            </Button>
          </div>
        )}
      />
    </div>
  );
}

interface ToolBarProps {
  currentSize: (typeof BRUSH_SIZES)[number];
  currentColor: PaletteColorId;
  onSelectSize: (size: (typeof BRUSH_SIZES)[number]) => void;
  onSelectColor: (color: PaletteColorId) => void;
  disabled: boolean;
}

function ToolBar({
  currentSize,
  currentColor,
  onSelectSize,
  onSelectColor,
  disabled,
}: ToolBarProps) {
  const groupId = useId();
  return (
    <MantineBoundary>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <div
          role="radiogroup"
          aria-label="Mărime pensulă"
          className="flex items-center gap-2"
        >
          {BRUSH_SIZES.map((size) => {
            const selected = size === currentSize;
            return (
              <Radio.Card
                unstyled
                key={size}
                type="button"
                checked={selected}
                name={groupId + '-brush'}
                tabIndex={selected ? 0 : -1}
                aria-label={BRUSH_LABELS[size]}
                disabled={disabled}
                onClick={() => onSelectSize(size)}
                className={cn(
                  'inline-flex h-16 w-16 items-center justify-center rounded-xl border border-outline-variant shadow-soft-sm transition-colors',
                  selected
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-lowest text-on-surface',
                  disabled && 'opacity-50 cursor-not-allowed',
                )}
              >
                <span
                  aria-hidden="true"
                  className="rounded-full"
                  style={{
                    width: `${BRUSH_INDICATOR_PX[size]}px`,
                    height: `${BRUSH_INDICATOR_PX[size]}px`,
                    backgroundColor: 'currentColor',
                  }}
                />
              </Radio.Card>
            );
          })}
        </div>

        <div
          role="radiogroup"
          aria-label="Culoare"
          className="flex items-center gap-2"
        >
          {PALETTE.map((swatch) => {
            const selected = swatch.id === currentColor;
            return (
              <Radio.Card
                unstyled
                key={swatch.id}
                type="button"
                checked={selected}
                name={groupId + '-color'}
                tabIndex={selected ? 0 : -1}
                aria-label={`Culoare ${swatch.label}`}
                data-testid={`drawing-color-${swatch.id}`}
                disabled={disabled}
                onClick={() => onSelectColor(swatch.id)}
                className={cn(
                  'h-16 w-16 rounded-full border border-outline-variant shadow-soft-sm transition-shadow',
                  selected && 'outline outline-2 outline-gold outline-offset-2',
                  disabled && 'opacity-50 cursor-not-allowed',
                )}
                style={{ backgroundColor: `var(${swatch.cssVar})` }}
              />
            );
          })}
        </div>
      </div>
    </MantineBoundary>
  );
}

interface ActionBarProps {
  canUndo: boolean;
  canRedo: boolean;
  canSubmit: boolean;
  submitting: boolean;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSubmit: () => void;
}

function ActionBar({
  canUndo,
  canRedo,
  canSubmit,
  submitting,
  onClear,
  onUndo,
  onRedo,
  onSubmit,
}: ActionBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Button
        mode="kid"
        variant="ghost"
        tone="cream"
        size="lg"
        onClick={onClear}
        disabled={submitting || !canUndo}
        data-testid="drawing-action-clear"
      >
        <Icon name="Trash" size={20} />
        Șterge tot
      </Button>
      <Button
        mode="kid"
        variant="ghost"
        tone="cream"
        size="lg"
        onClick={onUndo}
        disabled={submitting || !canUndo}
        data-testid="drawing-action-undo"
      >
        <Icon name="ArrowCounterClockwise" size={20} />
        Refacere
      </Button>
      <Button
        mode="kid"
        variant="ghost"
        tone="cream"
        size="lg"
        onClick={onRedo}
        disabled={submitting || !canRedo}
        data-testid="drawing-action-redo"
      >
        <Icon name="ArrowClockwise" size={20} />
        Refă din nou
      </Button>
      <Button
        mode="kid"
        variant="primary"
        size="lg"
        onClick={onSubmit}
        disabled={submitting || !canSubmit}
        isPending={submitting}
        data-testid="drawing-action-submit"
      >
        Trimite desenul
        <Icon name="PaperPlaneTilt" size={20} />
      </Button>
    </div>
  );
}

function pointFromEvent(
  canvas: HTMLCanvasElement,
  e: ReactPointerEvent<HTMLCanvasElement>,
): CanvasPoint {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}

interface CanvasDisplaySize {
  width: number;
  height: number;
}

function getCanvasDisplaySize(canvas: HTMLCanvasElement): CanvasDisplaySize {
  const rect = canvas.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

function sizeCanvasToDisplay(
  canvas: HTMLCanvasElement,
  displaySize = getCanvasDisplaySize(canvas),
): void {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const desiredWidth = Math.round(displaySize.width * dpr);
  const desiredHeight = Math.round(displaySize.height * dpr);
  if (canvas.width !== desiredWidth) canvas.width = desiredWidth;
  if (canvas.height !== desiredHeight) canvas.height = desiredHeight;
}

function redrawCanvas(
  canvas: HTMLCanvasElement,
  strokes: ReadonlyArray<Stroke>,
  pending: Stroke | null,
  backgroundCssVar: string,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const cssWidth = canvas.width / dpr;
  const cssHeight = canvas.height / dpr;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  const computed = getComputedStyle(canvas);
  const fillFromVar = computed.getPropertyValue(backgroundCssVar).trim();
  const fill = fillFromVar || computed.backgroundColor || '#ffffff';
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const allStrokes = pending ? [...strokes, pending] : strokes;
  for (const stroke of allStrokes) {
    if (stroke.points.length === 0) continue;
    const swatch = getPaletteSwatch(stroke.color);
    const colorValue = computed.getPropertyValue(swatch.cssVar).trim();
    ctx.strokeStyle = colorValue || '#222222';
    ctx.fillStyle = colorValue || '#222222';
    ctx.lineWidth = BRUSH_STROKE_PX[stroke.size];

    if (stroke.points.length === 1) {
      // A tap with no movement — render as a dot.
      const [p] = stroke.points;
      ctx.beginPath();
      ctx.arc(p.x, p.y, BRUSH_STROKE_PX[stroke.size] / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  }
}
