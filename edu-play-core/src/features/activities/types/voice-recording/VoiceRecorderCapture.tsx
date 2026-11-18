'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChunkyButton } from '@/shared/components/ui/kit';
import { Icon } from '@/shared/components/ui/Icon';
import {
  initialVoiceState,
  isPastHardCap,
  isPastSoftCap,
  isWarningCap,
  RECORDING_HARD_CAP_MS,
  RECORDING_SOFT_CAP_MS,
  voiceReducer,
  type VoiceTake,
} from './state-machine';
import { pickRecorderMime } from './recorder';

const TICK_INTERVAL_MS = 200;

export interface VoiceRecorderCaptureProps {
  promptText?: string;
  onTakeReady: (take: VoiceTake) => void;
  onTakeCleared?: () => void;
}

function formatSeconds(elapsedMs: number): string {
  const total = Math.max(0, Math.floor(elapsedMs / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function isMediaRecorderTypeSupported(type: string): boolean {
  if (typeof MediaRecorder === 'undefined') return false;
  try {
    return MediaRecorder.isTypeSupported(type);
  } catch {
    return false;
  }
}

function stopTracks(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // best-effort cleanup
    }
  }
}

export function VoiceRecorderCapture({
  promptText,
  onTakeReady,
  onTakeCleared,
}: VoiceRecorderCaptureProps) {
  const [state, dispatch] = useReducer(voiceReducer, initialVoiceState);
  const shouldReduceMotion = useReducedMotion();

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickHandleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playbackUrlRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const ignoreRecorderStopRef = useRef(false);

  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);

  const stopMediaPipeline = useCallback(
    (options?: { ignoreStopEvent?: boolean }) => {
      if (options?.ignoreStopEvent) {
        ignoreRecorderStopRef.current = true;
      }
      if (tickHandleRef.current !== null) {
        clearInterval(tickHandleRef.current);
        tickHandleRef.current = null;
      }
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {
          // best-effort cleanup
        }
      }
      recorderRef.current = null;
      if (streamRef.current) {
        stopTracks(streamRef.current);
        streamRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopMediaPipeline({ ignoreStopEvent: true });
      if (playbackUrlRef.current) {
        URL.revokeObjectURL(playbackUrlRef.current);
        playbackUrlRef.current = null;
      }
    };
  }, [stopMediaPipeline]);

  const drawStaticBars = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = getComputedStyle(canvas).color;
    const bars = 18;
    const barWidth = width / bars;
    for (let i = 0; i < bars; i += 1) {
      const ratio = shouldReduceMotion ? 0.45 : 0.25 + ((i % 5) + 1) * 0.12;
      const barHeight = Math.max(4, height * Math.min(ratio, 0.9));
      const x = i * barWidth;
      const y = (height - barHeight) / 2;
      ctx.fillRect(x + 2, y, Math.max(2, barWidth - 4), barHeight);
    }
  }, [shouldReduceMotion]);

  const beginRecording = useCallback(async () => {
    const probe = pickRecorderMime(isMediaRecorderTypeSupported);
    if (!probe) {
      dispatch({ type: 'device_unsupported' });
      return;
    }
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      dispatch({ type: 'device_unsupported' });
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      if (isMountedRef.current) {
        dispatch({ type: 'permission_denied' });
      }
      return;
    }
    if (!isMountedRef.current) {
      stopTracks(stream);
      return;
    }
    streamRef.current = stream;
    ignoreRecorderStopRef.current = false;
    dispatch({ type: 'permission_granted' });

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: probe.recorderType });
    } catch {
      stopMediaPipeline();
      dispatch({ type: 'device_unsupported' });
      return;
    }
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.addEventListener('dataavailable', (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    });

    recorder.addEventListener('stop', async () => {
      if (ignoreRecorderStopRef.current || !isMountedRef.current) {
        chunksRef.current = [];
        return;
      }
      const recordedAt = startedAtRef.current;
      const durationMs = recordedAt > 0 ? Date.now() - recordedAt : 0;
      const finalBlob = new Blob(chunksRef.current, { type: probe.mime });
      chunksRef.current = [];
      const arrayBuffer = await finalBlob.arrayBuffer();
      if (ignoreRecorderStopRef.current || !isMountedRef.current) {
        return;
      }
      const take: VoiceTake = {
        blob: new Uint8Array(arrayBuffer),
        mime: probe.mime,
        durationMs,
      };
      if (playbackUrlRef.current) {
        URL.revokeObjectURL(playbackUrlRef.current);
      }
      const url = URL.createObjectURL(finalBlob);
      playbackUrlRef.current = url;
      setPlaybackUrl(url);
      dispatch({ type: 'recording_stopped', take });
      onTakeReady(take);
      stopMediaPipeline();
    });

    startedAtRef.current = Date.now();
    recorder.start();
    drawStaticBars();

    tickHandleRef.current = setInterval(() => {
      const elapsedMs = Date.now() - startedAtRef.current;
      dispatch({ type: 'tick', elapsedMs });
      drawStaticBars();
      if (isPastHardCap(elapsedMs) && recorder.state !== 'inactive') {
        recorder.stop();
      }
    }, TICK_INTERVAL_MS);
  }, [drawStaticBars, onTakeReady, stopMediaPipeline]);

  const handleStartPressed = useCallback(() => {
    dispatch({ type: 'start_pressed' });
    void beginRecording();
  }, [beginRecording]);

  const handleStopPressed = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  }, []);

  const handleReRecordPressed = useCallback(() => {
    if (playbackUrlRef.current) {
      URL.revokeObjectURL(playbackUrlRef.current);
      playbackUrlRef.current = null;
    }
    setPlaybackUrl(null);
    onTakeCleared?.();
    dispatch({ type: 're_record' });
    void beginRecording();
  }, [beginRecording, onTakeCleared]);

  if (state.stage === 'device_unsupported') {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <Icon name="MicrophoneSlash" size="xl" />
        <h2 className="text-title font-headline text-on-surface">
          Dispozitivul tău nu poate înregistra
        </h2>
        <p className="max-w-md text-body text-on-surface-variant">
          Browserul nu acceptă înregistrarea audio. Încearcă pe alt dispozitiv.
        </p>
      </div>
    );
  }

  if (state.stage === 'permission_denied') {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <Icon name="MicrophoneSlash" size="xl" />
        <h2 className="text-title font-headline text-on-surface">
          Avem nevoie să folosim microfonul
        </h2>
        <p className="max-w-md text-body text-on-surface-variant">
          Browserul a refuzat accesul. Apasă pictograma microfonului din bara de
          adresă și alege „Permite”, apoi încearcă din nou.
        </p>
        <ChunkyButton
          variant="green"
          size="lg"
          icon="Microphone"
          onClick={handleStartPressed}
        >
          Încearcă din nou
        </ChunkyButton>
      </div>
    );
  }

  if (state.stage === 'idle' || state.stage === 'requesting') {
    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center">
        {promptText ? (
          <div className="max-w-xl rounded-md bg-primary-soft px-6 py-4">
            <p className="text-body font-bold text-primary-deep">
              {promptText}
            </p>
          </div>
        ) : null}
        <p className="max-w-md text-body text-on-surface-variant">
          Apasă butonul de mai jos ca să pornești microfonul. Avem nevoie de
          permisiunea ta înainte să începem.
        </p>
        <ChunkyButton
          variant="green"
          size="lg"
          icon="Microphone"
          onClick={handleStartPressed}
          disabled={state.stage === 'requesting'}
          aria-label="Pornește înregistrarea"
        >
          {state.stage === 'requesting' ? 'Se pregătește...' : 'Înregistrează'}
        </ChunkyButton>
      </div>
    );
  }

  if (state.stage === 'recording') {
    const past = isPastSoftCap(state.elapsedMs);
    const warn = isWarningCap(state.elapsedMs);
    const cappedElapsed = Math.min(state.elapsedMs, RECORDING_HARD_CAP_MS);
    return (
      <div className="flex flex-col items-center gap-6 py-4">
        {promptText ? (
          <div className="max-w-xl rounded-md bg-primary-soft px-6 py-4 text-center">
            <p className="text-body font-bold text-primary-deep">
              {promptText}
            </p>
          </div>
        ) : null}
        <div className="flex items-center gap-3" aria-live="polite">
          <span
            aria-hidden="true"
            className={`inline-flex h-3 w-3 rounded-full ${
              shouldReduceMotion ? 'bg-coral' : 'animate-pulse bg-coral'
            }`}
          />
          <span
            className={`text-title font-headline tabular-nums ${
              past ? 'text-error' : warn ? 'text-warning' : 'text-on-surface'
            }`}
            data-testid="voice-elapsed"
          >
            {formatSeconds(cappedElapsed)}
          </span>
          <span className="text-body-sm tabular-nums text-on-surface-variant">
            / {formatSeconds(RECORDING_SOFT_CAP_MS)}
          </span>
        </div>
        {warn ? (
          <p className="text-body-sm text-warning" role="status">
            Timpul aproape s-a terminat. Încheie acum sau apasă „Oprește”.
          </p>
        ) : null}
        {past ? (
          <p className="text-body-sm text-error" role="status">
            Ai depășit minutul. Apasă „Oprește” ca să salvezi.
          </p>
        ) : null}
        <motion.canvas
          ref={canvasRef}
          width={320}
          height={80}
          className="rounded-md bg-surface-container text-primary"
          aria-label="Vizualizare nivel microfon"
          role="img"
          initial={false}
          animate={
            shouldReduceMotion ? undefined : { opacity: [0.85, 1, 0.85] }
          }
          transition={
            shouldReduceMotion
              ? undefined
              : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
          }
        />
        <ChunkyButton
          variant="coral"
          size="lg"
          icon="Pause"
          onClick={handleStopPressed}
          aria-label="Oprește înregistrarea"
        >
          Oprește
        </ChunkyButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <p className="max-w-md text-center text-body text-on-surface-variant">
        Ascultă-te înainte să trimiți. Dacă vrei, poți înregistra din nou.
      </p>
      {playbackUrl ? (
        <audio
          controls
          src={playbackUrl}
          className="w-full max-w-md"
          data-testid="voice-playback"
        />
      ) : null}
      <ChunkyButton
        variant="ghost"
        size="lg"
        icon="ArrowCounterClockwise"
        onClick={handleReRecordPressed}
        aria-label="Înregistrează din nou"
      >
        Reînregistrează
      </ChunkyButton>
    </div>
  );
}

export type { VoiceTake } from './state-machine';
