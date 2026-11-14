import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { ToastProvider, useToast } from './Toast';

function Trigger() {
  const { toast, dismissAll } = useToast();
  return (
    <div>
      <button
        type="button"
        onClick={() => toast({ message: 'Salvat cu succes', variant: 'success' })}
      >
        push success
      </button>
      <button
        type="button"
        onClick={() =>
          toast({
            message: 'A apărut o eroare',
            description: 'Reîncearcă în câteva secunde.',
            variant: 'error',
          })
        }
      >
        push error
      </button>
      <button
        type="button"
        onClick={() => toast({ message: 'Persistent', variant: 'info', duration: 0 })}
      >
        push persistent
      </button>
      <button type="button" onClick={dismissAll}>
        dismiss all
      </button>
    </div>
  );
}

describe('Toast / useToast', () => {
  it('throws if useToast is used outside the provider', () => {
    function Bad() {
      useToast();
      return null;
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Bad />)).toThrow(/<ToastProvider>/);
    spy.mockRestore();
  });

  it('renders a toast when toast() is called', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('push success'));
    expect(screen.getByText('Salvat cu succes')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
  it('uses soft toast chrome instead of black ink framing', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('push success'));
    const node = screen.getByRole('status');
    expect(node).toHaveClass('bg-surface-container-lowest');
    expect(node).toHaveClass('shadow-popover');
    expect(node).not.toHaveClass('border-ink');
    expect(node).not.toHaveStyle({ boxShadow: 'var(--shadow-chunk)' });
  });

  it('uses role=alert for error variants and shows the description', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('push error'));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Reîncearcă în câteva secunde.')).toBeInTheDocument();
  });

  it('exposes the variant via data-variant', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('push success'));
    const node = screen.getByRole('status');
    expect(node.getAttribute('data-variant')).toBe('success');
  });

  it('auto-dismisses after the configured duration', async () => {
    vi.useFakeTimers();
    render(
      <ToastProvider defaultDuration={3000}>
        <Trigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('push success'));
    expect(screen.getByText('Salvat cu succes')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(3001);
    });
    vi.useRealTimers();
    // AnimatePresence flushes exit animations on real timers.
    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull();
    });
  });

  it('does not auto-dismiss when duration is 0', () => {
    vi.useFakeTimers();
    try {
      render(
        <ToastProvider>
          <Trigger />
        </ToastProvider>,
      );
      fireEvent.click(screen.getByText('push persistent'));
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(screen.getByText('Persistent')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('pauses the dismiss timer on hover and resumes on leave', async () => {
    vi.useFakeTimers();
    render(
      <ToastProvider defaultDuration={2000}>
        <Trigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('push success'));
    const node = screen.getByRole('status');

    fireEvent.mouseEnter(node);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('Salvat cu succes')).toBeInTheDocument();

    fireEvent.mouseLeave(node);
    act(() => {
      vi.advanceTimersByTime(2001);
    });
    vi.useRealTimers();
    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull();
    });
  });

  it('dismisses when the close button is clicked', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('push success'));
    fireEvent.click(screen.getByRole('button', { name: /închide notificarea/i }));
    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull();
    });
  });

  it('clears every toast when dismissAll is called', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('push success'));
    fireEvent.click(screen.getByText('push error'));
    expect(screen.getByText('Salvat cu succes')).toBeInTheDocument();
    expect(screen.getByText('A apărut o eroare')).toBeInTheDocument();

    fireEvent.click(screen.getByText('dismiss all'));
    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });
});
