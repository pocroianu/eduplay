'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { Trans, useTranslation } from 'react-i18next';
import { ChunkyButton, Vulpita } from '@/shared/components/ui/kit';
import { Icon } from '@/shared/components/ui/Icon';
import { fadeInUp } from '@/config/animations';
import { ROUTES } from '@/shared/lib/constants/routes';
import { getActivityType } from '../registry';
// Side-effect: registers every shipped F9 activity type so the client
// bundle can resolve concrete renderers after hydration.
import '../types/register-types';
import type {
  ActivityInstance,
  GateDeniedReason,
  GateResult,
} from '../types';

export interface ActivityPlayerProps {
  /** The activity_instances row the student is playing. */
  instance: ActivityInstance;
  /**
   * Pre-resolved result of the type's `gate` hook (EDU-301). When the gate
   * denies, the shell renders the kid-mode empty state for the reason
   * instead of mounting the renderer. Resolved server-side by the page so
   * the gate has access to the SSR Supabase client.
   */
  gateResult?: GateResult;
}

const GATE_REASON_BODY_KEY: Record<GateDeniedReason, string> = {
  consent_required: 'player.gate.consent.body',
  grade_locked: 'player.gate.gradeLocked.body',
  class_disabled: 'player.gate.classDisabled.body',
};

const GATE_REASON_TITLE_KEY: Record<GateDeniedReason, string> = {
  consent_required: 'player.gate.consent.title',
  grade_locked: 'player.gate.gradeLocked.title',
  class_disabled: 'player.gate.classDisabled.title',
};

interface ToolbarAction {
  key: 'save' | 'undo' | 'redo' | 'submit' | 'exit';
  label: string;
  icon: React.ComponentProps<typeof Icon>['name'];
  variant: React.ComponentProps<typeof ChunkyButton>['variant'];
  onClick: () => void;
  disabled?: boolean;
}

/**
 * Universal in-shell player for F9 creative activities. The shell owns the
 * lifecycle (save / undo / redo / submit / exit + mascot scaffolding) and
 * delegates the actual canvas/recorder/etc. UI to the type's registered
 * `RendererComponent`.
 *
 * Phase 1A intentionally renders a placeholder body when no type is
 * registered for `instance.typeId`, so the route can be exercised end-to-end
 * before any concrete activity types ship.
 */
