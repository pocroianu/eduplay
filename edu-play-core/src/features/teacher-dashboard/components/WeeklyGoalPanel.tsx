'use client';

import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import { BackgroundGlyph, DuoCard, DuoProgress } from '@/shared/components/ui/kit';
import { Icon } from '@/shared/components/ui/Icon';

export interface WeeklyGoalPanelProps {
  /** The goal title/description. If null, shows empty state. */
  title?: string | null;
  /** Current step (1-indexed). */
  currentStep?: number;
  /** Total number of steps. */
  totalSteps?: number;
}

export function WeeklyGoalPanel({
  title = null,
  currentStep = 0,
  totalSteps = 0,
}: WeeklyGoalPanelProps) {
  const { t } = useTranslation('teacher');
  const reduceMotion = useReducedMotion();
  const percent = totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0;
  const hasGoal = title && totalSteps > 0;

  return (
    <DuoCard className="relative overflow-hidden p-8 lg:p-10">
      {/* Decorative background */}
      <div className="absolute -bottom-6 -right-6 pointer-events-none">
        <BackgroundGlyph kind="blob" tone="gold" size={140} opacity={0.06} />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold/10 text-gold">
            <Icon name="Flag" size="lg" weight="bold" />
          </div>
          <h3 className="font-headline text-lg font-bold text-on-surface">
            {t('classes.detail.weeklyGoal.heading')}
          </h3>
        </div>

        {hasGoal ? (
          <>
            <p className="text-sm text-on-surface-variant mb-6">{title}</p>

            {/* Step indicators */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {Array.from({ length: totalSteps }).map((_, i) => {
                const stepNum = i + 1;
                const isCompleted = stepNum < currentStep;
                const isCurrent = stepNum === currentStep;

                return (
                  <motion.div
                    key={stepNum}
                    className={`
                      flex items-center justify-center rounded-full font-bold text-xs transition-all
                      ${isCurrent ? 'w-12 h-12 bg-gold text-on-gold shadow-md' : ''}
                      ${isCompleted ? 'w-8 h-8 bg-primary text-on-primary' : ''}
                      ${!isCurrent && !isCompleted ? 'w-8 h-8 bg-surface-container text-on-surface-variant' : ''}
                    `}
                    animate={
                      isCurrent && !reduceMotion
                        ? { opacity: [1, 0.84, 1] }
                        : undefined
                    }
                    transition={
                      isCurrent && !reduceMotion
                        ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
                        : undefined
                    }
                  >
                    {isCompleted ? (
                      <Icon name="Check" size="sm" weight="bold" />
                    ) : (
                      stepNum
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Progress bar */}
            <DuoProgress value={percent} tone="green" height={8} className="mb-4" />

            <p className="text-center text-xs font-bold text-gold uppercase tracking-widest">
              {t('classes.detail.weeklyGoal.progress', { percent })}
            </p>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm font-medium text-on-surface-variant">
              {t('classes.detail.weeklyGoal.noGoal')}
            </p>
            <p className="text-xs text-on-surface-variant/70 mt-1">
              {t('classes.detail.weeklyGoal.noGoalDescription')}
            </p>
          </div>
        )}
      </div>
    </DuoCard>
  );
}
