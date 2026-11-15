import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  createElement,
  type ComponentProps,
  type ComponentType,
  type HTMLAttributes,
} from 'react';

const reducedMotionState = { value: false };

vi.mock('framer-motion', () => {
  const stripMotionProps = (props: Record<string, unknown>) => {
    const {
      initial: _initial,
      animate: _animate,
      whileTap: _whileTap,
      whileHover: _whileHover,
      whileFocus: _whileFocus,
      whileInView: _whileInView,
      exit: _exit,
      transition: _transition,
      variants: _variants,
      layout: _layout,
      layoutId: _layoutId,
      ...rest
    } = props;
    return rest;
  };

  // motion is callable as a HOC `motion(Component)` and indexable as
  // `motion.div` / `motion.button` etc. Both forms must be a passthrough that
  // strips motion-only props so the underlying DOM does not receive them.
  const motion = Object.assign(
    <P extends object>(Component: ComponentType<P>) =>
      function MotionWrapped(props: P) {
        return createElement(
          Component as ComponentType<Record<string, unknown>>,
          stripMotionProps(props as Record<string, unknown>),
        );
      },
    {
      div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
        <div {...stripMotionProps(props)}>{children}</div>
      ),
      button: ({ children, ...props }: ComponentProps<'button'>) => (
        <button {...stripMotionProps(props)}>{children}</button>
      ),
      a: ({ children, ...props }: ComponentProps<'a'>) => (
        <a {...stripMotionProps(props)}>{children}</a>
      ),
      create: <P extends object>(Component: ComponentType<P>) =>
        function MotionCreated(props: P) {
          return createElement(
            Component as ComponentType<Record<string, unknown>>,
            stripMotionProps(props as Record<string, unknown>),
          );
        },
    },
  );

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion,
    useReducedMotion: () => reducedMotionState.value,
  };
});

import { RewardModal, type RewardModalProps } from './RewardModal';

function renderModal(overrides: Partial<RewardModalProps> = {}) {
  const onDismiss = vi.fn();
  const utils = render(
    <RewardModal
      open
      onDismiss={onDismiss}
      eyebrow="Nivel nou!"
      title={
        <>
          Matematician <span>Nivel 4</span>
        </>
      }
      subtitle="Ai terminat Scăderi simple cu 100%."
      rewards={[
        { id: 'xp', tone: 'gold', glyph: 'xp', value: '+150', label: 'XP' },
        { id: 'gem', tone: 'blue', glyph: 'gem', value: '+12', label: 'Gems' },
      ]}
      notice="Am trimis felicitări mamei și doamnei Ana."
      {...overrides}
    />,
  );
  return { ...utils, onDismiss };
}

describe('RewardModal', () => {
  beforeEach(() => {
    reducedMotionState.value = false;
  });

  it('does not render anything when open=false', () => {
    render(
      <RewardModal open={false} onDismiss={vi.fn()} title="Hidden" />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog with aria-modal and labelled by title', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const heading = screen.getByRole('heading', { level: 2 });
    expect(dialog).toHaveAttribute('aria-labelledby', heading.id);
  });

  it('falls back to title for aria-labelledby when no eyebrow is provided', () => {
    renderModal({ eyebrow: undefined });
    const dialog = screen.getByRole('dialog');
    const heading = screen.getByRole('heading', { level: 2 });
    expect(dialog).toHaveAttribute('aria-labelledby', heading.id);
  });

  it('uses ariaLabel override and drops aria-labelledby when provided', () => {
    renderModal({ ariaLabel: 'Recompensă' });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-label', 'Recompensă');
    expect(dialog).not.toHaveAttribute('aria-labelledby');
  });

  it('renders all reward chips with their value and label', () => {
    renderModal();
    expect(screen.getByText('+150')).toBeInTheDocument();
    expect(screen.getByText('XP')).toBeInTheDocument();
    expect(screen.getByText('+12')).toBeInTheDocument();
    expect(screen.getByText('Gems')).toBeInTheDocument();
  });

  it('renders the notice text', () => {
    renderModal();
    expect(
      screen.getByText('Am trimis felicitări mamei și doamnei Ana.'),
    ).toBeInTheDocument();
  });

  it('renders default CTA "Mai departe!" and fires onDismiss when clicked', () => {
    const { onDismiss } = renderModal();
    const cta = screen.getByRole('button', { name: /mai departe/i });
    expect(cta).toBeInTheDocument();
    fireEvent.click(cta);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('uses custom ctaLabel when provided', () => {
    renderModal({ ctaLabel: 'Continuă' });
    expect(screen.getByRole('button', { name: /continuă/i })).toBeInTheDocument();
  });

  it('renders a custom actions slot in place of the default CTA', () => {
    const onDismiss = vi.fn();
    render(
      <RewardModal
        open
        onDismiss={onDismiss}
        title="Done"
        actions={(dismiss) => (
          <button type="button" onClick={dismiss}>
            Acasă
          </button>
        )}
      />,
    );
    expect(
      screen.queryByRole('button', { name: /mai departe/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /acasă/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not render an interactive backdrop (DESIGN.md §4.4 — no accidental dismiss)', () => {
    renderModal();
    expect(
      screen.queryByRole('button', { name: /închide/i }),
    ).not.toBeInTheDocument();
  });

  it('dismisses on Escape keydown', () => {
    const { onDismiss } = renderModal();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('focuses the default CTA on open', async () => {
    renderModal();
    const cta = screen.getByRole('button', { name: /mai departe/i });
    await waitFor(() => expect(document.activeElement).toBe(cta));
  });

  it('still renders all content when reduced motion is preferred', () => {
    reducedMotionState.value = true;
    renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Nivel nou!')).toBeInTheDocument();
    expect(
      screen.getByText('Ai terminat Scăderi simple cu 100%.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mai departe/i })).toBeInTheDocument();
  });

  it('omits notice element when notice prop is not provided', () => {
    renderModal({ notice: undefined });
    expect(
      screen.queryByText('Am trimis felicitări mamei și doamnei Ana.'),
    ).not.toBeInTheDocument();
  });

  it('omits rewards strip when rewards prop is empty', () => {
    renderModal({ rewards: [] });
    expect(screen.queryByText('+150')).not.toBeInTheDocument();
  });
});

// Type-only smoke test: prop types compile.
const _typecheck: ComponentProps<typeof RewardModal> = {
  open: true,
  onDismiss: () => {},
  title: 'x',
};
void _typecheck;
