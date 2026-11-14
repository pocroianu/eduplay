import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LinkChildForm } from './link-child-form';
import { linkParentToChild } from '../actions/link-child';

vi.mock('../actions/link-child', () => ({
  linkParentToChild: vi.fn(),
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function renderForm(onSuccess = vi.fn()) {
  return render(
    <MantineProvider>
      <LinkChildForm onSuccess={onSuccess} />
    </MantineProvider>,
  );
}

beforeEach(() => {
  vi.mocked(linkParentToChild).mockReset();
  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: ResizeObserverMock,
  });
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: ResizeObserverMock,
  });
});

describe('LinkChildForm', () => {
  it('submits the selected relationship from the Mantine Combobox control', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    vi.mocked(linkParentToChild).mockResolvedValue({
      success: true,
      data: {
        linkId: 'link-1',
        studentName: 'ana.pop',
        studentAvatarUrl: null,
      },
    });

    renderForm(onSuccess);

    await user.type(screen.getByLabelText(/cod invitație/i), 'abcd1234');
    await user.click(screen.getByRole('button', { name: /relație/i }));
    await user.click(
      await screen.findByRole('option', { name: /tutore legal/i, hidden: true }),
    );
    await user.click(
      screen.getByRole('button', { name: /conectează-te la profilul copilului/i }),
    );

    await waitFor(() => {
      expect(linkParentToChild).toHaveBeenCalledWith({
        inviteCode: 'ABCD1234',
        relationshipType: 'guardian',
      });
    });
    expect(onSuccess).toHaveBeenCalledWith('ana.pop');
  });

  it('does not declare native option elements for the relationship field', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/parent-portal/components/link-child-form.tsx'),
      'utf8',
    );

    expect(source).not.toContain('<option');
  });
});
