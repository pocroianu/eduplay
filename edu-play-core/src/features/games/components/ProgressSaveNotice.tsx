'use client';

import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/components/ui/kit';
import type { ProgressSaveStatus } from '../player/activity-play-session';

export function ProgressSaveNotice({ status, onRetry, showSuccess = false }: {
  status: ProgressSaveStatus; onRetry?: () => void; showSuccess?: boolean;
}) {
  const { t } = useTranslation('player');
  return (
    <div className="text-center text-lg text-on-surface-variant">
      {showSuccess && status === 'saving' && <p>{t('saving.pending')}</p>}
      <p role="status">{showSuccess && status === 'saved' ? t('saving.saved') : ''}</p>
      <p role="alert">{status === 'error' ? t('saving.error') : ''}</p>
      {status === 'error' && (
        <Button mode="kid" size="lg" onClick={onRetry}>{t('saving.retry')}</Button>
      )}
    </div>
  );
}
