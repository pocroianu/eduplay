import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InviteCodeGenerator } from './invite-code-generator';
import { generateParentInviteCode } from '../actions/generate-invite-code';

vi.mock('../actions/generate-invite-code', () => ({
  generateParentInviteCode: vi.fn(),
}));

function renderGenerator() {
  return render(
    <MantineProvider>
      <InviteCodeGenerator studentId="student-1" studentName="Ana" />
    </MantineProvider>,
  );
}

beforeEach(() => {
  vi.mocked(generateParentInviteCode).mockReset();
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    writable: true,
    value: {
      writeText: async () => undefined,
    },
  });
});

describe('InviteCodeGenerator', () => {
  it('generates and copies invite codes with Mantine controls', async () => {
    const user = userEvent.setup();
    vi.mocked(generateParentInviteCode).mockResolvedValue({
      success: true,
      data: {
        code: 'ABCD2345',
        expiresAt: '2026-06-15T12:00:00.000Z',
        studentName: 'Ana',
      },
    });

    renderGenerator();

    const generateButton = screen.getByRole('button', {
      name: /generează cod de invitare pentru ana/i,
    });
    expect(generateButton).toHaveClass('mantine-Button-root');

    await user.click(generateButton);

    expect(await screen.findByText('ABCD2345')).toBeInTheDocument();
    expect(generateParentInviteCode).toHaveBeenCalledWith({
      studentId: 'student-1',
    });

    const copyButton = screen.getByRole('button', { name: /copiază codul/i });
    expect(copyButton).toHaveClass('mantine-ActionIcon-root');

    await user.click(copyButton);

    await waitFor(() => {
      expect(copyButton).toHaveAccessibleName('Cod copiat');
    });
  });

  it('keeps invite actions on Mantine primitives instead of native buttons', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'src/features/parent-portal/components/invite-code-generator.tsx',
      ),
      'utf8',
    );

    expect(source).not.toMatch(/<button\b/);
    expect(source).toContain('<ActionIcon');
    expect(source).toContain('<Button');
  });
});
