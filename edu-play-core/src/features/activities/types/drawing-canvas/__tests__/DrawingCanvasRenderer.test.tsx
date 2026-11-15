import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DrawingCanvasRenderer } from '../DrawingCanvasRenderer';
vi.mock('../../../submission/native-submission-actions', () => ({ recoverNativeActivity: vi.fn(async () => []) }));

vi.mock('../actions', () => ({
  submitDrawingArtifact: vi.fn().mockResolvedValue({
    success: true,
    data: { artifactId: '00000000-0000-0000-0000-00000000abcd' },
  }),
}));

const INSTANCE_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('<DrawingCanvasRenderer />', () => {
  it('supports arrow-key selection in the brush radio group', () => {
    render(<DrawingCanvasRenderer instanceId={INSTANCE_ID}
      config={{ mode: 'freeform', backgroundColor: 'white' }}
      onComplete={vi.fn()} onCancel={vi.fn()} />);
    const brushes = screen.getAllByRole('radio', { name: /pensulă/i });
    const selectedIndex = brushes.findIndex((brush) => brush.getAttribute('aria-checked') === 'true');
    const next = brushes[(selectedIndex + 1) % brushes.length];
    brushes[selectedIndex].focus();
    fireEvent.keyDown(brushes[selectedIndex], { key: 'ArrowRight', code: 'ArrowRight' });
    expect(next).toHaveFocus();
    expect(next).toHaveAttribute('aria-checked', 'true');
    expect(next).toHaveAttribute('tabindex', '0');
  });

  it('renders the toolbar with three brush sizes and six color swatches', () => {
    render(
      <DrawingCanvasRenderer
        instanceId={INSTANCE_ID}
        config={{ mode: 'freeform', backgroundColor: 'white' }}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('radio', { name: /pensulă mică/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: /pensulă mijlocie/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: /pensulă mare/i }),
    ).toBeInTheDocument();

    // Six palette swatches, all aria-labeled.
    expect(screen.getByRole('radio', { name: /negru/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /coral/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /auriu/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /verde/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /albastru/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /mov/i })).toBeInTheDocument();
  });

  it('renders the action bar (clear / undo / redo / submit)', () => {
    render(
      <DrawingCanvasRenderer
        instanceId={INSTANCE_ID}
        config={{ mode: 'freeform', backgroundColor: 'white' }}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: /șterge tot/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refacere/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /refă din nou/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /trimite desenul/i }),
    ).toBeInTheDocument();
  });

  it('disables submit / clear / undo / redo while the canvas is empty', () => {
    render(
      <DrawingCanvasRenderer
        instanceId={INSTANCE_ID}
        config={{ mode: 'freeform', backgroundColor: 'white' }}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: /trimite desenul/i }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: /refacere/i })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /refă din nou/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /șterge tot/i }),
    ).toBeDisabled();
  });

  it('renders the default freeform encouragement copy', () => {
    render(
      <DrawingCanvasRenderer
        instanceId={INSTANCE_ID}
        config={{ mode: 'freeform', backgroundColor: 'white' }}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/hai să desenăm! alege o culoare și începe\./i),
    ).toBeInTheDocument();
  });

  it('renders the guided prompt when one is supplied', () => {
    render(
      <DrawingCanvasRenderer
        instanceId={INSTANCE_ID}
        config={{
          mode: 'guided',
          prompt: 'Desenează animalul preferat.',
          backgroundColor: 'cream',
        }}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/desenează animalul preferat\. eu te ascult\./i),
    ).toBeInTheDocument();
  });

  it('marks the canvas as a kid-mode application before any stroke exists', () => {
    render(
      <DrawingCanvasRenderer
        instanceId={INSTANCE_ID}
        config={{ mode: 'freeform', backgroundColor: 'white' }}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const canvas = screen.getByTestId('drawing-canvas-surface');
    expect(canvas.getAttribute('role')).toBe('application');
    expect(canvas.getAttribute('aria-label')).toMatch(
      /atinge să desenezi/i,
    );
  });

  it('ignores extra pointerdown events while a stroke is already active', async () => {
    render(
      <DrawingCanvasRenderer
        instanceId={INSTANCE_ID}
        config={{ mode: 'freeform', backgroundColor: 'white' }}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const canvas = screen.getByTestId('drawing-canvas-surface');
    const capturedPointers = new Set<number>();
    const setPointerCapture = vi.fn((pointerId: number) => {
      capturedPointers.add(pointerId);
    });

    Object.assign(canvas, {
      setPointerCapture,
      hasPointerCapture: (pointerId: number) => capturedPointers.has(pointerId),
      releasePointerCapture: (pointerId: number) => {
        capturedPointers.delete(pointerId);
      },
    });

    await waitFor(() => expect(canvas).toHaveAttribute('aria-busy', 'false'));
    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      clientX: 24,
      clientY: 32,
      isPrimary: true,
    });
    fireEvent.pointerDown(canvas, {
      pointerId: 2,
      clientX: 48,
      clientY: 64,
      isPrimary: false,
    });

    expect(setPointerCapture).toHaveBeenCalledTimes(1);
    expect(setPointerCapture).toHaveBeenCalledWith(1);
  });
});
