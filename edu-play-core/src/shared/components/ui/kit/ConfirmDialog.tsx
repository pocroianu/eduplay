'use client';

import { useContext, useEffect, useId, type ReactNode } from 'react';
import {
  Box,
  FocusTrap,
  Group,
  MantineContext,
  MantineProvider,
  Modal,
  Paper,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { Button } from './Button';
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';
import { cn } from '@/shared/lib/utils/cn';

type ConfirmDialogActionSize = 'lg' | 'xl';

export interface ConfirmDialogProps {
  /** Whether the dialog is visible. */
  open: boolean;
  /** Headline. Defaults to a generic confirmation prompt. */
  title?: ReactNode;
  /** Optional supporting body copy. */
  body?: ReactNode;
  /** Confirm-button label. Defaults to "Confirmă". */
  confirmLabel?: ReactNode;
  /** Cancel-button label. Defaults to "Anulează". */
  cancelLabel?: ReactNode;
  /** Fired when the user confirms. */
  onConfirm: () => void;
  /** Fired when the user cancels (button, Escape, or backdrop click). */
  onCancel?: () => void;
  /** Tone the confirm action red-on-coral. Use for destructive operations. */
  destructive?: boolean;
  /** Optional icon shown in the header badge. */
  icon?: IconName;
  /** Optional icon rendered inside the confirm button. */
  confirmIcon?: IconName;
  /** Shared action button size. Defaults to the standard dialog size. */
  actionSize?: ConfirmDialogActionSize;
  /** Extra classes for the cancel action. */
  cancelClassName?: string;
  /** Extra classes for the confirm action. */
  confirmClassName?: string;
  className?: string;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  const mantineContext = useContext(MantineContext);
  const dialog = <ConfirmDialogContent {...props} />;

  return mantineContext ? dialog : <MantineProvider>{dialog}</MantineProvider>;
}

function ConfirmDialogContent({
  open,
  title = 'Ești sigur?',
  body,
  confirmLabel = 'Confirmă',
  cancelLabel = 'Anulează',
  onConfirm,
  onCancel,
  destructive = false,
  icon,
  confirmIcon,
  actionSize = 'lg',
  cancelClassName,
  confirmClassName,
  className,
}: ConfirmDialogProps) {
  const titleId = useId();
  const bodyId = useId();
  const cancelId = useId();
  const role = destructive ? 'alertdialog' : 'dialog';

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(cancelId)?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [cancelId, open]);

  return (
    <Modal.Root
      opened={open}
      onClose={() => onCancel?.()}
      centered
      radius="md"
      size={440}
      zIndex={60}
      trapFocus
      closeOnClickOutside
      closeOnEscape
      returnFocus
      transitionProps={{ duration: 160, transition: 'fade-up' }}
    >
      {open ? (
        <>
          <Modal.Overlay
            backgroundOpacity={0.28}
            blur={0}
            color="var(--color-ink)"
          />
          <Box
            className="mantine-Modal-inner"
            style={{
              alignItems: 'center',
              display: 'flex',
              inset: 0,
              justifyContent: 'center',
              padding: 'max(1rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom))',
              pointerEvents: 'none',
              position: 'fixed',
              zIndex: 61,
            }}
          >
            <FocusTrap active={open}>
              <Paper
                component="section"
                role={role}
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={body ? bodyId : undefined}
                className={cn('mantine-Modal-content', className)}
                radius="md"
                style={{
                  background: 'var(--color-surface-container-lowest)',
                  border: '1px solid var(--color-outline-variant)',
                  boxShadow: 'var(--shadow-soft-lg)',
                  maxHeight: 'calc(100dvh - 2rem)',
                  overflow: 'hidden',
                  pointerEvents: 'auto',
                  width: 'min(100%, 440px)',
                }}
              >
                <Modal.Header
                  styles={{
                    header: {
                      alignItems: 'flex-start',
                      borderBottom: '1px solid var(--color-outline-variant)',
                      gap: 12,
                      padding: '1rem 1.25rem',
                    },
                  }}
                >
                  {icon ? (
                    <ThemeIcon
                      aria-hidden="true"
                      radius="md"
                      size={44}
                      variant="light"
                      color={destructive ? 'red' : 'purple'}
                      styles={{
                        root: {
                          background: destructive
                            ? 'var(--color-error-soft)'
                            : 'var(--color-primary-soft)',
                          color: destructive
                            ? 'var(--color-error)'
                            : 'var(--color-primary-deep)',
                          flexShrink: 0,
                        },
                      }}
                    >
                      <Icon name={icon} size={24} weight="fill" />
                    </ThemeIcon>
                  ) : null}
                  <Modal.Title
                    id={titleId}
                    styles={{
                      title: {
                        color: 'var(--color-on-surface)',
                        flex: 1,
                        fontFamily: 'var(--font-display)',
                        fontSize: 22,
                        fontWeight: 800,
                        lineHeight: 1.15,
                      },
                    }}
                  >
                    {title}
                  </Modal.Title>
                  <Modal.CloseButton
                    aria-label="Închide"
                    size={44}
                    styles={{
                      close: {
                        color: 'var(--color-on-surface-variant)',
                        flexShrink: 0,
                      },
                    }}
                  />
                </Modal.Header>

                <Modal.Body p={0}>
                  <Stack gap="md" p="xl">
                    {body ? (
                      <Box id={bodyId}>
                        <Text
                          component="div"
                          size="sm"
                          lh={1.55}
                          c="var(--color-on-surface-variant)"
                        >
                          {body}
                        </Text>
                      </Box>
                    ) : null}
                  </Stack>

                  <Group
                    gap="sm"
                    justify="flex-end"
                    p="md"
                    styles={{
                      root: {
                        borderTop: '1px solid var(--color-outline-variant)',
                      },
                    }}
                  >
                    <Button
                      id={cancelId}
                      data-autofocus
                      variant="ghost"
                      size={actionSize}
                      className={cancelClassName}
                      onClick={() => onCancel?.()}
                    >
                      {cancelLabel}
                    </Button>
                    <Button
                      variant="primary"
                      size={actionSize}
                      className={cn(
                        destructive && 'bg-error text-on-error hover:bg-error/90',
                        confirmClassName,
                      )}
                      onClick={() => onConfirm()}
                    >
                      {confirmIcon ? <Icon name={confirmIcon} size={18} /> : null}
                      {confirmLabel}
                    </Button>
                  </Group>
                </Modal.Body>
              </Paper>
            </FocusTrap>
          </Box>
        </>
      ) : null}
    </Modal.Root>
  );
}
