import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.fn();
const getUserMock = vi.fn();
const fromMock = vi.fn();
const profileSingleMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: () => getUserMock() },
    from: (...args: unknown[]) => fromMock(...args),
    rpc: (...args: unknown[]) => rpcMock(...args),
  }),
}));

import { setChildConsent } from '../set-child-consent';

const PARENT_ID = '11111111-1111-4111-8111-111111111111';
const CHILD_ID = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  rpcMock.mockReset();
  getUserMock.mockReset();
  fromMock.mockReset();
  profileSingleMock.mockReset();
  revalidatePathMock.mockReset();
  getUserMock.mockResolvedValue({ data: { user: { id: PARENT_ID } }, error: null });
  profileSingleMock.mockResolvedValue({
    data: { role: 'parent' },
    error: null,
  });
  fromMock.mockReturnValue({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: profileSingleMock,
      })),
    })),
  });
  rpcMock.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('setChildConsent', () => {
  it('forwards a valid input to the SECURITY DEFINER RPC', async () => {
    const result = await setChildConsent({
      childId: CHILD_ID,
      consentKey: 'audio_recording',
      value: true,
    });
    expect(result.success).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith('set_child_consent', {
      p_child_id: CHILD_ID,
      p_consent_key: 'audio_recording',
      p_value: true,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/parent/children/${CHILD_ID}`);
  });

  it('rejects unknown consent keys before reaching the RPC', async () => {
    const result = await setChildConsent({
      childId: CHILD_ID,
      consentKey: 'biometrics',
      value: true,
    });
    expect(result.success).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid childId', async () => {
    const result = await setChildConsent({
      childId: 'not-a-uuid',
      consentKey: 'audio_recording',
      value: true,
    });
    expect(result.success).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('returns the unauthorized error when the parent is not linked', async () => {
    rpcMock.mockResolvedValueOnce({
      error: { code: '42501', message: 'insufficient_privilege' },
    });
    const result = await setChildConsent({
      childId: CHILD_ID,
      consentKey: 'audio_recording',
      value: true,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/permisiunea/i);
  });

  it('rejects authenticated non-parent callers before reaching the RPC', async () => {
    profileSingleMock.mockResolvedValueOnce({
      data: { role: 'teacher' },
      error: null,
    });

    const result = await setChildConsent({
      childId: CHILD_ID,
      consentKey: 'audio_recording',
      value: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/părinții/i);
    expect(rpcMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('returns a generic error on other RPC failures', async () => {
    rpcMock.mockResolvedValueOnce({
      error: { code: 'XX000', message: 'boom' },
    });
    const result = await setChildConsent({
      childId: CHILD_ID,
      consentKey: 'audio_recording',
      value: false,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Nu am putut salva/i);
  });

  it('rejects a request from an unauthenticated caller', async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'no session' },
    });
    const result = await setChildConsent({
      childId: CHILD_ID,
      consentKey: 'audio_recording',
      value: true,
    });
    expect(result.success).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
