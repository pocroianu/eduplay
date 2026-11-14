import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TeacherActivityPicker } from '../TeacherActivityPicker';

const classes = [
  { id: '22222222-2222-4222-8222-222222222222', name: 'Clasa I' },
  { id: '33333333-3333-4333-8333-333333333333', name: 'Clasa a II-a' },
];

function renderPicker() {
  return render(
    <MantineProvider>
      <TeacherActivityPicker classes={classes} />
    </MantineProvider>,
  );
}

describe('TeacherActivityPicker', () => {
  it('renders the two phase-1 creative activity choices', () => {
    renderPicker();

    expect(screen.getByText(/trimitere rapidă/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /activități creative rapide/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /creează activitate completă/i })).toHaveAttribute(
      'href',
      '/teacher/activities/create',
    );
    expect(screen.getByRole('button', { name: /desen/i })).toHaveClass('mantine-UnstyledButton-root');
    expect(screen.getByRole('button', { name: /înregistrare vocală/i })).toHaveClass('mantine-UnstyledButton-root');
    expect(screen.getByRole('button', { name: /clasă/i })).toHaveClass('mantine-InputBase-input');
  });

  it('selects the target class through the Mantine Combobox control', async () => {
    const user = userEvent.setup();

    renderPicker();

    const classPicker = screen.getByRole('button', { name: /clasă/i });
    expect(classPicker).toHaveTextContent('Clasa I');

    await user.click(classPicker);
    await user.click(
      await screen.findByRole('option', { name: /clasa a ii-a/i, hidden: true }),
    );

    expect(classPicker).toHaveTextContent('Clasa a II-a');
  });

  it('uses Mantine controls and CSS-module focus styling', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'src/features/teacher-dashboard/components/TeacherActivityPicker.tsx',
      ),
      'utf8',
    );
    const css = readFileSync(
      join(
        process.cwd(),
        'src/features/teacher-dashboard/components/TeacherDashboardContent.module.css',
      ),
      'utf8',
    );

    expect(source).not.toContain('<button');
    expect(source).not.toContain('<option');
    expect(css).toContain('.choiceButton:focus-visible');
    expect(css).toContain('outline: 2px solid var(--color-primary);');
  });
});
