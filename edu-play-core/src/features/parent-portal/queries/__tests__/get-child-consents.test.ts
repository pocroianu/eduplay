import { describe, expect, it } from 'vitest';
import { getChildConsents } from '../get-child-consents';

interface FakeRow {
  consents: unknown;
}

function fakeSupabase(row: FakeRow | null, error: unknown = null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row, error }),
        }),
      }),
    }),
  } as unknown as Parameters<typeof getChildConsents>[0];
}

const CHILD_ID = '00000000-0000-0000-0000-000000000001';

describe('getChildConsents', () => {
  it('returns an empty map when the row is missing', async () => {
    const result = await getChildConsents(fakeSupabase(null), CHILD_ID);
    expect(result).toEqual({});
  });

  it('returns an empty map on database error', async () => {
    const result = await getChildConsents(
      fakeSupabase(null, { message: 'rls' }),
      CHILD_ID,
    );
    expect(result).toEqual({});
  });

  it('keeps known consent keys with boolean values', async () => {
    const result = await getChildConsents(
      fakeSupabase({ consents: { audio_recording: true } }),
      CHILD_ID,
    );
    expect(result).toEqual({ audio_recording: true });
  });

  it('drops unknown keys and non-boolean values', async () => {
    const result = await getChildConsents(
      fakeSupabase({
        consents: {
          audio_recording: false,
          unknown_key: true,
          photo_capture: 'yes',
        },
      }),
      CHILD_ID,
    );
    expect(result).toEqual({ audio_recording: false });
  });

  it('rejects non-object payloads (defensive)', async () => {
    expect(
      await getChildConsents(fakeSupabase({ consents: null }), CHILD_ID),
    ).toEqual({});
    expect(
      await getChildConsents(fakeSupabase({ consents: [1, 2, 3] }), CHILD_ID),
    ).toEqual({});
    expect(
      await getChildConsents(fakeSupabase({ consents: 'on' }), CHILD_ID),
    ).toEqual({});
  });
});
