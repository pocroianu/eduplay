import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('ConfirmDialog', () => {
  it('does not render anything when closed', () => {
    render(<ConfirmDialog open={false} onConfirm={() => undefined} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('renders default labels and uses soft dialog chrome', () => {
    render(<ConfirmDialog open onConfirm={() => undefined} onCancel={() => undefined} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Ești sigur?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmă/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /anulează/i })).toBeInTheDocument();

    const panel = screen.getByText('Ești sigur?').closest('.mantine-Modal-content') as HTMLElement;
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveClass('mantine-Modal-content');
    expect(panel).not.toHaveClass('border-ink');
  });

  it('renders custom title, body, and labels', () => {
    render(
      <ConfirmDialog
        open
        title="Ștergi elevul?"
        body="Această acțiune nu poate fi anulată."
        confirmLabel="Șterge"
        cancelLabel="Renunță"
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    expect(screen.getByText('Ștergi elevul?')).toBeInTheDocument();
    expect(screen.getByText('Această acțiune nu poate fi anulată.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^șterge$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^renunță$/i })).toBeInTheDocument();
  });

  it('uses role=alertdialog when destructive', () => {
    render(
      <ConfirmDialog open destructive title="Șterge" onConfirm={() => undefined} onCancel={() => undefined} />,
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: /confirmă/i });
    expect(confirmBtn).toHaveClass('bg-error');
  });

  it('fires onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog open onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /confirmă/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('fires onCancel when the cancel button is clicked', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog open onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /anulează/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('fires onCancel when Escape is pressed', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog open onConfirm={() => undefined} onCancel={onCancel} />);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('fires onCancel when the backdrop is clicked', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog open onConfirm={() => undefined} onCancel={onCancel} />);
    const backdrop = document.querySelector('.mantine-Modal-overlay') as HTMLElement;
    expect(backdrop).toBeInTheDocument();
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('fires onCancel when the close button is clicked', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog open onConfirm={() => undefined} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /închide/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('focuses the cancel button on open', async () => {
    render(<ConfirmDialog open onConfirm={() => undefined} onCancel={() => undefined} />);
    const cancelBtn = screen.getByRole('button', { name: /anulează/i });
    await waitFor(() => {
      expect(document.activeElement).toBe(cancelBtn);
    });
  });

  it('renders the optional icon badge when provided', () => {
    render(
      <ConfirmDialog open icon="Warning" onConfirm={() => undefined} onCancel={() => undefined} />,
    );
    const badge = document.querySelector('.mantine-ThemeIcon-root');
    expect(badge).toBeTruthy();
    expect(badge?.querySelector('svg')).toBeTruthy();
    expect(badge?.className).not.toContain('border-ink');
  });

  it('supports larger action sizing and confirm icon adapters', () => {
    render(
      <ConfirmDialog
        open
        actionSize="xl"
        confirmIcon="SignOut"
        confirmClassName="min-h-16"
        cancelClassName="min-h-16"
        confirmLabel="Ies din joc"
        cancelLabel="Rămân în joc"
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );

    expect(screen.getByRole('button', { name: /rămân în joc/i })).toHaveClass('min-h-16');
    const confirmButton = screen.getByRole('button', { name: /ies din joc/i });
    expect(confirmButton).toHaveClass('min-h-16');
    expect(confirmButton.querySelector('svg')).toBeTruthy();
  });
});
