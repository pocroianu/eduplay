import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useFlag } from '../use-flag';

function FlagProbe({ name }: { name: 'listen_tap_audio' }) {
  const enabled = useFlag(name);
  return <span data-testid="flag-state">{enabled ? 'on' : 'off'}</span>;
}

describe('feature-flags / useFlag', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders "off" when the env var is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_LISTEN_TAP_AUDIO', '');
    render(<FlagProbe name="listen_tap_audio" />);
    expect(screen.getByTestId('flag-state')).toHaveTextContent('off');
  });

  it('renders "on" when the env var is "1"', () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_LISTEN_TAP_AUDIO', '1');
    render(<FlagProbe name="listen_tap_audio" />);
    expect(screen.getByTestId('flag-state')).toHaveTextContent('on');
  });
});
