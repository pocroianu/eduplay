import { MantineProvider } from '@mantine/core';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChildConsentSection } from './ChildConsentSection';
import { setChildConsent } from '../actions';

vi.mock('../actions', () => ({
  setChildConsent: vi.fn(),
}));

const setChildConsentMock = vi.mocked(setChildConsent);

function renderWithMantine() {
  return render(
    <MantineProvider>
      <ChildConsentSection
        childId="11111111-1111-4111-8111-111111111111"
        initialConsents={{ audio_recording: false }}
      />
    </MantineProvider>,
  );
}

describe('ChildConsentSection', () => {
  beforeEach(() => {
    setChildConsentMock.mockReset();
    setChildConsentMock.mockResolvedValue({ success: true });
  });

  it('renders the audio permission as a Mantine switch with an accessible label', () => {
    renderWithMantine();

    const switchControl = screen.getByRole('switch', {
      name: /permite înregistrări audio/i,
    });

    expect(switchControl).toHaveAttribute('type', 'checkbox');
    expect(switchControl).not.toBeChecked();
  });

  it('persists the next consent value when toggled', async () => {
    const user = userEvent.setup();
    renderWithMantine();

    await user.click(
      screen.getByRole('switch', {
        name: /permite înregistrări audio/i,
      }),
    );

    await waitFor(() => {
      expect(setChildConsentMock).toHaveBeenCalledWith({
        childId: '11111111-1111-4111-8111-111111111111',
        consentKey: 'audio_recording',
        value: true,
      });
    });
  });
});
