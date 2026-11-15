import { describe, expect, it, vi } from 'vitest';
import { createActivityPlaySession, type SessionProgressWrite } from './activity-play-session';

const ready = { type: 'ACTIVITY_READY', capabilities: { repeatInstruction: true } };
const progress = { type: 'PROGRESS_UPDATE', currentSet: 1, totalSets: 2, progress: 0.5 };
const completion = { type: 'GAME_COMPLETE', score: 80, timeSpent: 999, totalSets: 2, reason: 'completed' };

describe('Activity play session', () => {
  it('counts active host time, excludes loading and pauses, and freezes completion', () => {
    let clock = 10_000;
    const session = createActivityPlaySession({ now: () => clock });
    clock = 20_000;
    session.receive(ready);
    clock += 2500;
    session.pause(true);
    clock += 100_000;
    session.pause(false);
    clock += 2500;
    expect(session.receive(completion)?.timeSpent).toBe(5);
    clock += 50_000;
    session.tick();
    session.receive(progress);
    expect(session.receive(completion)).toBeNull();
    expect(session.getSnapshot()).toMatchObject({ timeSpent: 5, score: 80, result: { timeSpent: 5 } });
    expect(createActivityPlaySession().getSnapshot().timeSpent).toBe(0);
  });

  it('serializes writes and coalesces newer cumulative progress behind the pending save', async () => {
    let release!: () => void;
    const save = vi.fn<(write: SessionProgressWrite) => Promise<void>>()
      .mockImplementationOnce(() => new Promise(resolve => { release = resolve; }))
      .mockResolvedValue(undefined);
    let clock = 0;
    const session = createActivityPlaySession({ save, now: () => clock, createId: () => 'session' });
    session.receive(ready);
    clock = 5000;
    session.receive(progress);
    clock = 7000;
    session.receive(completion);
    expect(save).toHaveBeenCalledTimes(1);
    release();
    await vi.waitFor(() => expect(session.getSnapshot().saveStatus).toBe('saved'));
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toMatchObject({ sessionId: 'session', sequence: 3, timeSpent: 7, status: 'completed' });
  });

  it('retries an ambiguous failure with the same session and sequence', async () => {
    const save = vi.fn<(write: SessionProgressWrite) => Promise<void>>()
      .mockRejectedValueOnce(new Error('response lost')).mockResolvedValue(undefined);
    const session = createActivityPlaySession({ save, createId: () => 'session' });
    session.receive(completion);
    await vi.waitFor(() => expect(session.getSnapshot().saveStatus).toBe('error'));
    session.retrySave();
    await vi.waitFor(() => expect(session.getSnapshot().saveStatus).toBe('saved'));
    expect(save.mock.calls[1][0]).toEqual(save.mock.calls[0][0]);
  });

  it('keeps a completion queued when an earlier save fails and ignores late events', async () => {
    let reject!: (error: Error) => void;
    const save = vi.fn<(write: SessionProgressWrite) => Promise<void>>()
      .mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }))
      .mockResolvedValue(undefined);
    const session = createActivityPlaySession({ save });
    session.receive(ready);
    session.receive(completion);
    reject(new Error('offline'));
    await vi.waitFor(() => expect(session.getSnapshot().saveStatus).toBe('error'));
    session.receive(progress);
    session.retrySave();
    await vi.waitFor(() => expect(session.getSnapshot().saveStatus).toBe('saved'));
    expect(save.mock.calls[1][0].status).toBe('completed');
  });

  it('normalizes legacy events through the same session lifecycle and ignores malformed input', () => {
    let clock = 0;
    const session = createActivityPlaySession({ now: () => clock });
    session.receive({ type: 'ACTIVITY_READY', capabilities: { repeatInstruction: 'bad' } });
    expect(session.getSnapshot().ready).toBe(false);
    session.receive({ type: 'GAME_EVENT', event: 'game_started', data: {} });
    clock = 3000;
    session.receive({ type: 'GAME_EVENT', event: 'score_update', data: { score: 0 } });
    session.receive({ type: 'GAME_EVENT', event: 'game_completed', data: { score: 0 } });
    expect(session.getSnapshot().result).toMatchObject({ score: 0, timeSpent: 3 });
  });
});
