import { describe, expect, it } from 'vitest';
import { pickRecorderMime } from '../recorder';
import { voiceRecordingConfigSchema } from '..';

describe('pickRecorderMime', () => {
  it('prefers webm/opus when supported', () => {
    const probe = pickRecorderMime((type) => type === 'audio/webm;codecs=opus');
    expect(probe).toEqual({
      mime: 'audio/webm',
      recorderType: 'audio/webm;codecs=opus',
    });
  });

  it('falls back to ogg/opus when only ogg is supported', () => {
    const probe = pickRecorderMime((type) => type === 'audio/ogg;codecs=opus');
    expect(probe).toEqual({
      mime: 'audio/ogg',
      recorderType: 'audio/ogg;codecs=opus',
    });
  });

  it('returns null when neither codec is supported', () => {
    expect(pickRecorderMime(() => false)).toBeNull();
  });

  it('picks the highest-priority match when both are supported', () => {
    const probe = pickRecorderMime(() => true);
    expect(probe?.mime).toBe('audio/webm');
  });
});

describe('voiceRecordingConfigSchema', () => {
  it('accepts an empty object (prompt is optional)', () => {
    expect(voiceRecordingConfigSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a Romanian prompt within the length cap', () => {
    const result = voiceRecordingConfigSchema.safeParse({
      promptText: 'Citește o poveste despre vulpiță și prietenul ei.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a blank prompt string', () => {
    const result = voiceRecordingConfigSchema.safeParse({ promptText: '   ' });
    expect(result.success).toBe(false);
  });

  it('rejects prompts longer than 280 characters', () => {
    const result = voiceRecordingConfigSchema.safeParse({
      promptText: 'a'.repeat(281),
    });
    expect(result.success).toBe(false);
  });
});
