import { describe, expect, it } from 'vitest';

import { studentPinToAuthPassword } from './student-auth-password';

describe('studentPinToAuthPassword', () => {
  it('keeps the child-facing PIN as a Supabase-compatible internal password', () => {
    expect(studentPinToAuthPassword('1234')).toBe('student-pin:1234');
    expect(studentPinToAuthPassword('1234').length).toBeGreaterThanOrEqual(6);
  });
});
