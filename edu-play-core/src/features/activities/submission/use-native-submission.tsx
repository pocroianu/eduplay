'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/shared/components/ui/kit';
import { recoverNativeActivity } from './native-submission-actions';
import type { NativeSubmissionReceipt } from './native-submission-types';

/** Store only the retry key, never learner media, in browser storage. */
export function useNativeSubmission(instanceId: string) {
  const key = `native-submission-v1:${instanceId}`;
  const id = useRef<string | null>(null);
  const newWork = useRef(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<NativeSubmissionReceipt[]>([]);
  const [recovering, setRecovering] = useState(true);
  const [recoveryError, setRecoveryError] = useState(false);
  const refresh = useCallback(async () => {
    setRecovering(true);
    try {
      const saved = await recoverNativeActivity(instanceId);
      setReceipts(saved);
      if (!id.current && !newWork.current && saved[0])
        id.current = saved[0].submissionId;
      setActiveId(id.current);
      setRecoveryError(false);
    } catch {
      setRecoveryError(true);
    } finally {
      setRecovering(false);
    }
  }, [instanceId]);
  useEffect(() => {
    try {
      id.current = localStorage.getItem(key);
    } catch {
      /* Storage can be unavailable. */
    }
    void refresh();
  }, [key, refresh]);
  function submissionId(): string {
    id.current ??= crypto.randomUUID();
    setActiveId(id.current);
    try {
      localStorage.setItem(key, id.current);
    } catch {
      /* Mounted retries keep their key. */
    }
    return id.current;
  }
  function saved(receipt: NativeSubmissionReceipt): void {
    setActiveId(receipt.submissionId);
    setReceipts((current) => [
      receipt,
      ...current.filter((item) => item.submissionId !== receipt.submissionId),
    ]);
  }
  function startAgain(): void {
    newWork.current = true;
    id.current = null;
    setActiveId(null);
    try {
      localStorage.removeItem(key);
    } catch {
      /* No media is stored here. */
    }
  }
  const alreadySaved = receipts.some(
    (receipt) => receipt.submissionId === activeId,
  );
  return {
    submissionId,
    saved,
    startAgain,
    receipts,
    recovering,
    recoveryError,
    refresh,
    alreadySaved,
  };
}

export function NativeSubmissionNotice({
  submission,
  onStartAgain = submission.startAgain,
}: {
  submission: ReturnType<typeof useNativeSubmission>;
  onStartAgain?: () => void;
}) {
  const pending = submission.receipts.some(
    (receipt) => receipt.progressionPending,
  );
  if (submission.recovering && submission.receipts.length === 0) {
    return (
      <p className="text-body" role="status">
        Verificăm lucrările salvate…
      </p>
    );
  }
  if (!pending && !submission.recoveryError && submission.receipts.length === 0)
    return null;
  let message = 'Lucrarea ta este salvată.';
  if (submission.recoveryError)
    message = 'Nu am putut verifica salvarea anterioară.';
  else if (pending)
    message = 'Lucrarea ta este salvată. Mai avem de actualizat parcursul.';
  return (
    <div className="flex flex-col gap-3 text-body" role="status">
      <p>{message}</p>
      {submission.alreadySaved && (
        <Button mode="kid" size="lg" type="button" onClick={onStartAgain}>
          Începe o lucrare nouă
        </Button>
      )}
      {(pending || submission.recoveryError) && (
        <Button
          mode="kid"
          size="lg"
          type="button"
          disabled={submission.recovering}
          onClick={() => void submission.refresh()}
        >
          Reîncearcă actualizarea
        </Button>
      )}
    </div>
  );
}
