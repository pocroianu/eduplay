'use client';

import { Button as MantineButton, MantineContext, MantineProvider } from '@mantine/core';
import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { studentLoginSchema } from '../schemas/student-login.schema';
import { studentLogin } from '../actions/student-login';
import { isStudentLoginRateLimited } from '../utils/student-login-errors';
import {
  KidTextField,
  PinDotRow,
  Numpad,
  type VulpitaMood,
} from '@/shared/components/ui/kit';
import { Icon } from '@/shared/components/ui/Icon';
import { cn } from '@/shared/lib/utils/cn';

const clientSchema = studentLoginSchema.pick({ username: true });
type ClientFormData = { username: string };

type AttemptStatus = 'calm' | 'retry' | 'lockout' | 'success';

const MOOD_FOR_STATUS: Record<AttemptStatus, VulpitaMood> = {
  calm: 'happy',
  retry: 'think',
  lockout: 'sleep',
  success: 'cheer',
};

const LOCKOUT_RESET_MS = 15 * 60 * 1000;
const CELEBRATION_MS = 650;
const RECENT_USERNAMES_KEY = 'eduplay:student-recent-usernames';
const RECENT_USERNAMES_CHANGED_EVENT = 'eduplay:student-recent-usernames-changed';
const EMPTY_RECENTS_SNAPSHOT = '[]';
const MAX_RECENTS = 4;

function readRecentUsernamesSnapshot(): string {
  if (typeof window === 'undefined') return EMPTY_RECENTS_SNAPSHOT;
  try {
    return window.localStorage.getItem(RECENT_USERNAMES_KEY) ?? EMPTY_RECENTS_SNAPSHOT;
  } catch {
    return EMPTY_RECENTS_SNAPSHOT;
  }
}

function parseRecentUsernames(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string').slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

function readRecentUsernames(): string[] {
  return parseRecentUsernames(readRecentUsernamesSnapshot());
}

function emitRecentUsernamesChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(RECENT_USERNAMES_CHANGED_EVENT));
}

function subscribeRecentUsernames(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key === RECENT_USERNAMES_KEY) {
      onStoreChange();
    }
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(RECENT_USERNAMES_CHANGED_EVENT, onStoreChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(RECENT_USERNAMES_CHANGED_EVENT, onStoreChange);
  };
}

function getServerRecentUsernamesSnapshot() {
  return EMPTY_RECENTS_SNAPSHOT;
}

function pushRecentUsername(username: string) {
  if (typeof window === 'undefined') return;
  try {
    const current = readRecentUsernames();
    const next = [username, ...current.filter((u) => u !== username)].slice(0, MAX_RECENTS);
    window.localStorage.setItem(RECENT_USERNAMES_KEY, JSON.stringify(next));
    emitRecentUsernamesChanged();
  } catch {
    // localStorage may be disabled — silently ignore; flow still works.
  }
}

export interface StudentPinPadProps {
  /**
   * Notifies a parent surface (typically the kid AuthShell) about the current
   * mascot mood so the shell can drive the single visible Vulpița.
   */
  onMoodChange?: (mood: VulpitaMood) => void;
  lockoutResetMs?: number;
}

