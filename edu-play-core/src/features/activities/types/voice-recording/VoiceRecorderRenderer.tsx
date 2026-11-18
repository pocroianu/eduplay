'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChunkyButton } from '@/shared/components/ui/kit';
import { Icon } from '@/shared/components/ui/Icon';
import { submitVoiceRecordingArtifact } from './actions';
import {
  useNativeSubmission,
  NativeSubmissionNotice,
} from '../../submission/use-native-submission';
import type { ActivityRendererProps } from '../../types';
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

export interface VoiceRecordingConfig {
  /** Optional Romanian prompt the student is asked to read aloud. */
  promptText?: string;
}

export interface VoiceRecordingResult {
  artifactId: string;
}

const TICK_INTERVAL_MS = 200;

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
      // best-effort
    }
  }
}

export function VoiceRecorderRenderer({
  instanceId,
  config,
  onComplete,
}: ActivityRendererProps<VoiceRecordingConfig, VoiceRecordingResult>) {
  const [state, dispatch] = useReducer(voiceReducer, initialVoiceState);
  const submission = useNativeSubmission(instanceId);
  const [retryOnly, setRetryOnly] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickHandleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
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
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {
          // best-effort
        }
      }
      recorderRef.current = null;
      if (streamRef.current) {
        stopTracks(streamRef.current);
        streamRef.current = null;
      }
      if (audioCtxRef.current) {
        try {
          void audioCtxRef.current.close();
        } catch {
          // best-effort
        }
        audioCtxRef.current = null;
      }
      analyserRef.current = null;
    },
    [],
  );

  // Cleanup on unmount.
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

  const startVisualization = useCallback(
    (stream: MediaStream) => {
      if (shouldReduceMotion) return;
      const AudioCtx =
        typeof window !== 'undefined'
          ? (window.AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext)
          : undefined;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const buffer = new Uint8Array(analyser.frequencyBinCount);

      const draw = () => {
        const canvas = canvasRef.current;
        const localAnalyser = analyserRef.current;
        if (!canvas || !localAnalyser) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        localAnalyser.getByteFrequencyData(buffer);

        const { width, height } = canvas;
        ctx.clearRect(0, 0, width, height);
        const barCount = buffer.length;
        const barWidth = width / barCount;
        const accent = getComputedStyle(canvas).color || '#000';
        ctx.fillStyle = accent;
        for (let i = 0; i < barCount; i++) {
          const value = buffer[i] / 255;
          const barHeight = Math.max(2, value * height * 0.95);
          const x = i * barWidth;
          const y = (height - barHeight) / 2;
          ctx.fillRect(x + 1, y, Math.max(1, barWidth - 2), barHeight);
        }

        animationFrameRef.current = requestAnimationFrame(draw);
      };

      animationFrameRef.current = requestAnimationFrame(draw);
    },
    [shouldReduceMotion],
  );

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
      stopMediaPipeline();
    });

    startedAtRef.current = Date.now();
    recorder.start();

    tickHandleRef.current = setInterval(() => {
      const elapsedMs = Date.now() - startedAtRef.current;
      dispatch({ type: 'tick', elapsedMs });
      if (isPastHardCap(elapsedMs) && recorder.state !== 'inactive') {
        recorder.stop();
      }
    }, TICK_INTERVAL_MS);

    startVisualization(stream);
  }, [startVisualization, stopMediaPipeline]);

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
    submission.startAgain();
    if (playbackUrlRef.current) {
      URL.revokeObjectURL(playbackUrlRef.current);
      playbackUrlRef.current = null;
    }
    setPlaybackUrl(null);
    dispatch({ type: 're_record' });
    void beginRecording();
  }, [beginRecording, submission]);

  const handleSubmitPressed = useCallback(async () => {
    if (!state.take) return;
    dispatch({ type: 'submit_pressed' });
    try {
      const result = await submitVoiceRecordingArtifact({
        instanceId,
        submissionId: submission.submissionId(),
        blob: state.take.blob,
        mime: state.take.mime,
        durationMs: state.take.durationMs,
      });
      if (!result.success || !result.data) {
        setRetryOnly(!result.canEdit);
        dispatch({
          type: 'submit_failed',
          message: result.error ?? 'Nu am putut salva înregistrarea.',
        });
        return;
      }
      submission.saved(result.data);
      dispatch({ type: 'submit_succeeded' });
      onComplete({ artifactId: result.data.artifactId });
    } catch {
      setRetryOnly(true);
      dispatch({
        type: 'submit_failed',
        message: 'Nu am putut salva înregistrarea. Încearcă din nou.',
      });
    }
  }, [instanceId, onComplete, state.take, submission]);

  if (state.stage === 'device_unsupported') {
    return (
      <div className="flex flex-col items-center gap-4 text-center py-8">
        <Icon name="MicrophoneSlash" size="xl" />
        <h2 className="text-title font-headline text-on-surface">
          Dispozitivul tău nu poate înregistra
        </h2>
        <p className="text-body text-on-surface-variant max-w-md">
          Browserul nu acceptă înregistrarea audio. Roagă pe cineva mare să
          deschidă activitatea pe alt dispozitiv.
        </p>
      </div>
    );
  }

  if (state.stage === 'permission_denied') {
    return (
      <div className="flex flex-col items-center gap-4 text-center py-8">
        <Icon name="MicrophoneSlash" size="xl" />
        <h2 className="text-title font-headline text-on-surface">
          Avem nevoie să folosim microfonul
        </h2>
        <p className="text-body text-on-surface-variant max-w-md">
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
      <div className="flex flex-col items-center gap-6 text-center py-8">
        <NativeSubmissionNotice submission={submission} />
        {config.promptText ? (
          <div className="rounded-xl bg-primary-container px-6 py-4 max-w-xl">
            <p className="text-body font-bold text-on-primary-container">
              {config.promptText}
            </p>
          </div>
        ) : null}
        <p className="text-body text-on-surface-variant max-w-md">
          Apasă butonul de mai jos ca să pornești microfonul. Avem nevoie de
          permisiunea ta înainte să începem.
        </p>
        <ChunkyButton
          variant="green"
          size="lg"
          icon="Microphone"
          onClick={handleStartPressed}
          disabled={
            state.stage === 'requesting' ||
            submission.recovering ||
            submission.recoveryError ||
            submission.alreadySaved
          }
          aria-label="Pornește înregistrarea"
        >
          {state.stage === 'requesting' ? 'Se pregătește…' : 'Înregistrează'}
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
        {config.promptText ? (
          <div className="rounded-xl bg-primary-container px-6 py-4 max-w-xl text-center">
            <p className="text-body font-bold text-on-primary-container">
              {config.promptText}
            </p>
          </div>
        ) : null}
        <div className="flex items-center gap-3" aria-live="polite">
          <span
            aria-hidden="true"
            className={`inline-flex h-3 w-3 rounded-full ${
              shouldReduceMotion ? 'bg-coral' : 'bg-coral animate-pulse'
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
          <span className="text-lg text-on-surface-variant tabular-nums">
            / {formatSeconds(RECORDING_SOFT_CAP_MS)}
          </span>
        </div>
        {warn ? (
          <p className="text-lg text-warning" role="status">
            Timpul aproape s-a terminat. Încheie acum sau apasă „Oprește”.
          </p>
        ) : null}
        {past ? (
          <p className="text-lg text-error" role="status">
            Ai depășit minutul. Apasă „Oprește” ca să salvezi.
          </p>
        ) : null}
        <motion.canvas
          ref={canvasRef}
          width={320}
          height={80}
          className="text-primary rounded-md bg-surface-container"
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

  if (state.stage === 'review' || state.stage === 'submit_error') {
    return (
      <div className="flex flex-col items-center gap-6 py-4">
        <p className="text-body text-on-surface-variant max-w-md text-center">
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
        {state.stage === 'submit_error' && state.errorMessage ? (
          <p role="alert" className="text-lg text-error">
            {state.errorMessage}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3 justify-center">
          <ChunkyButton
            variant="ghost"
            size="lg"
            icon="ArrowCounterClockwise"
            onClick={handleReRecordPressed}
            disabled={state.stage === 'submit_error' && retryOnly}
            aria-label="Înregistrează din nou"
          >
            Reînregistrează
          </ChunkyButton>
          <ChunkyButton
            variant="gold"
            size="lg"
            icon="PaperPlaneTilt"
            onClick={handleSubmitPressed}
            aria-label="Trimite înregistrarea"
          >
            Trimite
          </ChunkyButton>
        </div>
      </div>
    );
  }

  if (state.stage === 'submitting') {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <Icon name="CircleNotch" size="xl" />
        <p className="text-body text-on-surface-variant" role="status">
          Salvăm înregistrarea ta…
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <NativeSubmissionNotice
        submission={submission}
        onStartAgain={() => {
          submission.startAgain();
          dispatch({ type: 'new_submission' });
        }}
      />
      <Icon name="CheckCircle" size="xl" weight="fill" />
      <h2 className="text-title font-headline text-on-surface">
        Înregistrarea a fost trimisă!
      </h2>
      <p className="text-body text-on-surface-variant max-w-md">
        Profesorul tău va asculta în curând și o va adăuga în portofoliul
        clasei.
      </p>
    </div>
  );
}
