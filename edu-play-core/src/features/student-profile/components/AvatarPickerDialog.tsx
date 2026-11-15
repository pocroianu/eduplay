"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Modal, UnstyledButton } from "@mantine/core";
import { Button, MantineBoundary } from "@/shared/components/ui/kit";
import { Icon } from "@/shared/components/ui/Icon";
import { cn } from "@/shared/lib/utils/cn";
import { AVATAR_PRESETS } from "../schemas/avatar.schema";

export interface AvatarPickerDialogProps {
  open: boolean;
  currentAvatarUrl?: string | null;
  onCancel: () => void;
  onSelect: (avatarUrl: string) => Promise<void> | void;
  busy?: boolean;
}

export function AvatarPickerDialog({
  open,
  currentAvatarUrl,
  onCancel,
  onSelect,
  busy = false,
}: AvatarPickerDialogProps) {
  return (
    <MantineBoundary>
      <Modal.Root opened={open} onClose={onCancel} size="40rem">
        <Modal.Overlay />
        <Modal.Content aria-label="Avatar">
          <Modal.Body p={0}>
            <AnimatePresence>
          {open ? (
            <AvatarPickerDialogBody
              currentAvatarUrl={currentAvatarUrl}
              onCancel={onCancel}
              onSelect={onSelect}
              busy={busy}
            />
          ) : null}
        </AnimatePresence>
          </Modal.Body>
        </Modal.Content>
      </Modal.Root>
    </MantineBoundary>
  );
}

interface AvatarPickerDialogBodyProps {
  currentAvatarUrl?: string | null;
  onCancel: () => void;
  onSelect: (avatarUrl: string) => Promise<void> | void;
  busy: boolean;
}

function AvatarPickerDialogBody({
  currentAvatarUrl,
  onCancel,
  onSelect,
  busy,
}: AvatarPickerDialogBodyProps) {
  const titleId = useId();
  const reduceMotion = useReducedMotion();
  // Body remounts every time the parent toggles `open`, so the initial state
  // can be derived from `currentAvatarUrl` without a sync-effect reset.
  const [selected, setSelected] = useState<string>(() =>
    currentAvatarUrl &&
    AVATAR_PRESETS.includes(currentAvatarUrl as (typeof AVATAR_PRESETS)[number])
      ? currentAvatarUrl
      : AVATAR_PRESETS[0],
  );

  const handleConfirm = () => {
    if (busy) return;
    void onSelect(selected);
  };

  return (
    <motion.div
        className={cn(
          "flex max-h-[92vh] w-full flex-col overflow-hidden",
          "bg-surface-container-lowest shadow-modal",
        )}
        initial={reduceMotion ? { opacity: 0 } : { y: 48, opacity: 0 }}
        animate={reduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { y: 32, opacity: 0 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 0.24, ease: [0.4, 0, 0.2, 1] }
        }
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-outline-variant px-5 py-4 md:px-6">
          <UnstyledButton
            type="button"
            onClick={onCancel}
            aria-label="Închide"
            className="inline-flex size-16 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors ease-press hover:bg-primary-soft hover:text-primary"
          >
            <Icon name="X" size={20} />
          </UnstyledButton>
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="text-[22px] font-bold leading-tight text-on-surface"
            >
              Schimbă avatarul
            </h2>
            <p className="mt-1 text-base text-on-surface-variant">
              Alege o imagine care îți place.
            </p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 md:px-6">
          <div className="grid grid-cols-3 gap-3 md:grid-cols-4 md:gap-4">
            {AVATAR_PRESETS.map((preset, index) => {
              const isSelected = preset === selected;
              return (
                <UnstyledButton
                  key={preset}
                  type="button"
                  aria-label={`Avatar ${index + 1}`}
                  aria-pressed={isSelected}
                  onClick={() => setSelected(preset)}
                  className={cn(
                    "relative flex items-center justify-center",
                    "aspect-square min-h-[64px] w-full min-w-[64px] overflow-hidden rounded-2xl",
                    "outline-none transition-[box-shadow,background-color] duration-200 ease-press",
                    "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    isSelected
                      ? "bg-primary-wash ring-2 ring-primary shadow-soft-sm"
                      : "ring-1 ring-outline-variant hover:bg-primary-wash hover:ring-primary/40",
                  )}
                >
                  <Image
                    src={preset}
                    alt=""
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                    priority={index < 4}
                  />
                  {isSelected ? (
                    <span className="absolute bottom-2 right-2 flex size-7 items-center justify-center rounded-full bg-primary text-on-primary">
                      <Icon name="Check" size={18} weight="fill" />
                    </span>
                  ) : null}
                </UnstyledButton>
              );
            })}
          </div>
        </div>
        <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-outline-variant px-5 py-4 md:flex-row md:px-6">
          <Button
            variant="ghost"
            size="lg"
            onClick={onCancel}
            disabled={busy}
            fullWidth
            className="h-16 md:flex-1"
          >
            Anulează
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={handleConfirm}
            disabled={busy}
            isPending={busy}
            fullWidth
            className="h-16 md:flex-1"
          >
            {busy ? "Se salvează…" : "Salvează avatarul"}
          </Button>
        </footer>
      </motion.div>
  );
}
