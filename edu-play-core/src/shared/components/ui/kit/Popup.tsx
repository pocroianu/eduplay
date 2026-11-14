'use client';

import { useEffect, useId, type ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from './Button';
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';
import { cn } from '@/shared/lib/utils/cn';
import { useFocusTrap } from './useFocusTrap';

/* -------------------------------------------------------------------------- */
/*  Popup — general-purpose modal / side-panel dialog                         */
/*  Matches the Seesaw design system modal and settings panel patterns.       */
/* -------------------------------------------------------------------------- */

export type PopupVariant = 'modal' | 'panel';
export type PopupSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface PopupProps {
  /** Whether the popup is visible. */
  open: boolean;
  /** Fired when the user dismisses (X button, Escape, or backdrop click). */
  onClose: () => void;
  /** Popup style: centered `modal` (default) or right-side `panel`. */
  variant?: PopupVariant;
  /** Size controls max-width (modal) or width (panel). */
  size?: PopupSize;
  /** Dialog title displayed in the header. */
  title?: ReactNode;
  /** Optional icon next to the title. */
  icon?: IconName;
  /** Body content. */
  children?: ReactNode;
  /** Footer content (actions, buttons). Rendered below the scrollable body. */
  footer?: ReactNode;
  /** Extra className on the popup container. */
  className?: string;
  /** Whether to show the close button. Defaults to true. */
  showClose?: boolean;
  /** Label for the close button (accessibility). */
  closeLabel?: string;
  /** For panels: show a back arrow instead of X for the close button. */
  showBack?: boolean;
}

const SIZE_CLASSES: Record<PopupVariant, Record<PopupSize, string>> = {
  modal: {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-[90vw]',
  },
  panel: {
    sm: 'w-80',
    md: 'w-96',
    lg: 'w-[28rem]',
    xl: 'w-[32rem]',
    full: 'w-full max-w-lg',
  },
};

export function Popup({
  open,
  onClose,
  variant = 'modal',
  size = 'md',
  title,
  icon,
  children,
  footer,
  className,
  showClose = true,
  closeLabel = 'Închide',
  showBack = false,
}: PopupProps) {
  const titleId = useId();
  const closeId = useId();
  const reduceMotion = useReducedMotion();
  const trapRef = useFocusTrap(open, closeId);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const isPanel = variant === 'panel';

  const panelMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, x: '100%' }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: '100%' } };

  const modalMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 16, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 16, scale: 0.98 } };

  const contentMotion = isPanel ? panelMotion : modalMotion;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={cn(
            'fixed inset-0 z-[60] flex',
            isPanel ? 'justify-end' : 'items-center justify-center px-4',
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.05 : 0.15 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          ref={trapRef}
        >
          {/* Backdrop */}
          <button
            type="button"
            tabIndex={-1}
            aria-label={closeLabel}
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-ink/25"
          />

          {/* Content container */}
          <motion.div
            className={cn(
              'relative flex flex-col overflow-hidden bg-surface-container-lowest shadow-modal',
              isPanel
                ? cn('h-full border-l border-outline-variant', SIZE_CLASSES.panel[size])
                : cn('max-h-[90vh] w-full rounded-xl', SIZE_CLASSES.modal[size]),
              className,
            )}
            {...contentMotion}
            transition={{ duration: reduceMotion ? 0.05 : 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Header */}
            {(title || showClose) && (
              <div
                className={cn(
                  'flex shrink-0 items-center gap-3 border-b border-outline-variant',
                  isPanel ? 'px-5 py-4' : 'px-5 py-4',
                )}
              >
                {showClose && (
                  <button
                    id={closeId}
                    type="button"
                    aria-label={closeLabel}
                    onClick={onClose}
                    className={cn(
                      'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                    )}
                  >
                    <Icon
                      name={showBack ? 'ArrowLeft' : 'X'}
                      size={20}
                      aria-hidden
                    />
                  </button>
                )}
                {icon && (
                  <span
                    aria-hidden
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-deep"
                  >
                    <Icon name={icon} size={20} weight="fill" />
                  </span>
                )}
                {title && (
                  <h2
                    id={titleId}
                    className="min-w-0 flex-1 truncate text-xl font-bold text-on-surface"
                  >
                    {title}
                  </h2>
                )}
                {/* For modal without showBack, put X on right side */}
                {!isPanel && !showBack && showClose && (
                  <span className="sr-only" />
                )}
              </div>
            )}

            {/* Scrollable body */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="shrink-0 border-t border-outline-variant px-5 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------------------- */
/*  PopupSection — groups content within a Popup with a section header        */
/*  Matches Seesaw's PROFILE, SCHOOLS, CLASS NOTIFICATIONS sections.          */
/* -------------------------------------------------------------------------- */

export interface PopupSectionProps {
  /** Section heading label (rendered uppercase like Seesaw). */
  title: string;
  /** Section content. */
  children: ReactNode;
  className?: string;
}

export function PopupSection({ title, children, className }: PopupSectionProps) {
  return (
    <section className={cn('py-3', className)}>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  PopupRow — a clickable row inside a PopupSection                          */
/*  Matches Seesaw's settings row items (e.g. "First Name: Geani")            */
/* -------------------------------------------------------------------------- */

export interface PopupRowProps {
  /** Row label (left side). */
  label: string;
  /** Row value or content (right side). */
  value?: ReactNode;
  /** Optional icon on the left. */
  icon?: IconName;
  /** Click handler — makes the row interactive. */
  onClick?: () => void;
  /** Navigate to href — makes the row a link. */
  href?: string;
  className?: string;
}

export function PopupRow({ label, value, icon, onClick, className }: PopupRowProps) {
  const content = (
    <>
      {icon && <Icon name={icon} size="sm" className="shrink-0 text-on-surface-variant" aria-hidden />}
      <span className="min-w-0 flex-1 text-sm font-medium text-on-surface">{label}</span>
      {value && (
        <span className="shrink-0 text-sm text-on-surface-variant">{value}</span>
      )}
      {onClick && (
        <Icon name="CaretRight" size="sm" className="shrink-0 text-on-surface-variant" aria-hidden />
      )}
    </>
  );

  const baseClass = cn(
    'flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
    onClick && 'cursor-pointer hover:bg-surface-container',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    className,
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={baseClass}>
        {content}
      </button>
    );
  }

  return <div className={baseClass}>{content}</div>;
}

/* -------------------------------------------------------------------------- */
/*  PopupFooterActions — standard footer button layout                        */
/* -------------------------------------------------------------------------- */

export interface PopupFooterActionsProps {
  /** Primary action label. */
  primaryLabel?: ReactNode;
  /** Primary action handler. */
  onPrimary?: () => void;
  /** Secondary action label (cancel/close). */
  secondaryLabel?: ReactNode;
  /** Secondary action handler. Defaults to popup close. */
  onSecondary?: () => void;
  /** Whether the primary button is disabled. */
  primaryDisabled?: boolean;
  children?: ReactNode;
}

export function PopupFooterActions({
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  primaryDisabled,
  children,
}: PopupFooterActionsProps) {
  return (
    <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:justify-end">
      {children}
      {secondaryLabel && (
        <Button variant="ghost" size="lg" className="sm:w-auto" onClick={onSecondary}>
          {secondaryLabel}
        </Button>
      )}
      {primaryLabel && (
        <Button
          variant="primary"
          size="lg"
          className="sm:w-auto"
          onClick={onPrimary}
          disabled={primaryDisabled}
        >
          {primaryLabel}
        </Button>
      )}
    </div>
  );
}
