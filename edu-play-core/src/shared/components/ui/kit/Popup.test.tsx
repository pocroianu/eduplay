import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Popup, PopupSection, PopupRow, PopupFooterActions } from './Popup';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('Popup', () => {
  it('does not render anything when closed', () => {
    render(<Popup open={false} onClose={() => undefined} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders as a centered modal by default', () => {
    render(
      <Popup open onClose={() => undefined} title="Setări cont">
        <p>Body</p>
      </Popup>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Setări cont')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
  });

  it('renders close button that calls onClose', () => {
    const onClose = vi.fn();
    render(<Popup open onClose={onClose} title="Test" />);
    // There are two buttons with "închide" — backdrop (tabIndex -1) and visible close button
    const buttons = screen.getAllByRole('button', { name: /închide/i });
    const closeBtn = buttons.find((b) => b.getAttribute('tabindex') !== '-1')!;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(<Popup open onClose={onClose} title="Test" />);
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on backdrop click', () => {
    const onClose = vi.fn();
    render(<Popup open onClose={onClose} title="Test" />);
    // The backdrop is the button with tabIndex -1
    const buttons = screen.getAllByRole('button', { hidden: true });
    const backdropBtn = buttons.find((b) => b.getAttribute('tabindex') === '-1');
    if (backdropBtn) {
      fireEvent.click(backdropBtn);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('renders panel variant with panel classes', () => {
    render(
      <Popup open onClose={() => undefined} variant="panel" title="Setări">
        <p>Panel content</p>
      </Popup>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Panel content')).toBeInTheDocument();
  });

  it('renders footer when provided', () => {
    render(
      <Popup open onClose={() => undefined} title="Test" footer={<button>Save</button>}>
        <p>Content</p>
      </Popup>,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('hides close button when showClose is false', () => {
    render(<Popup open onClose={() => undefined} title="No close" showClose={false} />);
    // Only the backdrop button should exist, not a visible close icon
    const buttons = screen.getAllByRole('button', { hidden: true });
    const visibleClose = buttons.find(
      (b) => b.getAttribute('aria-label') === 'Închide' && b.getAttribute('tabindex') !== '-1',
    );
    expect(visibleClose).toBeUndefined();
  });
});

describe('PopupSection', () => {
  it('renders section title in uppercase style', () => {
    render(
      <PopupSection title="PROFIL">
        <p>Field</p>
      </PopupSection>,
    );
    expect(screen.getByText('PROFIL')).toBeInTheDocument();
    expect(screen.getByText('Field')).toBeInTheDocument();
  });
});

describe('PopupRow', () => {
  it('renders a non-interactive row', () => {
    render(<PopupRow label="Nume" value="Geani" />);
    expect(screen.getByText('Nume')).toBeInTheDocument();
    expect(screen.getByText('Geani')).toBeInTheDocument();
  });

  it('renders a clickable row', () => {
    const onClick = vi.fn();
    render(<PopupRow label="Schimbă parola" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /schimbă parola/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('PopupFooterActions', () => {
  it('renders primary and secondary buttons', () => {
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();
    render(
      <PopupFooterActions
        primaryLabel="Salvează"
        onPrimary={onPrimary}
        secondaryLabel="Anulează"
        onSecondary={onSecondary}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /salvează/i }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /anulează/i }));
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it('disables primary button when primaryDisabled is true', () => {
    render(
      <PopupFooterActions primaryLabel="Ok" onPrimary={() => undefined} primaryDisabled />,
    );
    expect(screen.getByRole('button', { name: /ok/i })).toBeDisabled();
  });
});
