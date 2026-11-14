import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { recordAdminAction, scrubSecrets } from '../audit';

function fakeClient(insertResult: { error: { message: string } | null }) {
  const insert = vi.fn().mockResolvedValue(insertResult);
  const from = vi.fn().mockReturnValue({ insert });
  return { from, insert, client: { from } as unknown as SupabaseClient };
}

const flagUuid = '11111111-1111-1111-1111-111111111111';

describe('recordAdminAction', () => {
  it('writes UUID resourceId to record_id and leaves resource_id_text null', async () => {
    const { client, from, insert } = fakeClient({ error: null });
    await recordAdminAction(
      {
        actorId: flagUuid,
        action: 'user_suspended',
        resourceType: 'profiles',
        resourceId: flagUuid,
        before: { status: 'active' },
        after: { status: 'suspended' },
        visibility: 'platform',
      },
      client,
    );
    expect(from).toHaveBeenCalledWith('audit_logs');
    expect(insert).toHaveBeenCalledTimes(1);
    const row = insert.mock.calls[0][0];
    expect(row).toMatchObject({
      table_name: 'profiles',
      record_id: flagUuid,
      resource_id_text: null,
      action: 'user_suspended',
      visibility: 'platform',
      changed_by: flagUuid,
      operation: null,
      old_data: { status: 'active' },
      new_data: { status: 'suspended' },
    });
  });

  it('routes non-UUID resourceId to resource_id_text', async () => {
    const { client, insert } = fakeClient({ error: null });
    await recordAdminAction(
      {
        actorId: flagUuid,
        action: 'flag_enabled',
        resourceType: 'feature_flags',
        resourceId: 'game_builder_beta',
      },
      client,
    );
    const row = insert.mock.calls[0][0];
    expect(row.record_id).toBeNull();
    expect(row.resource_id_text).toBe('game_builder_beta');
  });

  it('defaults visibility to platform', async () => {
    const { client, insert } = fakeClient({ error: null });
    await recordAdminAction(
      {
        actorId: null,
        action: 'flag_created',
        resourceType: 'feature_flags',
        resourceId: 'game_builder_beta',
      },
      client,
    );
    expect(insert.mock.calls[0][0].visibility).toBe('platform');
  });

  it('throws when the underlying insert errors', async () => {
    const { client } = fakeClient({ error: { message: 'rls violation' } });
    await expect(
      recordAdminAction(
        {
          actorId: flagUuid,
          action: 'flag_enabled',
          resourceType: 'feature_flags',
          resourceId: 'game_builder_beta',
        },
        client,
      ),
    ).rejects.toThrow(/rls violation/);
  });
});

describe('scrubSecrets', () => {
  it('redacts well-known secret keys', () => {
    const out = scrubSecrets({
      email: 'a@b.ro',
      password: 'hunter2',
      tokens: { access_token: 'abc', expires_in: 3600 },
      list: [{ pin: '1234' }, { username: 'john' }],
    });
    expect(out).toEqual({
      email: 'a@b.ro',
      password: '[REDACTED]',
      tokens: { access_token: '[REDACTED]', expires_in: 3600 },
      list: [{ pin: '[REDACTED]' }, { username: 'john' }],
    });
  });

  it('returns primitives unchanged', () => {
    expect(scrubSecrets(42)).toBe(42);
    expect(scrubSecrets(null)).toBeNull();
    expect(scrubSecrets('hello')).toBe('hello');
  });
});
