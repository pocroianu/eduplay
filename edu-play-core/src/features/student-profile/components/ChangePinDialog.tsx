"use client";

import { useEffect, useId, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Button, PinDotRow, Numpad } from "@/shared/components/ui/kit";
import { Icon } from "@/shared/components/ui/Icon";
import { cn } from "@/shared/lib/utils/cn";
import { changePinAction } from "../actions/change-pin";

export interface ChangePinDialogProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

type Step = "current" | "new" | "confirm";

const STEP_COPY: Record<Step, { title: string; hint: string }> = {
  current: {
    title: "Introdu PIN-ul actual",
    hint: "Avem nevoie de PIN-ul tău actual ca să confirmăm că ești tu.",
  },
  new: {
    title: "Alege un PIN nou",
    hint: "Alege patru cifre. Ține-l secret — doar tu ai voie să-l știi.",
  },
  confirm: {
    title: "Confirmă PIN-ul nou",
    hint: "Mai introdu o dată noul PIN, ca să fim siguri că-l ții minte.",
  },
};

const ORDER: Step[] = ["current", "new", "confirm"];

export function ChangePinDialog({
  open,
  onCancel,
  onSuccess,
}: ChangePinDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open ? (
        <ChangePinDialogBody onCancel={onCancel} onSuccess={onSuccess} />
      ) : null}
    </AnimatePresence>
  );
}

interface ChangePinDialogBodyProps {
  onCancel: () => void;
  onSuccess: () => void;
}

function ChangePinDialogBody({
  onCancel,
  onSuccess,
}: ChangePinDialogBodyProps) {
  const titleId = useId();
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState<Step>("current");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [pending, setPending] = useState(false);

  const value =
    step === "current" ? currentPin : step === "new" ? newPin : confirmPin;
  const setValue =
    step === "current"
      ? setCurrentPin
      : step === "new"
        ? setNewPin
        : setConfirmPin;

  const handleDigit = (digit: number) => {
    setError(null);
    if (value.length >= 4) return;
    setValue((prev) => (prev + String(digit)).slice(0, 4));
  };

  const handleBackspace = () => {
    setError(null);
    setValue((prev) => prev.slice(0, -1));
  };

  const advance = async () => {
    if (value.length !== 4) return;

    if (step === "current") {
      setStep("new");
      return;
    }
    if (step === "new") {
      if (newPin === currentPin) {
        setError("Noul PIN trebuie să fie diferit de cel actual.");
        setShakeKey((k) => k + 1);
        setNewPin("");
        return;
      }
      setStep("confirm");
      return;
    }

    if (confirmPin !== newPin) {
      setError("Confirmarea PIN-ului nu se potrivește.");
      setShakeKey((k) => k + 1);
      setConfirmPin("");
      return;
    }

    setPending(true);
    const result = await changePinAction({ currentPin, newPin, confirmPin });
    setPending(false);

    if (!result.success) {
      setError(result.error ?? "Nu am putut schimba PIN-ul.");
      setShakeKey((k) => k + 1);
      setStep("current");
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      return;
    }

    onSuccess();
  };

  const stepIndex = ORDER.indexOf(step);
  const copy = STEP_COPY[step];

  return (
    <motion.div
      key="change-pin"
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 0.2, ease: [0.4, 0, 0.2, 1] }
      }
    >
      <button
        type="button"
        aria-label="Închide"
        className="absolute inset-0 bg-on-surface/20"
        onClick={onCancel}
      />
      <motion.div
        className={cn(
          "relative flex max-h-[92vh] w-full flex-col overflow-hidden border border-outline-variant md:w-[480px]",
          "rounded-t-md bg-surface-container-lowest shadow-soft-sm md:rounded-md",
        )}
        initial={reduceMotion ? { opacity: 0 } : { y: 16, opacity: 0 }}
        animate={reduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { y: 12, opacity: 0 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 0.2, ease: [0.4, 0, 0.2, 1] }
        }
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-outline-variant px-5 py-4 md:px-6">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Închide"
            className="inline-flex size-16 shrink-0 items-center justify-center rounded-md border border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors ease-press hover:bg-surface-container hover:text-on-surface"
          >
            <Icon name="X" size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Pasul {stepIndex + 1} din {ORDER.length}
            </span>
            <h2
              id={titleId}
              className="mt-2 text-[22px] font-semibold leading-tight text-on-surface"
            >
              {copy.title}
            </h2>
            <p className="mt-1 max-w-[34ch] text-base text-on-surface-variant">
              {copy.hint}
            </p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 md:px-6">
          <div className="my-1 flex flex-col items-center gap-5">
            <PinDotRow
              filled={value.length}
              shakeKey={shakeKey || undefined}
              ariaLabelPrefix={copy.title}
            />
            {error ? (
              <p
                role="alert"
                className="max-w-[28ch] text-center text-sm font-bold text-error"
              >
                {error}
              </p>
            ) : null}
          </div>

          <Numpad
            onDigit={handleDigit}
            onBackspace={handleBackspace}
            onSubmit={() => {
              void advance();
            }}
            submitDisabled={value.length !== 4}
            isPending={pending}
          />
        </div>
        <footer className="shrink-0 border-t border-outline-variant px-5 py-4 md:px-6">
          <Button
            variant="ghost"
            size="lg"
            onClick={onCancel}
            disabled={pending}
            fullWidth
            className="h-16"
          >
            Renunță
          </Button>
        </footer>
      </motion.div>
    </motion.div>
  );
}