export function ActivityPlayer({
  instance,
  gateResult,
}: ActivityPlayerProps) {
  const shouldReduceMotion = useReducedMotion();
  const router = useRouter();
  const { t } = useTranslation('activities');
  const definition = getActivityType(instance.typeId);

  const gateDenied = gateResult?.allowed === false;
  const gateDeniedCopy = gateDenied
    ? {
        title: t(GATE_REASON_TITLE_KEY[gateResult.reason]),
        body: gateResult.messageKey
          ? t(gateResult.messageKey)
          : t(GATE_REASON_BODY_KEY[gateResult.reason]),
      }
    : null;

  // Validate the instance config against the registered type's schema before
  // handing it to the renderer. CLAUDE.md §General: validate at system
  // boundaries; the JSONB column is one. A failure here renders a kid-mode
  // empty state instead of crashing the renderer or leaking schema details.
  const configResult =
    definition && !gateDenied
      ? definition.configSchema.safeParse(instance.config)
      : null;
  const configValid = configResult?.success === true;
  const configInvalid = configResult?.success === false;

  const [resultPreview, setResultPreview] = useState<string | null>(null);

  const handleComplete = useCallback((result: unknown) => {
    setResultPreview(JSON.stringify(result));
  }, []);

  const handleCancel = useCallback(() => {
    router.push(ROUTES.STUDENT.DASHBOARD);
  }, [router]);

  const toolbarActions: ToolbarAction[] = useMemo(
    () => [
      {
        key: 'save',
        label: t('player.toolbar.save'),
        icon: 'Check',
        variant: 'green',
        onClick: () => {
          // Phase 1A: save delegated to the type-specific renderer in 1B/1C.
        },
        disabled: !definition || gateDenied,
      },
      {
        key: 'undo',
        label: t('player.toolbar.undo'),
        icon: 'ArrowCounterClockwise',
        variant: 'ghost',
        onClick: () => {},
        disabled: !definition || gateDenied,
      },
      {
        key: 'redo',
        label: t('player.toolbar.redo'),
        icon: 'ArrowClockwise',
        variant: 'ghost',
        onClick: () => {},
        disabled: !definition || gateDenied,
      },
      {
        key: 'submit',
        label: t('player.toolbar.submit'),
        icon: 'PaperPlaneTilt',
        variant: 'gold',
        onClick: () => {},
        disabled: !definition || gateDenied,
      },
      {
        key: 'exit',
        label: t('player.toolbar.exit'),
        icon: 'SignOut',
        variant: 'coral',
        onClick: handleCancel,
      },
    ],
    [definition, gateDenied, handleCancel, t],
  );

  const Body = definition?.RendererComponent;
  const motionProps = shouldReduceMotion
    ? { initial: false }
    : {
        variants: fadeInUp,
        initial: 'initial' as const,
        animate: 'animate' as const,
      };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-surface border-b-2 border-outline-variant px-6 py-4 flex items-center gap-4">
        <Vulpita size={64} mood="happy" animate={!shouldReduceMotion} />
        <div className="flex-1">
          <h1 className="text-title font-heading text-on-surface">
            {definition?.displayName ?? t('player.title')}
          </h1>
          <p className="text-body-sm text-on-surface-variant">
            {definition
              ? t('player.subtitle.ready')
              : t('player.subtitle.comingSoon')}
          </p>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 flex items-center justify-center">
        <motion.div
          className="w-full max-w-3xl bg-surface rounded-xl p-8 shadow-soft"
          {...motionProps}
        >
          {gateDeniedCopy ? (
            <div className="flex flex-col items-center gap-6 text-center py-12">
              <Vulpita
                size={120}
                mood="think"
                animate={!shouldReduceMotion}
              />
              <h2 className="text-title font-heading text-on-surface">
                {gateDeniedCopy.title}
              </h2>
              <p className="text-body text-on-surface-variant max-w-md">
                {gateDeniedCopy.body}
              </p>
              <ChunkyButton
                variant="green"
                size="lg"
                icon="ArrowLeft"
                onClick={handleCancel}
              >
                {t('player.gate.backToDashboard')}
              </ChunkyButton>
            </div>
          ) : Body && configValid ? (
            <Body
              instanceId={instance.id}
              config={configResult.data}
              onComplete={handleComplete}
              onCancel={handleCancel}
            />
          ) : Body && configInvalid ? (
            <div className="flex flex-col items-center gap-4 text-center py-12">
              <Icon name="Sparkle" size="xl" weight="fill" />
              <h2 className="text-title font-heading text-on-surface">
                {t('player.invalidConfig.title')}
              </h2>
              <p className="text-body text-on-surface-variant max-w-md">
                {t('player.invalidConfig.body')}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center py-12">
              <Icon name="Sparkle" size="xl" weight="fill" />
              <h2 className="text-title font-heading text-on-surface">
                {t('player.notReady.title')}
              </h2>
              <p className="text-body text-on-surface-variant max-w-md">
                <Trans
                  ns="activities"
                  i18nKey="player.notReady.body"
                  values={{ typeId: instance.typeId }}
                  components={{
                    code: <code className="font-mono text-body-sm" />,
                  }}
                />
              </p>
            </div>
          )}
          {resultPreview ? (
            <p
              role="status"
              className="mt-6 text-body-sm text-on-surface-variant"
            >
              {t('player.result.previewLabel')}{' '}
              <code>{resultPreview}</code>
            </p>
          ) : null}
        </motion.div>
      </main>

      <footer
        role="toolbar"
        aria-label={t('player.toolbar.ariaLabel')}
        className="bg-surface border-t-2 border-outline-variant px-6 py-4 flex flex-wrap items-center justify-center gap-3"
      >
        {toolbarActions.map((action) => (
          <ChunkyButton
            key={action.key}
            variant={action.variant}
            size="lg"
            icon={action.icon}
            onClick={action.onClick}
            disabled={action.disabled}
            aria-label={action.label}
          >
            {action.label}
          </ChunkyButton>
        ))}
      </footer>
    </div>
  );
}