export function StudentPinPad({
  onMoodChange,
  lockoutResetMs = LOCKOUT_RESET_MS,
}: StudentPinPadProps = {}) {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [status, setStatus] = useState<AttemptStatus>('calm');
  const [isPending, startTransition] = useTransition();
  const mantineContext = useContext(MantineContext);
  const recentUsernamesSnapshot = useSyncExternalStore(
    subscribeRecentUsernames,
    readRecentUsernamesSnapshot,
    getServerRecentUsernamesSnapshot,
  );
  const recents = useMemo(
    () => parseRecentUsernames(recentUsernamesSnapshot),
    [recentUsernamesSnapshot],
  );
  const usernameInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
  });

  const { ref: rhfUsernameRef, ...usernameField } = form.register('username');

  const handleDigit = (digit: number) => {
    if (pin.length < 4) {
      setPin((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const pickRecent = (username: string) => {
    form.setValue('username', username, { shouldValidate: true });
    // Move focus to PIN entry by blurring the (now-filled) username field.
    usernameInputRef.current?.blur();
  };

  const clearRecents = () => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(RECENT_USERNAMES_KEY);
      } catch {
        // ignore
      }
    }
    emitRecentUsernamesChanged();
  };

  const onValidSubmit = (data: ClientFormData) => {
    if (pin.length !== 4) return;

    const formData = new FormData();
    formData.append('username', data.username);
    formData.append('pin', pin);

    setError(null);
    startTransition(async () => {
      try {
        const result = await studentLogin(formData);
        if (result?.ok) {
          pushRecentUsername(data.username);
          setStatus('success');
          window.setTimeout(() => {
            router.push(result.redirectTo);
          }, CELEBRATION_MS);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : t('login.studentPad.fallbackError');
        if (isStudentLoginRateLimited(message)) {
          setStatus('lockout');
          setError(t('login.studentPad.lockoutError'));
        } else {
          setStatus('retry');
          setError(message);
        }
        setPin('');
        setShakeKey((n) => n + 1);
      }
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    form.handleSubmit(onValidSubmit)(e);
  };

  const handleNumpadSubmit = () => {
    form.handleSubmit(onValidSubmit)();
  };

  const mood = MOOD_FOR_STATUS[status];
  const isLocked = status === 'lockout';
  const isSucceeding = status === 'success';
  const inputsDisabled = isPending || isLocked || isSucceeding;

  useEffect(() => {
    onMoodChange?.(mood);
  }, [mood, onMoodChange]);

  useEffect(() => {
    if (!isLocked) return;

    const timerId = window.setTimeout(() => {
      setStatus('calm');
      setError(null);
    }, lockoutResetMs);

    return () => window.clearTimeout(timerId);
  }, [isLocked, lockoutResetMs]);

  const formMarkup = (
    <form onSubmit={handleFormSubmit} className="flex flex-col gap-5">
      {recents.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-on-surface-variant">
            {t('login.studentPad.recentLabel')}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {recents.map((name) => (
              <MantineButton
                key={name}
                type="button"
                onClick={() => pickRecent(name)}
                disabled={inputsDisabled}
                variant="light"
                color="purple"
                radius="xl"
                size="md"
                leftSection={<Icon name="User" size={18} weight="fill" aria-hidden />}
                className="min-h-11 border border-outline-variant bg-primary-soft text-base font-bold text-primary-deep shadow-soft-sm"
              >
                {name}
              </MantineButton>
            ))}
            <MantineButton
              type="button"
              onClick={clearRecents}
              disabled={inputsDisabled}
              variant="subtle"
              color="purple"
              radius="xl"
              size="sm"
              className="ml-1 min-h-11 text-sm font-semibold text-on-surface-variant"
            >
              {t('login.studentPad.clearRecents')}
            </MantineButton>
          </div>
        </div>
      )}

      <KidTextField
        ref={(el) => {
          rhfUsernameRef(el);
          usernameInputRef.current = el;
        }}
        label={t('login.studentPad.usernameLabel')}
        icon="User"
        placeholder={t('login.studentPad.usernamePlaceholder')}
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoFocus
        disabled={inputsDisabled}
        error={form.formState.errors.username?.message}
        {...usernameField}
      />

      <div className="flex flex-col items-center gap-3">
        <p className="text-center font-headline text-lg font-bold text-on-surface">
          {t('login.studentPad.pinPrompt')}
        </p>
        <PinDotRow
          filled={pin.length}
          length={4}
          shakeKey={shakeKey || undefined}
          success={isSucceeding}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-2xl bg-error-soft p-3 text-base font-semibold text-error"
        >
          <span aria-hidden="true" className="mt-0.5 shrink-0">
            <Icon name="WarningCircle" weight="fill" aria-hidden />
          </span>
          <span>{error}</span>
        </div>
      )}

      {isSucceeding && (
        <div
          role="status"
          className={cn(
            'flex items-center justify-center gap-2 rounded-2xl bg-primary-soft p-3 text-base font-bold text-primary-deep',
            'animate-in fade-in zoom-in-95 duration-200',
          )}
        >
          <Icon name="Check" weight="bold" size={24} aria-hidden />
          <span>{t('login.studentPad.successMessage')}</span>
        </div>
      )}

      <Numpad
        onDigit={handleDigit}
        onBackspace={handleBackspace}
        onSubmit={handleNumpadSubmit}
        disabled={inputsDisabled}
        submitDisabled={pin.length !== 4}
        isPending={isPending}
        density="compact"
        animated={false}
      />
    </form>
  );

  return mantineContext ? formMarkup : <MantineProvider>{formMarkup}</MantineProvider>;
}
