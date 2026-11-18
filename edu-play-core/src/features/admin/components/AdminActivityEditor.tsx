'use client';

import { useMemo, useState } from 'react';
import { Textarea } from '@mantine/core';
import { useRouter } from 'next/navigation';
import type {
  ActivityRow,
  ActivityTypeRow,
  ActivityVersionRow,
} from '@/features/api';
import { Button, useToast } from '@/shared/components/ui/kit';
import { Icon } from '@/shared/components/ui/Icon';
import { ROUTES } from '@/shared/lib/constants/routes';
import { formatDateShort } from '@/lib/i18n/formatters';
import { ActivityStatusBadge, getActivityStatus } from './ActivityStatusBadge';

export interface AdminActivityEditorProps {
  activity: ActivityRow;
  activityType: ActivityTypeRow;
  initialVersions: ActivityVersionRow[];
}

interface PreviewState {
  previewId: string;
  expiresAt: string;
}

interface EditorFeedback {
  kind: 'success' | 'validation';
  title: string;
  body: string;
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null);
  return body?.error?.message ?? fallback;
}

function parseConfigDraft(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error('Configurația trebuie să fie JSON valid.');
  }
}

export function AdminActivityEditor({
  activity,
  activityType,
  initialVersions,
}: AdminActivityEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [currentActivity, setCurrentActivity] = useState(activity);
  const [versions, setVersions] = useState(initialVersions.slice(0, 5));
  const [configDraft, setConfigDraft] = useState(() => prettyJson(activity.configData));
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [feedback, setFeedback] = useState<EditorFeedback | null>(null);
  const [pendingAction, setPendingAction] = useState<
    'preview' | 'publish' | `revert:${number}` | null
  >(null);

  const currentJson = useMemo(() => {
    try {
      return prettyJson(JSON.parse(configDraft));
    } catch {
      return configDraft;
    }
  }, [configDraft]);

  const previewSrc = preview
    ? `${ROUTES.PLAY.ACTIVITY(currentActivity.id)}?previewId=${encodeURIComponent(preview.previewId)}`
    : null;
  const canPublish = getActivityStatus(currentActivity) === 'draft';

  const requestPreview = async () => {
    setPendingAction('preview');
    setFeedback(null);
    try {
      const configData = parseConfigDraft(configDraft);
      const response = await fetch(`/api/v1/activities/${currentActivity.id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typeId: currentActivity.template,
          configData,
        }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Nu am putut pregăti previzualizarea'));
      }
      const body = await response.json();
      setPreview(body.data as PreviewState);
      toast({ message: 'Previzualizare pregătită', variant: 'success' });
    } catch (error) {
      setFeedback({
        kind: 'validation',
        title: 'Verifică configurația',
        body: error instanceof Error ? error.message : 'Verifică JSON-ul și încearcă din nou.',
      });
      toast({
        message: error instanceof Error ? error.message : 'Eroare la previzualizare',
        variant: 'error',
      });
    } finally {
      setPendingAction(null);
    }
  };

  const publishActivity = async () => {
    setPendingAction('publish');
    setFeedback(null);
    try {
      const configData = parseConfigDraft(configDraft);
      const saveResponse = await fetch(`/api/v1/activities/${currentActivity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configData }),
      });
      if (!saveResponse.ok) {
        throw new Error(await readApiError(saveResponse, 'Nu am putut salva draftul'));
      }
      const saveBody = await saveResponse.json();
      const savedActivity = saveBody.data as ActivityRow;
      setCurrentActivity(savedActivity);
      setConfigDraft(prettyJson(configData));
      setPreview(null);

      const response = await fetch(`/api/v1/activities/${currentActivity.id}/publish`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Nu am putut publica activitatea'));
      }
      const body = await response.json();
      setCurrentActivity(body.data.activity as ActivityRow);
      if (body.data.version) {
        const version = body.data.version as ActivityVersionRow;
        setVersions((current) => [
          version,
          ...current.filter((item) => item.id !== version.id),
        ].slice(0, 5));
      }
      setFeedback({
        kind: 'success',
        title: 'Publicarea este gata',
        body: 'Activitatea este vizibilă în fluxul elevilor.',
      });
      toast({ message: 'Activitate publicată', variant: 'success' });
      router.refresh();
    } catch (error) {
      setFeedback({
        kind: 'validation',
        title: 'Verifică configurația',
        body: error instanceof Error ? error.message : 'Verifică JSON-ul și încearcă din nou.',
      });
      toast({
        message: error instanceof Error ? error.message : 'Eroare la publicare',
        variant: 'error',
      });
    } finally {
      setPendingAction(null);
    }
  };

  const revertToVersion = async (version: ActivityVersionRow) => {
    setPendingAction(`revert:${version.versionNumber}`);
    try {
      const response = await fetch(`/api/v1/activities/${currentActivity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'draft',
          isPublished: false,
          revertVersionId: version.id,
          typeId: version.activityTypeId,
          configSchemaVersion: version.configSchemaVersion,
          configData: version.configData,
        }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Nu am putut reveni la versiune'));
      }
      const body = await response.json();
      const updated = body.data as ActivityRow;
      setCurrentActivity(updated);
      setConfigDraft(prettyJson(updated.configData));
      setPreview(null);
      setFeedback(null);
      toast({ message: 'Versiune readusă ca ciornă', variant: 'success' });
      router.refresh();
    } catch (error) {
      toast({
        message: error instanceof Error ? error.message : 'Eroare la revenire',
        variant: 'error',
      });
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]">
      <section className="flex flex-col overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-outline-variant px-5 py-4">
          <div>
            <p className="type-label text-on-surface-variant">Editor activitate</p>
            <h2 className="type-headline text-on-surface">{currentActivity.title}</h2>
            <p className="text-[13px] font-semibold text-on-surface-variant">
              {activityType.displayName} · {currentActivity.id}
            </p>
          </div>
          <ActivityStatusBadge activity={currentActivity} />
        </div>

        <div className="border-b border-outline-variant px-5 py-4">
          <Textarea
            label="Configurație JSON ciornă"
            value={configDraft}
            onChange={(event) => setConfigDraft(event.target.value)}
            spellCheck={false}
            rows={16}
            autosize={false}
            styles={{
              label: {
                color: 'var(--color-on-surface)',
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 'var(--mantine-spacing-xs)',
              },
              input: {
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-outline-variant)',
                color: 'var(--color-on-surface)',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                lineHeight: '1.5rem',
                minHeight: 360,
                padding: 'var(--mantine-spacing-sm) var(--mantine-spacing-md)',
                resize: 'vertical',
              },
            }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-b border-outline-variant px-5 py-4">
          <Button
            type="button"
            variant="secondary"
            disabled={pendingAction !== null}
            isPending={pendingAction === 'preview'}
            onClick={() => {
              void requestPreview();
            }}
          >
            <span className="inline-flex items-center gap-2">
              <Icon name="Eye" size="sm" />
              Previzualizează ca elev
            </span>
          </Button>
          <Button
            type="button"
            disabled={pendingAction !== null || !canPublish}
            isPending={pendingAction === 'publish'}
            onClick={() => {
              void publishActivity();
            }}
          >
            Publică
          </Button>
        </div>

        {feedback ? (
          <div
            role={feedback.kind === 'validation' ? 'alert' : 'status'}
            className="mx-5 mt-4 flex items-center gap-3 rounded-lg border border-outline-variant bg-surface p-3"
          >
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container text-on-surface-variant"
            >
              <Icon
                name={feedback.kind === 'success' ? 'CheckCircle' : 'WarningCircle'}
                size="xl"
                weight="bold"
              />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-bold leading-tight text-on-surface">
                {feedback.title}
              </p>
              <p className="mt-1 text-[13px] font-semibold leading-snug text-on-surface-variant">
                {feedback.body}
              </p>
            </div>
          </div>
        ) : null}

        <div className="mx-5 mb-5 mt-4 overflow-hidden rounded-lg border border-outline-variant bg-surface">
          <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
            <span className="text-[13px] font-bold text-on-surface">
              Previzualizare elev
            </span>
            {preview ? (
              <span className="text-[12px] font-semibold text-on-surface-variant">
                Previzualizarea expiră {formatDateShort(preview.expiresAt)}
              </span>
            ) : null}
          </div>
          {previewSrc ? (
            <iframe
              title="Previzualizare elev"
              src={previewSrc}
              className="block h-[520px] w-full bg-surface-container-lowest"
            />
          ) : (
            <div className="flex h-[520px] items-center justify-center px-6 text-center text-[13px] font-semibold text-on-surface-variant">
              Generează o previzualizare ca să vezi activitatea prin ochii elevului.
            </div>
          )}
        </div>
      </section>

      <section
        aria-label="Istoric versiuni"
        className="flex flex-col overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest"
      >
        <div className="border-b border-outline-variant px-5 py-4">
          <p className="type-label text-on-surface-variant">Istoric versiuni</p>
          <h2 className="type-title text-on-surface">Ultimele 5 publicări</h2>
        </div>

        {versions.length === 0 ? (
          <p className="px-5 py-4 text-[13px] font-semibold text-on-surface-variant">
            Nu există versiuni publicate încă.
          </p>
        ) : (
          versions.map((version) => (
            <article
              key={version.id}
              className="flex flex-col gap-3 border-b border-outline-variant px-5 py-4 last:border-b-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-[15px] font-bold text-on-surface">
                    Versiunea {version.versionNumber}
                  </h3>
                  <p className="text-[12px] font-semibold text-on-surface-variant">
                    Schema {version.configSchemaVersion}
                    {version.publishedAt ? ` · ${formatDateShort(version.publishedAt)}` : ''}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pendingAction !== null}
                  isPending={pendingAction === `revert:${version.versionNumber}`}
                  onClick={() => {
                    void revertToVersion(version);
                  }}
                >
                  Revino la versiunea {version.versionNumber}
                </Button>
              </div>
              <div className="grid gap-3 text-[12px] md:grid-cols-2">
                <div>
                  <p className="mb-1 font-bold text-on-surface-variant">
                    Configurație curentă
                  </p>
                  <pre className="max-h-56 overflow-auto rounded-sm bg-surface-container p-3 font-mono text-on-surface">
                    {currentJson}
                  </pre>
                </div>
                <div>
                  <p className="mb-1 font-bold text-on-surface-variant">
                    Versiune publicată
                  </p>
                  <pre className="max-h-56 overflow-auto rounded-sm bg-surface-container p-3 font-mono text-on-surface">
                    {prettyJson(version.configData)}
                  </pre>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
