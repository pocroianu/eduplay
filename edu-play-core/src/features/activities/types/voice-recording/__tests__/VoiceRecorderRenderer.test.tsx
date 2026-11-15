import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceRecorderRenderer } from '../VoiceRecorderRenderer';
vi.mock('../../../submission/native-submission-actions', () => ({ recoverNativeActivity: vi.fn(async () => []) }));

type Listener = (event: Event) => void | Promise<void>;

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  static isTypeSupported = vi.fn(() => true);

  readonly listeners = new Map<string, Listener[]>();
  state: RecordingState = 'inactive';

  constructor(
    readonly stream: MediaStream,
    readonly options?: MediaRecorderOptions,
  ) {
    FakeMediaRecorder.instances.push(this);
    void options;
  }

  addEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  start(): void {
    this.state = 'recording';
  }

  stop(): void {
    this.state = 'inactive';
  }

  async emit(type: string, event = new Event(type)): Promise<void> {
    await Promise.all(
      (this.listeners.get(type) ?? []).map((listener) => listener(event)),
    );
  }
}

function renderRecorder() {
  return render(
    <VoiceRecorderRenderer
      instanceId="activity-instance-1"
      config={{ promptText: 'Spune o propoziție.' }}
      onCancel={vi.fn()}
      onComplete={vi.fn()}
    />,
  );
}

describe('<VoiceRecorderRenderer /> cleanup', () => {
  const originalMediaDevices = navigator.mediaDevices;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalBlobArrayBuffer = Blob.prototype.arrayBuffer;

  beforeEach(() => {
    FakeMediaRecorder.instances = [];
    FakeMediaRecorder.isTypeSupported.mockReturnValue(true);
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    URL.createObjectURL = vi.fn(() => 'blob:voice-take');
    URL.revokeObjectURL = vi.fn();
    Blob.prototype.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0));
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: originalMediaDevices,
    });
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    Blob.prototype.arrayBuffer = originalBlobArrayBuffer;
    vi.unstubAllGlobals();
  });

  it('stops returned mic tracks and skips recorder startup if permission resolves after unmount', async () => {
    let resolveStream!: (stream: MediaStream) => void;
    const getUserMedia = vi.fn(
      () =>
        new Promise<MediaStream>((resolve) => {
          resolveStream = resolve;
        }),
    );
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    const stopTrack = vi.fn();
    const stream = {
      getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream;

    const { unmount } = renderRecorder();
    await waitFor(() => expect(screen.getByRole('button', { name: /pornește înregistrarea/i })).toBeEnabled());

    fireEvent.click(
      screen.getByRole('button', { name: /pornește înregistrarea/i }),
    );
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });

    unmount();
    resolveStream(stream);

    await waitFor(() => expect(stopTrack).toHaveBeenCalledTimes(1));
    expect(FakeMediaRecorder.instances).toHaveLength(0);
  });

  it('ignores recorder stop callbacks that arrive after unmount cleanup', async () => {
    const stopTrack = vi.fn();
    const stream = {
      getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });

    const { unmount } = renderRecorder();
    await waitFor(() => expect(screen.getByRole('button', { name: /pornește înregistrarea/i })).toBeEnabled());

    fireEvent.click(
      screen.getByRole('button', { name: /pornește înregistrarea/i }),
    );
    await waitFor(() => expect(FakeMediaRecorder.instances).toHaveLength(1));
    const recorder = FakeMediaRecorder.instances[0];

    unmount();
    await recorder.emit('stop');

    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
