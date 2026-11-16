import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNativeSubmission } from './use-native-submission';
import { recoverNativeActivity } from './native-submission-actions';
vi.mock('./native-submission-actions', () => ({
  recoverNativeActivity: vi.fn(),
}));
const receipt = {
  submissionId: 'd2000000-0000-4000-8000-000000000001',
  artifactId: 'artifact-1',
  progressionPending: true,
};
beforeEach(() => {
  localStorage.clear();
  vi.mocked(recoverNativeActivity).mockResolvedValue([]);
});
describe('native submission recovery', () => {
  it('keeps a retry key across reloads and changes it only for deliberate new work', async () => {
    const first = renderHook(() => useNativeSubmission('instance'));
    await waitFor(() => expect(first.result.current.recovering).toBe(false));
    let key = '';
    act(() => {
      key = first.result.current.submissionId();
    });
    first.unmount();
    const reload = renderHook(() => useNativeSubmission('instance'));
    await waitFor(() => expect(reload.result.current.recovering).toBe(false));
    act(() => expect(reload.result.current.submissionId()).toBe(key));
    act(() => reload.result.current.startAgain());
    act(() => expect(reload.result.current.submissionId()).not.toBe(key));
  });
  it('recovers saved work and retries progression without media bytes', async () => {
    vi.mocked(recoverNativeActivity).mockResolvedValue([receipt]);
    const e = renderHook(() => useNativeSubmission('instance'));
    await waitFor(() => expect(e.result.current.alreadySaved).toBe(true));
    expect(e.result.current.receipts[0].progressionPending).toBe(true);
    vi.mocked(recoverNativeActivity).mockResolvedValue([
      { ...receipt, progressionPending: false },
    ]);
    await act(() => e.result.current.refresh());
    expect(e.result.current.receipts[0].progressionPending).toBe(false);
    act(() => e.result.current.startAgain());
    expect(e.result.current.alreadySaved).toBe(false);
    await act(() => e.result.current.refresh());
    expect(e.result.current.alreadySaved).toBe(false);
  });
});
