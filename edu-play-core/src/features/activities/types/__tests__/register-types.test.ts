import { describe, expect, it, vi } from 'vitest';

describe('activity type client registrations', () => {
  it('registers every shipped activity type from the legacy client side-effect path', async () => {
    vi.resetModules();

    const { getActivityType } = await import('../../registry');

    await import('../register-types');

    expect(getActivityType('drawing-canvas')).toBeDefined();
    expect(getActivityType('voice-recording')).toBeDefined();
  }, 60_000);
});
