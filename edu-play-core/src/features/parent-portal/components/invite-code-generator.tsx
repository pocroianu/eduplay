'use client';

import { ActionIcon, Button } from '@mantine/core';
import { useState, useTransition, useCallback, useEffect, useRef } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInUp } from '@/config/animations';
import { formatDateTime } from '@/lib/i18n/formatters';
import { generateParentInviteCode } from '../actions/generate-invite-code';

interface InviteCodeGeneratorProps {
  studentId: string;
  studentName: string;
}

interface InviteHeaderProps {
  studentName: string;
}

function InviteHeader({ studentName }: InviteHeaderProps) {
  return (
    <div className="px-6 pt-6 pb-2">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-primary-soft/20 p-2 text-primary">
          <Icon name="UserPlus" size={20} />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-on-surface">
            Invitație părinte
          </h4>
          <p className="text-sm text-on-surface-variant">
            Generează un cod pentru a conecta părintele la {studentName}
          </p>
        </div>
      </div>
    </div>
  );
}

interface InviteErrorMessageProps {
  error: string | null;
}

function InviteErrorMessage({ error }: InviteErrorMessageProps) {
  return (
    <AnimatePresence mode="wait">
      {error && (
        <motion.div
          key="error"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <div className="flex items-center gap-2 rounded-md bg-error/10 p-3 text-sm text-error">
            <Icon name="XCircle" size={16} />
            <span>{error}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface GeneratedCodeDisplayProps {
  generatedCode: string | null;
  expiresAt: string | null;
  isCopied: boolean;
  onCopy: () => Promise<void>;
}

function GeneratedCodeDisplay({
  generatedCode,
  expiresAt,
  isCopied,
  onCopy,
}: GeneratedCodeDisplayProps) {
  if (!generatedCode) {
    return null;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="code-display"
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        exit="exit"
        className="flex flex-col items-center gap-3 rounded-xl bg-primary-soft/10 p-5"
      >
        <span className="text-sm text-primary font-medium uppercase tracking-wider">
          Cod de invitare
        </span>

        <div className="flex items-center gap-3">
          <span
            className="text-3xl font-bold font-mono tracking-[0.3em] text-primary select-all"
            aria-label={`Cod de invitare: ${generatedCode}`}
          >
            {generatedCode}
          </span>

          <ActionIcon
            aria-label={isCopied ? 'Cod copiat' : 'Copiază codul'}
            color="purple"
            radius="md"
            size={44}
            variant={isCopied ? 'filled' : 'default'}
            classNames={{
              root: isCopied
                ? 'text-on-primary'
                : 'bg-surface-container-lowest border-outline-variant shadow-soft-sm text-primary hover:bg-primary-soft/20',
            }}
            onClick={() => {
              void onCopy();
            }}
          >
            {isCopied ? (
              <Icon name="Check" size={18} />
            ) : (
              <Icon name="Copy" size={18} />
            )}
          </ActionIcon>
        </div>

        {expiresAt && (
          <motion.div variants={fadeInUp} initial="initial" animate="animate">
            <span className="text-xs text-primary text-center">
              Expiră pe {formatDateTime(expiresAt)}
            </span>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function InviteInstructions() {
  return (
    <motion.div variants={fadeInUp} initial="initial" animate="animate">
      <div className="flex items-start gap-2 rounded-md bg-primary-soft/10 p-3 text-sm text-primary">
        <Icon name="Info" size={16} className="mt-0.5 shrink-0" />
        <span>
          Transmite acest cod părintelui pentru a-și conecta contul la profilul
          elevului. Codul este valabil 7 zile și poate fi folosit o singură
          dată.
        </span>
      </div>
    </motion.div>
  );
}

function getGenerateLabel(isPending: boolean, hasGeneratedCode: boolean) {
  if (isPending) {
    return 'Se generează...';
  }

  if (hasGeneratedCode) {
    return 'Generează cod nou';
  }

  return 'Generează cod de invitare părinte';
}

function getGenerateAriaLabel(hasGeneratedCode: boolean, studentName: string) {
  if (hasGeneratedCode) {
    return 'Generează un cod nou de invitare';
  }

  return `Generează cod de invitare pentru ${studentName}`;
}

function getGenerateRootClass(hasGeneratedCode: boolean) {
  if (hasGeneratedCode) {
    return 'min-h-11 border-outline-variant shadow-soft-sm text-primary hover:bg-primary-soft/20';
  }

  return 'min-h-11 text-on-primary hover:bg-primary/90';
}

interface GenerateInviteButtonProps {
  hasGeneratedCode: boolean;
  isPending: boolean;
  studentName: string;
  onGenerate: () => void;
}

function GenerateInviteButton({
  hasGeneratedCode,
  isPending,
  studentName,
  onGenerate,
}: GenerateInviteButtonProps) {
  const iconName = hasGeneratedCode ? 'ArrowClockwise' : 'UserPlus';

  return (
    <Button
      onClick={onGenerate}
      loading={isPending}
      loaderProps={{ size: 16, color: 'currentColor' }}
      fullWidth
      color="purple"
      radius="md"
      size="md"
      variant={hasGeneratedCode ? 'default' : 'filled'}
      leftSection={isPending ? undefined : <Icon name={iconName} size={16} />}
      classNames={{
        root: getGenerateRootClass(hasGeneratedCode),
        label: 'font-medium',
      }}
      aria-label={getGenerateAriaLabel(hasGeneratedCode, studentName)}
    >
      {getGenerateLabel(isPending, hasGeneratedCode)}
    </Button>
  );
}

/**
 * InviteCodeGenerator - Teacher UI component for generating parent invite codes.
 */
export function InviteCodeGenerator({
  studentId,
  studentName,
}: InviteCodeGeneratorProps) {
  const [isPending, startTransition] = useTransition();
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleGenerate = useCallback(() => {
    setError(null);
    setIsCopied(false);

    startTransition(async () => {
      const result = await generateParentInviteCode({ studentId });

      if (!result.success) {
        setError(result.error ?? 'A apărut o eroare. Încearcă din nou.');
        return;
      }

      if (result.data) {
        setGeneratedCode(result.data.code);
        setExpiresAt(result.data.expiresAt);
      }
    });
  }, [studentId]);

  const handleCopy = useCallback(async () => {
    if (!generatedCode) return;

    try {
      await navigator.clipboard.writeText(generatedCode);
      setIsCopied(true);

      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }

      copyTimeoutRef.current = setTimeout(() => {
        setIsCopied(false);
        copyTimeoutRef.current = null;
      }, 3000);
    } catch {
      // Clipboard API unavailable - code is still selectable in the UI
    }
  }, [generatedCode]);

  return (
    <div className="bg-surface-container-lowest border border-outline-variant shadow-soft-sm overflow-hidden rounded-xl">
      <InviteHeader studentName={studentName} />

      <div className="py-3" />

      <div className="p-6">
        <div className="flex flex-col gap-4">
          <InviteErrorMessage error={error} />
          <GeneratedCodeDisplay
            generatedCode={generatedCode}
            expiresAt={expiresAt}
            isCopied={isCopied}
            onCopy={handleCopy}
          />
          {generatedCode && <InviteInstructions />}
          <GenerateInviteButton
            hasGeneratedCode={Boolean(generatedCode)}
            isPending={isPending}
            studentName={studentName}
            onGenerate={handleGenerate}
          />
        </div>
      </div>
    </div>
  );
}
