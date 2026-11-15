"use client";

import { type ReactNode } from "react";
import { Drawer, Modal, UnstyledButton } from "@mantine/core";
import { MantineBoundary } from "./MantineBoundary";

import { Button } from "./Button";

import { Icon } from "@/shared/components/ui/Icon";

import type { IconName } from "@/shared/components/ui/Icon.registry";

import { cn } from "@/shared/lib/utils/cn";

import Link from "next/link";

/* -------------------------------------------------------------------------- */

/*  Popup — general-purpose modal / side-panel dialog                         */

/*  Matches the EduPlay design system modal and settings panel patterns.       */
/* -------------------------------------------------------------------------- */

export type PopupVariant = "modal" | "panel";

export type PopupSize = "sm" | "md" | "lg" | "xl" | "full";

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

export function Popup({
  open,
  onClose,
  variant = "modal",
  size = "md",
  title,
  icon,
  children,
  footer,
  className,
  showClose = true,
  closeLabel = "Închide",
  showBack = false,
}: PopupProps) {
  const header = (
    <span className="flex w-full items-center gap-3">
      {icon && (
        <span
          aria-hidden
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-deep"
        >
          <Icon name={icon} size={20} weight="fill" />
        </span>
      )}
      {title && (
        <span className="min-w-0 flex-1 truncate text-xl font-bold text-on-surface">
          {title}
        </span>
      )}
    </span>
  );
  const body = (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
      {footer && (
        <div className="shrink-0 border-t border-outline-variant px-5 py-4">
          {footer}
        </div>
      )}
    </>
  );
  const widths = {
    sm: "20rem",
    md: "24rem",
    lg: "28rem",
    xl: "32rem",
    full: variant === "panel" ? "100%" : "90vw",
  };
  const common = {
    opened: open,
    onClose,
    title: title ? header : <span className="sr-only">{closeLabel}</span>,
    size: widths[size],
    withCloseButton: showClose,
    closeButtonProps: {
      "aria-label": closeLabel,
      "data-autofocus": true,
      icon: <Icon name={showBack ? "ArrowLeft" : "X"} size={20} aria-hidden />,
    },
    className,
    zIndex: 60,
    "aria-label": title ? undefined : closeLabel,
    styles: {
      body: { padding: 0 },
      header: { borderBottom: "1px solid var(--color-outline-variant)" },
    },
  };
  return (
    <MantineBoundary>
      {variant === "panel" ? (
        <Drawer {...common} position="right">
          {body}
        </Drawer>
      ) : (
        <Modal {...common} centered>
          {body}
        </Modal>
      )}
    </MantineBoundary>
  );
}
/* -------------------------------------------------------------------------- */

/*  PopupSection — groups content within a Popup with a section header        */

/*  Matches EduPlay's PROFILE, SCHOOLS, CLASS NOTIFICATIONS sections.          */
/* -------------------------------------------------------------------------- */

export interface PopupSectionProps {
  /** Section heading label (rendered uppercase like EduPlay). */
  title: string;

  /** Section content. */

  children: ReactNode;

  className?: string;
}

export function PopupSection({
  title,
  children,
  className,
}: PopupSectionProps) {
  return (
    <section className={cn("py-3", className)}>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
        {title}
      </h3>

      <div className="space-y-1">{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

/*  PopupRow — a clickable row inside a PopupSection                          */

/*  Matches EduPlay's settings row items (e.g. "First Name: Geani")            */
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

export function PopupRow(props: PopupRowProps) {
  return (
    <MantineBoundary>
      <PopupRowContent {...props} />
    </MantineBoundary>
  );
}

function PopupRowContent({
  label,
  value,
  icon,
  onClick,
  href,
  className,
}: PopupRowProps) {
  const content = (
    <>
      {icon && (
        <Icon
          name={icon}
          size="sm"
          className="shrink-0 text-on-surface-variant"
          aria-hidden
        />
      )}

      <span className="min-w-0 flex-1 text-sm font-medium text-on-surface">
        {label}
      </span>

      {value && (
        <span className="shrink-0 text-sm text-on-surface-variant">
          {value}
        </span>
      )}

      {(onClick || href) && (
        <Icon
          name="CaretRight"
          size="sm"
          className="shrink-0 text-on-surface-variant"
          aria-hidden
        />
      )}
    </>
  );

  const baseClass = cn(
    "flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors",

    (onClick || href) && "cursor-pointer hover:bg-surface-container",

    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",

    className,
  );

  if (href) {
    return (
      <UnstyledButton
        component={Link}
        href={href}
        onClick={onClick}
        className={baseClass}
      >
        {content}
      </UnstyledButton>
    );
  }

  if (onClick) {
    return (
      <UnstyledButton type="button" onClick={onClick} className={baseClass}>
        {content}
      </UnstyledButton>
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
        <Button
          variant="ghost"
          size="lg"
          className="sm:w-auto"
          onClick={onSecondary}
        >
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
