"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Notification } from "@mantine/core";
import { MantineBoundary } from "./MantineBoundary";

import { Icon } from "@/shared/components/ui/Icon";

import type { IconName } from "@/shared/components/ui/Icon.registry";

import { cn } from "@/shared/lib/utils/cn";

export type ToastVariant = "info" | "success" | "error" | "destructive";

export interface ToastOptions {
  /** Short title or single-line message. */

  message: ReactNode;

  /** Optional supporting body line. */

  description?: ReactNode;

  /** Visual tone. Defaults to 'info'. */

  variant?: ToastVariant;

  /** Auto-dismiss timeout in ms. Defaults to 5000. Pass 0 to keep open until dismissed. */

  duration?: number;
}

export interface ToastDescriptor
  extends Required<Pick<ToastOptions, "message">> {
  id: string;

  description?: ReactNode;

  variant: ToastVariant;

  duration: number;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => string;

  dismiss: (id: string) => void;

  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 5000;

const VARIANT_STYLE: Record<
  ToastVariant,
  {
    bg: string;
    text: string;
    iconBg: string;
    icon: IconName;
    role: "status" | "alert";
    live: "polite" | "assertive";
  }
> = {
  info: {
    bg: "bg-surface-container-lowest",

    text: "text-on-surface",

    iconBg: "bg-blue-soft text-blue-deep",

    icon: "Info",

    role: "status",

    live: "polite",
  },

  success: {
    bg: "bg-surface-container-lowest",

    text: "text-on-surface",

    iconBg: "bg-primary-soft text-primary-deep",

    icon: "CheckCircle",

    role: "status",

    live: "polite",
  },

  error: {
    bg: "bg-surface-container-lowest",

    text: "text-on-surface",

    iconBg: "bg-coral-soft text-coral-deep",

    icon: "XCircle",

    role: "alert",

    live: "assertive",
  },

  destructive: {
    bg: "bg-surface-container-lowest",

    text: "text-on-surface",

    iconBg: "bg-error-soft text-error",

    icon: "Warning",

    role: "alert",

    live: "assertive",
  },
};

let idCounter = 0;

function generateId(): string {
  idCounter += 1;

  return `toast-${Date.now()}-${idCounter}`;
}

export interface ToastProviderProps {
  children: ReactNode;

  /** Override the default 5000ms auto-dismiss across all toasts. */

  defaultDuration?: number;
}

export function ToastProvider({
  children,
  defaultDuration = DEFAULT_DURATION,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastDescriptor[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = generateId();

      const next: ToastDescriptor = {
        id,

        message: options.message,

        description: options.description,

        variant: options.variant ?? "info",

        duration: options.duration ?? defaultDuration,
      };

      setToasts((current) => [...current, next]);

      return id;
    },

    [defaultDuration],
  );

  const value = useMemo<ToastContextValue>(
    () => ({ toast, dismiss, dismissAll }),

    [toast, dismiss, dismissAll],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);

  if (!ctx) {
    throw new Error("useToast() must be used inside <ToastProvider>.");
  }

  return ctx;
}

interface ToastViewportProps {
  toasts: ToastDescriptor[];

  onDismiss: (id: string) => void;
}

function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-0 z-[80] flex flex-col items-center sm:items-end justify-end sm:justify-start gap-3 p-4 sm:p-6"
    >
      <div className="flex w-full max-w-sm flex-col items-center sm:items-end gap-3">
        <AnimatePresence initial={false}>
          {toasts.map((descriptor) => (
            <Toast
              key={descriptor.id}
              descriptor={descriptor}
              onDismiss={onDismiss}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export interface ToastProps {
  descriptor: ToastDescriptor;

  onDismiss: (id: string) => void;
}

function Toast({ descriptor, onDismiss }: ToastProps) {
  const { id, message, description, variant, duration } = descriptor;

  const reduceMotion = useReducedMotion();

  const style = VARIANT_STYLE[variant];

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);

      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();

    if (duration <= 0) return;

    timerRef.current = setTimeout(() => onDismiss(id), duration);
  }, [duration, id, onDismiss, clearTimer]);

  useEffect(() => {
    startTimer();

    return clearTimer;
  }, [startTimer, clearTimer]);

  return (
    <motion.div
      role={style.role}
      aria-live={style.live}
      data-testid={`toast-${id}`}
      data-variant={variant}
      onMouseEnter={clearTimer}
      onMouseLeave={startTimer}
      onFocus={clearTimer}
      onBlur={startTimer}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{
        duration: reduceMotion ? 0.05 : 0.2,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={cn(
        "pointer-events-auto flex w-full items-start gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-popover",

        style.bg,

        style.text,
      )}
    >
      <MantineBoundary>
        <Notification
          role="presentation"
          className="w-full"
          withBorder={false}
          p={0}
          styles={{
            root: {
              backgroundColor: "transparent",
              boxShadow: "none",
              color: "inherit",
            },
            icon: { backgroundColor: "transparent", color: "inherit" },
          }}
          onClose={() => onDismiss(id)}
          closeButtonProps={{ "aria-label": "Închide notificarea" }}
          icon={<Icon name={style.icon} size={20} />}
        >
          <div className="flex flex-col min-w-0 flex-1 gap-0.5">
            <span className="text-[15px] font-bold leading-snug">
              {message}
            </span>

            {description ? (
              <span className="text-[13px] leading-snug opacity-90">
                {description}
              </span>
            ) : null}
          </div>
        </Notification>
      </MantineBoundary>
    </motion.div>
  );
}
