import { parseGameToHostMessage, type GameCompleteMessage } from '@edu-play/activity-protocol';
import type { GameCompleteResult } from '../types/game.types';

export type ProgressSaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export interface SessionProgressWrite {
  sessionId: string;
  sequence: number;
  status: 'in_progress' | 'completed';
  score: number;
  timeSpent: number;
  data?: { starRating: number };
}
export interface PlaySessionSnapshot {
  ready: boolean;
  paused: boolean;
  repeatEnabled: boolean;
  score: number;
  timeSpent: number;
  currentSet: number;
  totalSets: number;
  result: GameCompleteResult | null;
  saveStatus: ProgressSaveStatus;
}

/** The host owns time, lifecycle and persistence ordering for a single run. */
export function createActivityPlaySession(options: {
  now?: () => number;
  save?: (write: SessionProgressWrite) => Promise<void>;
  createId?: () => string;
} = {}) {
  const now = options.now ?? (() => performance.now());
  const listeners = new Set<() => void>();
  let state: PlaySessionSnapshot = {
    ready: false, paused: false, repeatEnabled: false, score: 0, timeSpent: 0,
    currentSet: 0, totalSets: 0, result: null, saveStatus: 'idle',
  };
  let activeSince: number | null = null;
  let elapsed = 0;
  let sessionId: string | null = null;
  let sequence = 0;
  let pending: SessionProgressWrite | null = null;
  let saving = false;
  let stopped = false;

  function update(patch: Partial<PlaySessionSnapshot>): void {
    state = { ...state, ...patch };
    listeners.forEach(listener => listener());
  }
  function seconds(): number {
    return Math.floor((elapsed + (activeSince === null ? 0 : Math.max(0, now() - activeSince))) / 1000);
  }
  function stopClock(): void {
    if (activeSince !== null) elapsed += Math.max(0, now() - activeSince);
    activeSince = null;
  }
  async function drain(): Promise<void> {
    if (saving || !pending || !options.save) return;
    saving = true;
    update({ saveStatus: 'saving' });
    while (pending) {
      const write = pending;
      pending = null;
      try {
        await options.save(write);
      } catch {
        // A newer cumulative snapshot safely supersedes an ambiguously saved one.
        pending ??= write;
        saving = false;
        update({ saveStatus: 'error' });
        return;
      }
    }
    saving = false;
    update({ saveStatus: 'saved' });
  }
  function persist(status: SessionProgressWrite['status'], starRating?: number): void {
    if (!options.save) return;
    sessionId ??= (options.createId ?? (() => crypto.randomUUID()))();
    pending = {
      sessionId, sequence: ++sequence, status, score: state.score, timeSpent: seconds(),
      ...(starRating === undefined ? {} : { data: { starRating } }),
    };
    void drain();
  }
  function ready(repeatEnabled = false): void {
    if (state.ready || stopped) return;
    activeSince = now();
    update({ ready: true, repeatEnabled });
    persist('in_progress');
  }
  function pause(paused: boolean): void {
    if (!state.ready || stopped || state.paused === paused) return;
    if (paused) stopClock();
    else activeSince = now();
    update({ paused, timeSpent: seconds() });
    persist('in_progress');
  }
  function complete(message: GameCompleteMessage): GameCompleteMessage | null {
    if (stopped) return null;
    stopClock();
    stopped = true;
    const timeSpent = seconds();
    const starRating = message.starRating ?? Math.max(1, Math.min(3, Math.round(message.score / 100 * 3)));
    const result = { score: message.score, timeSpent, starRating, totalSets: message.totalSets };
    update({ score: message.score, paused: false, timeSpent, totalSets: message.totalSets, result });
    persist('completed', starRating);
    return { ...message, timeSpent, starRating };
  }
  function receive(data: unknown): GameCompleteMessage | null {
    if (stopped) return null;
    const parsed = parseGameToHostMessage(data);
    if (parsed.success) {
      const message = parsed.data;
      switch (message.type) {
        case 'ACTIVITY_READY': ready(Boolean(message.capabilities?.repeatInstruction)); break;
        case 'PROGRESS_UPDATE':
          if (!state.ready) return null;
          update({ currentSet: message.currentSet, totalSets: message.totalSets,
            score: Math.round(message.progress * 100), timeSpent: seconds() });
          persist('in_progress');
          break;
        case 'GAME_COMPLETE': return complete(message);
      }
      return null;
    }
    // Legacy messages enter through the same lifecycle and persistence path.
    if (!data || typeof data !== 'object') return null;
    const legacy = data as { type?: unknown; event?: unknown; data?: { score?: unknown } };
    if (legacy.type !== 'GAME_EVENT' || !legacy.data || typeof legacy.data !== 'object') return null;
    const score = legacy.data.score;
    const validScore = typeof score === 'number' && Number.isFinite(score) && score >= 0;
    switch (legacy.event) {
      case 'game_started': ready(); break;
      case 'game_paused': pause(true); break;
      case 'score_update': if (validScore) update({ score }); break;
      case 'level_completed':
        if (!state.ready) break;
        if (validScore) update({ score });
        persist('in_progress');
        break;
      case 'game_completed': return complete({ type: 'GAME_COMPLETE', score: validScore ? score : state.score,
        totalSets: state.totalSets, timeSpent: seconds(), reason: 'completed' });
    }
    return null;
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    receive, pause,
    tick() { if (activeSince !== null) update({ timeSpent: seconds() }); },
    exit() {
      if (stopped) return;
      stopClock();
      stopped = true;
      update({ timeSpent: seconds(), paused: false });
      if (state.ready) persist('in_progress');
    },
    retrySave: () => { void drain(); },
  };
}

export type ActivityPlaySession = ReturnType<typeof createActivityPlaySession>;
