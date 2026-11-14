"use client";

import { ConfirmDialog } from "@/shared/components/ui/kit";

interface ExitConfirmDialogProps {
  open: boolean;
  onStay: () => void;
  onExit: () => void;
}

export function ExitConfirmDialog({
  open,
  onStay,
  onExit,
}: ExitConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      destructive
      icon="SignOut"
      confirmIcon="SignOut"
      title="Ieși din joc?"
      body={
        <p className="mx-auto my-0 max-w-[340px] text-center text-lg leading-relaxed text-on-surface-variant">
          Dacă ieși acum, progresul nu se va salva. Ești sigur?
        </p>
      }
      cancelLabel="Rămân în joc"
      confirmLabel="Ies din joc"
      actionSize="xl"
      cancelClassName="min-h-16 sm:min-w-36"
      confirmClassName="min-h-16 sm:min-w-36"
      onCancel={onStay}
      onConfirm={onExit}
    />
  );
}
